import { Pinecone } from "@pinecone-database/pinecone";
import type { SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import {
  buildPineconeNamespace,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  indexEntryEmbeddings,
  type EntryEmbeddingRecord,
  type EntryEmbeddingStatusUpdate,
  type PineconeVectorUpsert,
} from "@/lib/entries/embedding-index";

let openAIClient: OpenAI | null = null;
let pineconeClient: Pinecone | null = null;

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getOpenAIClient(): OpenAI {
  if (!openAIClient) {
    openAIClient = new OpenAI({
      apiKey: getRequiredEnv("OPENAI_API_KEY"),
    });
  }

  return openAIClient;
}

function getPineconeClient(): Pinecone {
  if (!pineconeClient) {
    pineconeClient = new Pinecone({
      apiKey: getRequiredEnv("PINECONE_API_KEY"),
    });
  }

  return pineconeClient;
}

export function getPineconeNamespacePrefix(): string {
  return process.env.PINECONE_NAMESPACE_PREFIX || "user";
}

export function getOpenAIEmbeddingDimensions(): number {
  const rawValue = process.env.OPENAI_EMBEDDING_DIMENSIONS;
  if (!rawValue) {
    return EMBEDDING_DIMENSIONS;
  }

  const dimensions = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(dimensions) || dimensions <= 0) {
    throw new Error(
      "OPENAI_EMBEDDING_DIMENSIONS must be a positive integer.",
    );
  }

  return dimensions;
}

export async function createOpenAIEmbedding(text: string): Promise<number[]> {
  const dimensions = getOpenAIEmbeddingDimensions();
  const response = await getOpenAIClient().embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
    encoding_format: "float",
    dimensions,
  });

  const embedding = response.data[0]?.embedding;

  if (!embedding) {
    throw new Error("OpenAI did not return an embedding.");
  }

  return embedding;
}

export async function upsertPineconeVector(
  vector: PineconeVectorUpsert,
): Promise<void> {
  const indexName = getRequiredEnv("PINECONE_INDEX_NAME");
  const index = getPineconeClient().index(indexName);
  const logDetails = {
    indexName,
    namespace: vector.namespace,
    vectorId: vector.id,
    entryId: vector.metadata.entry_id,
    dimensions: vector.values.length,
  };

  console.log("[entry-embeddings] pinecone upsert starting", logDetails);

  try {
    await index.namespace(vector.namespace).upsert({
      records: [
        {
          id: vector.id,
          values: vector.values,
          metadata: vector.metadata,
        },
      ],
    });
  } catch (error) {
    console.error("[entry-embeddings] pinecone upsert failed", {
      ...logDetails,
      message: error instanceof Error ? error.message : "Unknown Pinecone error.",
    });
    throw error;
  }

  console.log("[entry-embeddings] pinecone upsert completed", logDetails);
}

export async function deletePineconeEntryVector(params: {
  userId: string;
  vectorId: string;
}): Promise<void> {
  const indexName = getRequiredEnv("PINECONE_INDEX_NAME");
  const namespace = buildPineconeNamespace(
    params.userId,
    getPineconeNamespacePrefix(),
  );
  const index = getPineconeClient().index(indexName);

  console.log("[entry-embeddings] pinecone delete starting", {
    indexName,
    namespace,
    vectorId: params.vectorId,
  });

  await index.deleteOne({
    id: params.vectorId,
    namespace,
  });

  console.log("[entry-embeddings] pinecone delete completed", {
    indexName,
    namespace,
    vectorId: params.vectorId,
  });
}

export function buildEntryEmbeddingUpdatePayload(
  update: EntryEmbeddingStatusUpdate,
): {
  embedding_status: EntryEmbeddingStatusUpdate["status"];
  pinecone_vector_id?: string | null;
  embedded_at?: string | null;
} {
  if (update.status === "indexed") {
    return {
      embedding_status: "indexed",
      pinecone_vector_id: update.pineconeVectorId,
      embedded_at: update.embeddedAt,
    };
  }

  return {
    embedding_status: update.status,
    pinecone_vector_id: null,
  };
}

function omitEmbeddedAt<T extends { embedded_at?: string | null }>(
  payload: T,
): Omit<T, "embedded_at"> {
  const fallbackPayload = { ...payload };
  delete fallbackPayload.embedded_at;
  return fallbackPayload;
}

function isMissingEmbeddedAtSchemaCacheError(error: {
  message?: string;
} | null): boolean {
  const message = error?.message;
  return Boolean(
    message?.includes("embedded_at") &&
      message.includes("schema cache"),
  );
}

function isMissingEntryEmbeddingSchemaCacheError(error: {
  message?: string;
} | null): boolean {
  const message = error?.message;
  return Boolean(
    message?.includes("schema cache") &&
      (message.includes("embedding_status") ||
        message.includes("pinecone_vector_id") ||
        message.includes("embedded_at")),
  );
}

export async function markSupabaseEntryEmbeddingStatus(
  supabase: SupabaseClient,
  update: EntryEmbeddingStatusUpdate,
): Promise<void> {
  const payload = buildEntryEmbeddingUpdatePayload(update);
  let { data, error } = await supabase
    .from("entries")
    .update(payload)
    .eq("user_id", update.userId)
    .eq("entry_id", update.entryId)
    .select("entry_id");

  if (isMissingEmbeddedAtSchemaCacheError(error) && update.status === "indexed") {
    console.warn("[entry-embeddings] retrying status update without embedded_at", {
      entryId: update.entryId,
      message: error?.message,
    });

    const fallbackResult = await supabase
      .from("entries")
      .update(omitEmbeddedAt(payload))
      .eq("user_id", update.userId)
      .eq("entry_id", update.entryId)
      .select("entry_id");

    data = fallbackResult.data;
    error = fallbackResult.error;
  }

  if (isMissingEntryEmbeddingSchemaCacheError(error)) {
    console.warn("[entry-embeddings] skipping embedding status update", {
      entryId: update.entryId,
      status: update.status,
      message: error?.message,
    });
    return;
  }

  if (error) {
    throw new Error(`Failed to update embedding status: ${error.message}`, {
      cause: error,
    });
  }

  if (!data || data.length === 0) {
    throw new Error(
      `Failed to update embedding status: no entry matched ${update.entryId}.`,
    );
  }
}

export async function indexEntriesWithDefaultClients(params: {
  supabase: SupabaseClient;
  records: EntryEmbeddingRecord[];
}) {
  return indexEntryEmbeddings(
    {
      createEmbedding: createOpenAIEmbedding,
      upsertVector: upsertPineconeVector,
      markEntryEmbeddingStatus: (update) =>
        markSupabaseEntryEmbeddingStatus(params.supabase, update),
      now: () => new Date(),
      namespacePrefix: getPineconeNamespacePrefix(),
    },
    params.records,
  );
}

export type IndexEntriesWithDefaultClients = typeof indexEntriesWithDefaultClients;
