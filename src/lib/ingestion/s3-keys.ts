const UNSAFE_FILE_CHARS = /[^a-zA-Z0-9._-]/g;

export function sanitizeFileName(fileName: string): string {
  const normalized = fileName.trim().replace(/\s+/g, "-").replace(UNSAFE_FILE_CHARS, "");
  return normalized.length > 0 ? normalized : "upload";
}

export function buildTempPrefix(clientId: string, ingestionId: string): string {
  return `temp/${clientId}/${ingestionId}`;
}

export function buildProcessingSourcePrefix(clientId: string, ingestionId: string): string {
  return `processing/${clientId}/${ingestionId}/source`;
}

export function buildFinalPrefix(clientId: string, ingestionId: string): string {
  return `final/${clientId}/${ingestionId}`;
}

export function buildTempObjectKey(
  clientId: string,
  ingestionId: string,
  clientFileId: string,
  fileName: string,
): string {
  return `${buildTempPrefix(clientId, ingestionId)}/${clientFileId}-${sanitizeFileName(fileName)}`;
}

export function buildManifestKey(clientId: string, ingestionId: string): string {
  return `${buildFinalPrefix(clientId, ingestionId)}/manifest.json`;
}

export function buildEntriesPrefix(clientId: string, ingestionId: string): string {
  return `${buildFinalPrefix(clientId, ingestionId)}/entries/`;
}

export function buildJobMappingKey(textractJobId: string): string {
  return `processing/jobs/${textractJobId}.json`;
}

export function isOwnedTempKey(key: string, clientId: string, ingestionId: string): boolean {
  const expectedPrefix = `${buildTempPrefix(clientId, ingestionId)}/`;
  return key.startsWith(expectedPrefix) && !key.includes("../") && !key.includes("..\\");
}
