import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getIngestionBucket, getS3Client } from "@/lib/aws/clients";
import type { ExtractedEntry } from "@/lib/ingestion/types";

export interface EntryReferenceWithContent {
  entry_id: string;
  s3_key: string;
  source_file: string | null;
  entry_date: string | null;
  pinecone_vector_id?: string | null;
  content: ExtractedEntry;
}

async function bodyToString(body: unknown): Promise<string> {
  if (!body) return "";

  const transformable = body as { transformToString?: () => Promise<string> };
  if (typeof transformable.transformToString === "function") {
    return transformable.transformToString();
  }

  if (typeof body === "string") return body;
  if (body instanceof Uint8Array) return Buffer.from(body).toString("utf8");

  const iterable = body as AsyncIterable<Uint8Array | string>;
  if (typeof iterable[Symbol.asyncIterator] === "function") {
    const chunks: Uint8Array[] = [];
    for await (const chunk of iterable) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks).toString("utf8");
  }

  throw new Error("Unsupported S3 body format.");
}

function isExtractedEntry(value: unknown): value is ExtractedEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as ExtractedEntry;
  return (
    (typeof entry.date === "string" || entry.date === null) &&
    typeof entry.entry_text === "string" &&
    typeof entry.source_file === "string"
  );
}

export function normalizeEntryPayload(payload: unknown): ExtractedEntry | null {
  if (isExtractedEntry(payload)) return payload;

  if (Array.isArray(payload)) {
    return payload.find(isExtractedEntry) ?? null;
  }

  const wrapper = payload as { entries?: unknown[] };
  if (Array.isArray(wrapper?.entries)) {
    return wrapper.entries.find(isExtractedEntry) ?? null;
  }

  return null;
}

export function normalizeEntryRawContent(
  raw: string,
  fallbackSourceFile: string | null,
): ExtractedEntry | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const normalized = normalizeEntryPayload(parsed);
    if (normalized) return normalized;
  } catch (error) {
    if (!(error instanceof SyntaxError)) {
      throw error;
    }
  }

  return {
    date: null,
    entry_text: raw,
    source_file: fallbackSourceFile ?? "",
  };
}

export async function readEntryContentFromS3(
  s3Key: string,
  fallbackSourceFile: string | null = null,
): Promise<ExtractedEntry | null> {
  const object = await getS3Client().send(
    new GetObjectCommand({
      Bucket: getIngestionBucket(),
      Key: s3Key,
    }),
  );

  const raw = await bodyToString(object.Body);
  return normalizeEntryRawContent(raw, fallbackSourceFile);
}
