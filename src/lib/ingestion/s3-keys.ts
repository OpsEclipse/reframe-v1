const UNSAFE_FILE_CHARS = /[^a-zA-Z0-9._-]/g;

export function sanitizeFileName(fileName: string): string {
  const normalized = fileName.trim().replace(/\s+/g, "-").replace(UNSAFE_FILE_CHARS, "");
  return normalized.length > 0 ? normalized : "upload";
}

function buildTempPrefix(userId: string, ingestionId: string): string {
  return `uploads/${userId}/${ingestionId}`;
}

function buildManifestPrefix(userId: string, ingestionId: string): string {
  return `ingestions/${userId}/${ingestionId}`;
}

export function buildTempObjectKey(
  userId: string,
  ingestionId: string,
  clientFileId: string,
  fileName: string,
): string {
  return `${buildTempPrefix(userId, ingestionId)}/${clientFileId}-${sanitizeFileName(fileName)}`;
}

export function buildManifestKey(userId: string, ingestionId: string): string {
  return `${buildManifestPrefix(userId, ingestionId)}/manifest.json`;
}

export function isOwnedTempKey(key: string, userId: string, ingestionId: string): boolean {
  const expectedPrefix = `${buildTempPrefix(userId, ingestionId)}/`;
  return key.startsWith(expectedPrefix) && !key.includes("../") && !key.includes("..\\");
}
