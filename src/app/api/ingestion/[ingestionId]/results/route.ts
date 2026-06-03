import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getIngestionBucket, getS3Client } from "@/lib/aws/clients";
import { getIngestionActor, type IngestionActor } from "@/lib/ingestion/auth";
import { deriveStatusFromFiles, getManifest, withDerivedFileStatuses } from "@/lib/ingestion/manifest";
import type { ExtractedEntry, IngestionStatus } from "@/lib/ingestion/types";
import { isValidIngestionId } from "@/lib/ingestion/validation";

const TERMINAL_STATUSES: IngestionStatus[] = ["COMPLETED", "PARTIAL_FAILED", "FAILED"];
const UNSAFE_ENTRY_ID_CHARS = /[^a-zA-Z0-9._-]/g;
const FLAT_ENTRY_KEY_PATTERN = /^entries\/[0-9a-fA-F-]{36}\/[^/]+\.json$/;
const LEGACY_ENTRY_KEY_PATTERN = /^entries\/[0-9a-fA-F-]{36}\/[0-9a-fA-F-]{36}\/[^/]+\.json$/;
const INGESTION_DEBUG = process.env.INGESTION_DEBUG === "1";
const SUPABASE_PROJECT_REF = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    return null;
  }

  const matched = url.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co$/i);
  return matched?.[1] ?? null;
})();

export const runtime = "nodejs";

function isValidEntryKey(key: string): boolean {
  return FLAT_ENTRY_KEY_PATTERN.test(key) || LEGACY_ENTRY_KEY_PATTERN.test(key);
}

async function bodyToString(body: unknown): Promise<string> {
  if (!body) {
    return "";
  }

  const maybeTransformable = body as { transformToString?: () => Promise<string> };
  if (typeof maybeTransformable.transformToString === "function") {
    return maybeTransformable.transformToString();
  }

  if (typeof body === "string") {
    return body;
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body).toString("utf8");
  }

  const maybeAsyncIterable = body as AsyncIterable<Uint8Array | string>;
  if (typeof maybeAsyncIterable[Symbol.asyncIterator] === "function") {
    const chunks: Uint8Array[] = [];
    for await (const chunk of maybeAsyncIterable) {
      if (typeof chunk === "string") {
        chunks.push(Buffer.from(chunk));
      } else {
        chunks.push(chunk);
      }
    }
    return Buffer.concat(chunks).toString("utf8");
  }

  throw new Error("Unsupported S3 body format.");
}

function isExtractedEntry(candidate: unknown): candidate is ExtractedEntry {
  if (!candidate || typeof candidate !== "object") {
    return false;
  }

  const value = candidate as ExtractedEntry;
  return (
    (typeof value.date === "string" || value.date === null) &&
    typeof value.entry_text === "string" &&
    typeof value.source_file === "string"
  );
}

function parseExtractedPayload(payload: unknown): {
  entries: ExtractedEntry[];
  shouldSplitToPerEntryObjects: boolean;
} {
  if (!payload || typeof payload !== "object") {
    return {
      entries: [],
      shouldSplitToPerEntryObjects: false,
    };
  }

  if (Array.isArray(payload)) {
    return {
      entries: payload.filter(isExtractedEntry),
      shouldSplitToPerEntryObjects: true,
    };
  }

  if (isExtractedEntry(payload)) {
    return {
      entries: [payload],
      shouldSplitToPerEntryObjects: false,
    };
  }

  const maybeEntriesWrapper = payload as { entries?: unknown[] };
  if (Array.isArray(maybeEntriesWrapper.entries)) {
    return {
      entries: maybeEntriesWrapper.entries.filter(isExtractedEntry),
      shouldSplitToPerEntryObjects: true,
    };
  }

  return {
    entries: [],
    shouldSplitToPerEntryObjects: false,
  };
}

