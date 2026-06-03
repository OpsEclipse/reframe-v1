export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 512;
export const DEFAULT_PINECONE_NAMESPACE_PREFIX = "user";

export type EntryEmbeddingStatus = "pending" | "indexed" | "failed";

export interface EntryEmbeddingRecord {
  userId: string;
  clientId: string;
  entryId: string;
  s3Key: string;
  sourceFile: string | null;
  entryDate: string | null;
  entryText: string;
}

export interface EntryMetadataSource {
  userId: string;
  clientId: string;
  entryId: string;
  s3Key: string;
  sourceFile: string | null;
  entryDate: string | null;
}

export interface PineconeEntryMetadata {
  [key: string]: string;
  user_id: string;
  client_id: string;
  entry_id: string;
  s3_key: string;
  source_file: string;
  entry_date: string;
}

interface EntryEmbeddingStatusUpdateBase {
  userId: string;
  entryId: string;
}

export type EntryEmbeddingStatusUpdate =
  | (EntryEmbeddingStatusUpdateBase & {
      status: "pending" | "failed";
      pineconeVectorId?: never;
      embeddedAt?: never;
    })
  | (EntryEmbeddingStatusUpdateBase & {
      status: "indexed";
      pineconeVectorId: string;
      embeddedAt: string;
    });

export interface PineconeVectorUpsert {
  namespace: string;
  id: string;
  values: number[];
  metadata: PineconeEntryMetadata;
}

export interface EntryEmbeddingDependencies {
  createEmbedding: (text: string) => Promise<number[]>;
  upsertVector: (vector: PineconeVectorUpsert) => Promise<void>;
  markEntryEmbeddingStatus: (
    update: EntryEmbeddingStatusUpdate,
  ) => Promise<void>;
  now: () => Date;
  namespacePrefix?: string;
}

export interface EntryEmbeddingResult {
  status: EntryEmbeddingStatus;
  vectorId: string;
}

export function buildPineconeNamespace(
  userId: string,
  prefix = DEFAULT_PINECONE_NAMESPACE_PREFIX,
): string {
  return `${prefix}:${userId}`;
}

export function buildPineconeVectorId(entryId: string): string {
  return `entry:${entryId}`;
}

export function buildPineconeMetadata(
  record: EntryMetadataSource,
): PineconeEntryMetadata {
  return {
    user_id: record.userId,
    client_id: record.clientId,
    entry_id: record.entryId,
    s3_key: record.s3Key,
    source_file: record.sourceFile ?? "",
    entry_date: record.entryDate ?? "",
  };
}

export async function indexEntryEmbedding(
  dependencies: EntryEmbeddingDependencies,
  record: EntryEmbeddingRecord,
): Promise<EntryEmbeddingResult> {
  const vectorId = buildPineconeVectorId(record.entryId);
  let values: number[];

  console.log("[entry-embeddings] marking entry embedding pending", {
    entryId: record.entryId,
    vectorId,
  });

  await dependencies.markEntryEmbeddingStatus({
    userId: record.userId,
    entryId: record.entryId,
    status: "pending",
  });

  try {
    console.log("[entry-embeddings] creating OpenAI embedding", {
      entryId: record.entryId,
      vectorId,
      textLength: record.entryText.length,
    });
    values = await dependencies.createEmbedding(record.entryText);
    console.log("[entry-embeddings] OpenAI embedding created", {
      entryId: record.entryId,
      vectorId,
      dimensions: values.length,
    });

    await dependencies.upsertVector({
      namespace: buildPineconeNamespace(
        record.userId,
        dependencies.namespacePrefix,
      ),
      id: vectorId,
      values,
      metadata: buildPineconeMetadata(record),
    });

    console.log("[entry-embeddings] vector upsert finished", {
      entryId: record.entryId,
      vectorId,
    });
  } catch (error) {
    console.error("[entry-embeddings] entry indexing failed", {
      entryId: record.entryId,
      vectorId,
      message: error instanceof Error ? error.message : "Unknown indexing error.",
    });

    await dependencies.markEntryEmbeddingStatus({
      userId: record.userId,
      entryId: record.entryId,
      status: "failed",
    });

    return {
      status: "failed",
      vectorId,
    };
  }

  await dependencies.markEntryEmbeddingStatus({
    userId: record.userId,
    entryId: record.entryId,
    status: "indexed",
    pineconeVectorId: vectorId,
    embeddedAt: dependencies.now().toISOString(),
  });

  return {
    status: "indexed",
    vectorId,
  };
}

export async function indexEntryEmbeddings(
  dependencies: EntryEmbeddingDependencies,
  records: EntryEmbeddingRecord[],
): Promise<EntryEmbeddingResult[]> {
  const results: EntryEmbeddingResult[] = [];

  for (const record of records) {
    try {
      results.push(await indexEntryEmbedding(dependencies, record));
    } catch (error) {
      console.error("[entry-embeddings] entry indexing threw outside retry path", {
        entryId: record.entryId,
        vectorId: buildPineconeVectorId(record.entryId),
        message: error instanceof Error ? error.message : "Unknown indexing error.",
      });

      results.push({
        status: "failed",
        vectorId: buildPineconeVectorId(record.entryId),
      });
    }
  }

  return results;
}
