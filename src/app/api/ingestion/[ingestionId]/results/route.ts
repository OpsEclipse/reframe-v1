import { GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { getIngestionBucket, getS3Client } from "@/lib/aws/clients";
import { deriveStatusFromFiles, getManifest, withDerivedFileStatuses } from "@/lib/ingestion/manifest";
import { buildEntriesPrefix } from "@/lib/ingestion/s3-keys";
import type { ExtractedEntry, IngestionStatus } from "@/lib/ingestion/types";
import { isValidClientId, isValidIngestionId } from "@/lib/ingestion/validation";

const TERMINAL_STATUSES: IngestionStatus[] = ["COMPLETED", "PARTIAL_FAILED", "FAILED"];

export const runtime = "nodejs";

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

function normalizeExtractedPayload(payload: unknown): ExtractedEntry[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const maybeArray = payload as unknown[];
  if (Array.isArray(maybeArray)) {
    return maybeArray.filter(isExtractedEntry);
  }

  const maybeEntry = payload as ExtractedEntry;
  if (isExtractedEntry(maybeEntry)) {
    return [maybeEntry];
  }

  const maybeEntriesWrapper = payload as { entries?: unknown[] };
  if (Array.isArray(maybeEntriesWrapper.entries)) {
    return maybeEntriesWrapper.entries.filter(isExtractedEntry);
  }

  return [];
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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ ingestionId: string }> },
) {
  try {
    const clientId = request.headers.get("x-client-id")?.trim();
    if (!clientId || !isValidClientId(clientId)) {
      return NextResponse.json({ error: "Invalid x-client-id header." }, { status: 400 });
    }

    const { ingestionId } = await context.params;
    if (!isValidIngestionId(ingestionId)) {
      return NextResponse.json({ error: "Invalid ingestionId." }, { status: 400 });
    }

    const manifest = await getManifest(clientId, ingestionId);
    if (!manifest) {
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
    const prefix = buildEntriesPrefix(clientId, ingestionId);

    const entryKeys: string[] = [];
    let continuationToken: string | undefined;

    do {
      const listed = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );

      for (const object of listed.Contents ?? []) {
        if (object.Key && object.Key.endsWith(".json")) {
          entryKeys.push(object.Key);
        }
      }

      continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
    } while (continuationToken);

    const entries = (
      await Promise.all(
        entryKeys.map(async (key) => {
          const payload = await s3.send(
            new GetObjectCommand({
              Bucket: bucket,
              Key: key,
            }),
          );

          const raw = await bodyToString(payload.Body);
          if (!raw) {
            return [] as ExtractedEntry[];
          }

          const parsed = JSON.parse(raw) as unknown;
          return normalizeExtractedPayload(parsed);
        }),
      )
    ).flat();

    return NextResponse.json({ ingestionId, entries });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch ingestion results.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