function deriveEntryIdBaseFromKey(key: string): string {
  const fileName = key.split("/").pop() ?? crypto.randomUUID();
  const withoutExt = fileName.replace(/\.json$/i, "");
  const sanitized = withoutExt.replace(/\s+/g, "-").replace(UNSAFE_ENTRY_ID_CHARS, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return sanitized || crypto.randomUUID();
}

function buildPerEntryObjectKey(params: {
  userId: string;
  ingestionId: string;
  sourceKey: string;
  entry: ExtractedEntry;
  entryIndex: number;
}): string {
  const sourceBase = deriveEntryIdBaseFromKey(params.sourceKey);
  const digest = createHash("sha256")
    .update(JSON.stringify(params.entry))
    .digest("hex")
    .slice(0, 12);

  return `entries/${params.userId}/${params.ingestionId}/${sourceBase}-${params.entryIndex + 1}-${digest}.json`;
}

function normalizeEntryDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function getOptionalEntryId(entry: ExtractedEntry): string | null {
  const withEntryId = entry as ExtractedEntry & { entry_id?: unknown };
  if (typeof withEntryId.entry_id !== "string") {
    return null;
  }

  const sanitized = withEntryId.entry_id
    .trim()
    .replace(/\s+/g, "-")
    .replace(UNSAFE_ENTRY_ID_CHARS, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return sanitized || null;
}

async function syncEntriesToDatabase(params: {
  supabase: IngestionActor["supabase"];
  userId: string;
  clientId: string;
  entryObjects: Array<{ key: string; entry: ExtractedEntry }>;
}): Promise<number> {
  const rows: Array<{
    user_id: string;
    client_id: string;
    entry_id: string;
    s3_key: string;
    source_file: string | null;
    entry_date: string | null;
  }> = [];

  const seenEntryIds = new Set<string>();

  for (const item of params.entryObjects) {
    if (!isValidEntryKey(item.key)) {
      continue;
    }

    const explicitEntryId = getOptionalEntryId(item.entry);
    const initialId = explicitEntryId ?? deriveEntryIdBaseFromKey(item.key);

    let entryId = initialId;
    let suffix = 2;
    while (seenEntryIds.has(entryId)) {
      entryId = `${initialId}-${suffix}`;
      suffix += 1;
    }
    seenEntryIds.add(entryId);

    rows.push({
      user_id: params.userId,
      client_id: params.clientId,
      entry_id: entryId,
      s3_key: item.key,
      source_file: item.entry.source_file || null,
      entry_date: normalizeEntryDate(item.entry.date),
    });
  }

  if (rows.length === 0) {
    if (INGESTION_DEBUG) {
      console.log("[ingestion-results] no rows to upsert", {
        userId: params.userId,
        entriesByKeyCount: params.entryObjects.length,
      });
    }
    return 0;
  }

  if (INGESTION_DEBUG) {
    console.log("[ingestion-results] upsert rows", {
      userId: params.userId,
      rowCount: rows.length,
      sample: rows.slice(0, 25).map((row) => ({
        entry_id: row.entry_id,
        s3_key: row.s3_key,
      })),
    });
  }

  const { error } = await params.supabase.from("entries").upsert(rows, {
    onConflict: "user_id,entry_id",
  });

  if (!error) {
    return rows.length;
  }

  const sampleKeys = rows
    .slice(0, 10)
    .map((row) => row.s3_key)
    .join(", ");

  if (error.message.includes("entries_s3_key_check")) {
    const allKeysMatchExpectedFormat = rows.every((row) => isValidEntryKey(row.s3_key));
    if (allKeysMatchExpectedFormat) {
      throw new Error(
        "Failed to store entry references: database check constraint `entries_s3_key_check` is out of date. " +
          "Run the latest Supabase migrations (including 006) so `entries.s3_key` accepts both " +
          "`entries/{user_uuid}/{file}.json` and `entries/{user_uuid}/{ingestion_uuid}/{file}.json`." +
          `${SUPABASE_PROJECT_REF ? ` Active project ref: ${SUPABASE_PROJECT_REF}.` : ""}`,
      );
    }
  }

  throw new Error(
    `Failed to store entry references: ${error.message}. Sample keys: ${sampleKeys}`,
  );
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ ingestionId: string }> },
) {
  try {
    const actor = await getIngestionActor();
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { ingestionId } = await context.params;
    if (!isValidIngestionId(ingestionId)) {
      return NextResponse.json({ error: "Invalid ingestionId." }, { status: 400 });
    }

    const manifest = await getManifest(actor.user.id, ingestionId);
    if (!manifest) {
      return NextResponse.json({ error: "Ingestion not found." }, { status: 404 });
    }

    if (manifest.userId !== actor.user.id) {
      return NextResponse.json({ error: "Ingestion not found." }, { status: 404 });
    }

    const { files: normalizedFiles } = withDerivedFileStatuses(manifest.files);
    const effectiveStatus = TERMINAL_STATUSES.includes(manifest.status)
      ? manifest.status
      : deriveStatusFromFiles(normalizedFiles);

    if (!TERMINAL_STATUSES.includes(effectiveStatus)) {
      return NextResponse.json(
        { error: "Ingestion has not reached a terminal status.", status: effectiveStatus },
        { status: 409 },
      );
    }

    const s3 = getS3Client();
    const bucket = getIngestionBucket();
    const rawManifestEntryKeys = normalizedFiles
      .map((file) => file.entryKey)
      .filter((key): key is string => typeof key === "string" && key.length > 0);

    const entryKeys = Array.from(
      new Set(rawManifestEntryKeys.filter((key) => isValidEntryKey(key))),
    );
    const rejectedEntryKeys = rawManifestEntryKeys.filter((key) => !isValidEntryKey(key));

    if (INGESTION_DEBUG) {
      console.log("[ingestion-results] manifest entry keys", {
        ingestionId,
        userId: actor.user.id,
        bucket,
        manifestFiles: normalizedFiles.length,
        keyCount: entryKeys.length,
        rejectedCount: rejectedEntryKeys.length,
        sample: entryKeys.slice(0, 25),
        rejectedSample: rejectedEntryKeys.slice(0, 25),
      });
    }

    const parsedObjects = await Promise.all(
      entryKeys.map(async (key) => {
        const payload = await s3.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: key,
          }),
        );

        const raw = await bodyToString(payload.Body);
        if (!raw) {
          return {
            sourceKey: key,
            entries: [] as ExtractedEntry[],
            shouldSplitToPerEntryObjects: false,
          };
        }

        const parsed = JSON.parse(raw) as unknown;
        const normalized = parseExtractedPayload(parsed);
        return {
          sourceKey: key,
          entries: normalized.entries,
          shouldSplitToPerEntryObjects: normalized.shouldSplitToPerEntryObjects,
        };
      }),
    );

    const materializedEntryObjects = (
      await Promise.all(
        parsedObjects.map(async (item) => {
          if (item.entries.length === 0) {
            return [] as Array<{ key: string; entry: ExtractedEntry }>;
          }

          if (!item.shouldSplitToPerEntryObjects && item.entries.length === 1) {
            return [
              {
                key: item.sourceKey,
                entry: item.entries[0],
              },
            ];
          }

          return Promise.all(
            item.entries.map(async (entry, index) => {
              const key = buildPerEntryObjectKey({
                userId: actor.user.id,
                ingestionId,
                sourceKey: item.sourceKey,
                entry,
                entryIndex: index,
              });

              await s3.send(
                new PutObjectCommand({
                  Bucket: bucket,
                  Key: key,
                  ContentType: "application/json",
                  Body: JSON.stringify(entry),
                }),
              );

              return {
                key,
                entry,
              };
            }),
          );
        }),
      )
    ).flat();

    const entries = materializedEntryObjects.map((item) => item.entry);
    const syncedReferences = await syncEntriesToDatabase({
      supabase: actor.supabase,
      userId: actor.user.id,
      clientId: manifest.clientId || actor.clientId,
      entryObjects: materializedEntryObjects,
    });

    return NextResponse.json({
      ingestionId,
      entries,
      referencesSynced: syncedReferences,
      entryKeys: materializedEntryObjects.map((item) => item.key),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch ingestion results.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
