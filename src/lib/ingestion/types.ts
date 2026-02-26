export type IngestionStatus =
  | "UPLOADING"
  | "READY_TO_SUBMIT"
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "PARTIAL_FAILED"
  | "FAILED";

export type IngestionFileStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface IngestionFileRecord {
  clientFileId: string;
  key: string;
  name: string;
  contentType: string;
  size: number;
  status: IngestionFileStatus;
  errorMessage?: string | null;
  textractJobId?: string | null;
  entryKey?: string | null;
  sourceFinalKey?: string | null;
}

export interface IngestionTotals {
  total: number;
  queued: number;
  processing: number;
  completed: number;
  failed: number;
}

export interface IngestionManifest {
  version: 1;
  ingestionId: string;
  clientId: string;
  status: IngestionStatus;
  submittedAt: string;
  updatedAt: string;
  files: IngestionFileRecord[];
}

export interface StarterInvokePayload {
  ingestionId: string;
  clientId: string;
  bucket: string;
  manifestKey: string;
  files: Array<{
    clientFileId: string;
    key: string;
    name: string;
    contentType: string;
    size: number;
  }>;
}

export interface ExtractedEntry {
  date: string | null;
  entry_text: string;
  source_file: string;
}

export const TERMINAL_INGESTION_STATUSES: IngestionStatus[] = ["COMPLETED", "PARTIAL_FAILED", "FAILED"];

export function isTerminalIngestionStatus(status: IngestionStatus): boolean {
  return TERMINAL_INGESTION_STATUSES.includes(status);
}
