import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getIngestionBucket, getS3Client } from "@/lib/aws/clients";
import { buildManifestKey } from "@/lib/ingestion/s3-keys";
import type {
  IngestionFileStatus,
  IngestionFileRecord,
  IngestionManifest,
  IngestionStatus,
  IngestionTotals,
} from "@/lib/ingestion/types";

const FILE_STATUSES = new Set<IngestionFileStatus>(["QUEUED", "PROCESSING", "COMPLETED", "FAILED"]);

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
    const effectiveStatus = deriveFileStatus(file);
    if (effectiveStatus === "QUEUED") queued += 1;
    if (effectiveStatus === "PROCESSING") processing += 1;
    if (effectiveStatus === "COMPLETED") completed += 1;
    if (effectiveStatus === "FAILED") failed += 1;
  }

  if (processing > 0) return "PROCESSING";
  if (completed === files.length) return "COMPLETED";
  if (failed === files.length) return "FAILED";
  if (completed > 0 && failed > 0) return "PARTIAL_FAILED";
  return queued === files.length ? "QUEUED" : "PROCESSING";
}

function normalizeFileStatus(value: unknown): IngestionFileStatus | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.toUpperCase();
  return FILE_STATUSES.has(normalized as IngestionFileStatus)
    ? (normalized as IngestionFileStatus)
    : null;
}

export function deriveFileStatus(file: IngestionFileRecord): IngestionFileStatus {
  const explicitStatus = normalizeFileStatus(file.status);

  if (file.entryKey) {
    return "COMPLETED";
  }

  if (explicitStatus === "COMPLETED" || explicitStatus === "FAILED") {
    return explicitStatus;
  }

  if (typeof file.errorMessage === "string" && file.errorMessage.trim().length > 0) {
    return "FAILED";
  }

  if (file.textractJobId || file.sourceFinalKey) {
    return "PROCESSING";
  }

  if (explicitStatus) {
    return explicitStatus;
  }

  return "QUEUED";
}

export function withDerivedFileStatuses(files: IngestionFileRecord[]): {
  files: IngestionFileRecord[];
  changed: boolean;
} {
  let changed = false;
  const normalizedFiles = files.map((file) => {
    const nextStatus = deriveFileStatus(file);
    if (file.status !== nextStatus) {
      changed = true;
      return {
        ...file,
        status: nextStatus,
      };
    }
    return file;
  });

  return { files: normalizedFiles, changed };
}

export function computeTotals(files: IngestionFileRecord[]): IngestionTotals {
  const totals = {
    total: files.length,
    queued: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  };

  for (const file of files) {
    const effectiveStatus = deriveFileStatus(file);
    if (effectiveStatus === "QUEUED") totals.queued += 1;
    if (effectiveStatus === "PROCESSING") totals.processing += 1;
    if (effectiveStatus === "COMPLETED") totals.completed += 1;
    if (effectiveStatus === "FAILED") totals.failed += 1;
  }

  return totals;
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
