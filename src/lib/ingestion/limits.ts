const DEFAULT_MAX_FILES = 20;
const DEFAULT_MAX_FILE_MB = 25;

export const SUPPORTED_CONTENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/heic",
  "image/heif",
] as const;

export const SUPPORTED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".heic", ".heif"] as const;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export function getMaxFiles(): number {
  return parsePositiveInt(process.env.NEXT_PUBLIC_INGESTION_MAX_FILES, DEFAULT_MAX_FILES);
}

export function getMaxFileMb(): number {
  return parsePositiveInt(process.env.NEXT_PUBLIC_INGESTION_MAX_FILE_MB, DEFAULT_MAX_FILE_MB);
}

export function getMaxFileBytes(): number {
  return getMaxFileMb() * 1024 * 1024;
}

export function isSupportedContentType(contentType: string): boolean {
  return SUPPORTED_CONTENT_TYPES.includes(contentType.toLowerCase() as (typeof SUPPORTED_CONTENT_TYPES)[number]);
}

export function hasSupportedExtension(fileName: string): boolean {
  const normalizedName = fileName.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((ext) => normalizedName.endsWith(ext));
}
