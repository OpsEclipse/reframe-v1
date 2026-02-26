import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getIngestionBucket, getS3Client } from "@/lib/aws/clients";
import { buildManifestKey } from "@/lib/ingestion/s3-keys";
import type {
  IngestionFileRecord,
  IngestionManifest,
  IngestionStatus,
  IngestionTotals,
} from "@/lib/ingestion/types";

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return candidate.name === "NoSuchKey" || candidate.$metadata?.httpStatusCode === 404;
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

export function deriveStatusFromFiles(files: IngestionFileRecord[]): IngestionStatus {
  if (files.length === 0) {
    return "FAILED";
  }

  let queued = 0;
  let processing = 0;
  let completed = 0;
  let failed = 0;

  for (const file of files) {
    if (file.status === "QUEUED") queued += 1;
    if (file.status === "PROCESSING") processing += 1;
    if (file.status === "COMPLETED") completed += 1;
    if (file.status === "FAILED") failed += 1;
  }

  if (processing > 0) return "PROCESSING";
  if (completed === files.length) return "COMPLETED";
  if (failed === files.length) return "FAILED";
  if (completed > 0 && failed > 0) return "PARTIAL_FAILED";
  return queued === files.length ? "QUEUED" : "PROCESSING";
}

export function computeTotals(files: IngestionFileRecord[]): IngestionTotals {
  return {
    total: files.length,
    queued: files.filter((file) => file.status === "QUEUED").length,
    processing: files.filter((file) => file.status === "PROCESSING").length,
    completed: files.filter((file) => file.status === "COMPLETED").length,
    failed: files.filter((file) => file.status === "FAILED").length,
  };
}

export function createInitialManifest(params: {
  ingestionId: string;
  clientId: string;
  files: Array<{
    clientFileId: string;
    key: string;
    name: string;
    contentType: string;
    size: number;
  }>;
}): IngestionManifest {
  const now = new Date().toISOString();

  return {
    version: 1,
    ingestionId: params.ingestionId,
    clientId: params.clientId,
    status: "QUEUED",
    submittedAt: now,
    updatedAt: now,
    files: params.files.map((file) => ({
      clientFileId: file.clientFileId,
      key: file.key,
      name: file.name,
      contentType: file.contentType,
      size: file.size,
      status: "QUEUED",
      errorMessage: null,
      textractJobId: null,
      entryKey: null,
      sourceFinalKey: null,
    })),
  };
}

export async function getManifest(
  clientId: string,
  ingestionId: string,
): Promise<IngestionManifest | null> {
  const s3 = getS3Client();
  const bucket = getIngestionBucket();
  const key = buildManifestKey(clientId, ingestionId);

  try {
    const response = await s3.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    const payload = await bodyToString(response.Body);
    if (!payload) {
      return null;
    }

    return JSON.parse(payload) as IngestionManifest;
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

export async function putManifest(manifest: IngestionManifest): Promise<void> {
  const s3 = getS3Client();
  const bucket = getIngestionBucket();
  const key = buildManifestKey(manifest.clientId, manifest.ingestionId);

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: "application/json",
      Body: JSON.stringify(manifest),
    }),
  );
}

export function withManifestTimestamp(manifest: IngestionManifest): IngestionManifest {
  return {
    ...manifest,
    updatedAt: new Date().toISOString(),
  };
}
