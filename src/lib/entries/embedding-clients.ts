import { Pinecone } from "@pinecone-database/pinecone";
import type { SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import {
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

export async function createOpenAIEmbedding(text: string): Promise<number[]> {
  const response = await getOpenAIClient().embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
    encoding_format: "float",
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
  const index = getPineconeClient().index(getRequiredEnv("PINECONE_INDEX_NAME"));

  await index.namespace(vector.namespace).upsert({
    records: [
      {
        id: vector.id,
        values: vector.values,
        metadata: vector.metadata,
      },
    ],
  });
}

export function buildEntryEmbeddingUpdatePayload(
  update: EntryEmbeddingStatusUpdate,
): {
  embedding_status: EntryEmbeddingStatusUpdate["status"];
  pinecone_vector_id: string | null;
  embedded_at: string | null;
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
    embedded_at: null,
  };
}

export async function markSupabaseEntryEmbeddingStatus(
  supabase: SupabaseClient,
  update: EntryEmbeddingStatusUpdate,
): Promise<void> {
  const { data, error } = await supabase
    .from("entries")
    .update(buildEntryEmbeddingUpdatePayload(update))
    .eq("user_id", update.userId)
    .eq("entry_id", update.entryId)
    .select("entry_id");

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
