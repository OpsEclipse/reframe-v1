import { getMaxFileBytes, getMaxFiles, hasSupportedExtension, isSupportedContentType } from "./limits";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface IngestionFileInput {
  clientFileId: string;
  name: string;
  contentType: string;
  size: number;
  key?: string;
}

export function isValidClientId(clientId: string): boolean {
  return UUID_REGEX.test(clientId);
}

export function isValidIngestionId(ingestionId: string): boolean {
  return UUID_REGEX.test(ingestionId);
}

export function isValidClientFileId(clientFileId: string): boolean {
  return /^[a-zA-Z0-9_-]{1,128}$/.test(clientFileId);
}

export function validateFiles(files: IngestionFileInput[]): string | null {
  if (!Array.isArray(files) || files.length === 0) {
    return "At least one file is required.";
  }

  const maxFiles = getMaxFiles();
  if (files.length > maxFiles) {
    return `A maximum of ${maxFiles} files is allowed per ingestion.`;
  }

  const maxFileBytes = getMaxFileBytes();

  for (const file of files) {
    if (!isValidClientFileId(file.clientFileId)) {
      return `Invalid clientFileId: ${file.clientFileId}`;
    }

    if (!file.name || typeof file.name !== "string") {
      return `File name is required for ${file.clientFileId}.`;
    }

    if (!Number.isFinite(file.size) || file.size <= 0) {
      return `Invalid file size for ${file.clientFileId}.`;
    }

    if (file.size > maxFileBytes) {
      return `${file.name} exceeds the size limit of ${Math.floor(maxFileBytes / (1024 * 1024))} MB.`;
    }

    if (!isSupportedContentType(file.contentType) || !hasSupportedExtension(file.name)) {
      return `${file.name} is not a supported upload type.`;
    }
  }

  return null;
}
