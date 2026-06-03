import { describe, expect, it } from "vitest";
import { buildEntryEmbeddingUpdatePayload } from "@/lib/entries/embedding-clients";
import {
  buildPineconeMetadata,
  buildPineconeNamespace,
  buildPineconeVectorId,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  type EntryEmbeddingDependencies,
  type EntryEmbeddingRecord,
  type EntryEmbeddingStatusUpdate,
  type PineconeVectorUpsert,
  indexEntryEmbedding,
} from "@/lib/entries/embedding-index";

function createRecord(): EntryEmbeddingRecord {
  return {
    userId: "user-123",
    clientId: "client-456",
    entryId: "entry-abc",
    s3Key: "entries/user-123/file.json",
    sourceFile: "journal.pdf",
    entryDate: "2025-02-01",
    entryText: "I felt hopeful after a hard week.",
  };
}

function createDependencies(
  overrides: Partial<EntryEmbeddingDependencies> = {},
) {
  const createEmbeddingInputs: string[] = [];
  const statusUpdates: EntryEmbeddingStatusUpdate[] = [];
  const upserts: PineconeVectorUpsert[] = [];

  const dependencies: EntryEmbeddingDependencies = {
    createEmbedding: async (text) => {
      createEmbeddingInputs.push(text);
      return [0.1, 0.2, 0.3];
    },
    upsertVector: async (vector) => {
      upserts.push(vector);
    },
    markEntryEmbeddingStatus: async (update) => {
      statusUpdates.push(update);
    },
    now: () => new Date("2026-06-03T12:00:00.000Z"),
    namespacePrefix: "user",
    ...overrides,
  };

  return { createEmbeddingInputs, dependencies, statusUpdates, upserts };
}

describe("entry embedding helpers", () => {
  it("uses the approved OpenAI embedding model and dimensions", () => {
    expect(EMBEDDING_MODEL).toBe("text-embedding-3-small");
    expect(EMBEDDING_DIMENSIONS).toBe(1536);
  });

  it("builds a user namespace with the default prefix", () => {
    expect(buildPineconeNamespace("user-123")).toBe("user:user-123");
  });

  it("builds a user namespace with a custom prefix", () => {
    expect(buildPineconeNamespace("user-123", "client")).toBe("client:user-123");
  });

  it("builds a vector id from an entry id", () => {
    expect(buildPineconeVectorId("entry-abc")).toBe("entry:entry-abc");
  });

  it("builds metadata without full journal text", () => {
    const metadata = buildPineconeMetadata({
      userId: "user-123",
      clientId: "client-456",
      entryId: "entry-abc",
      s3Key: "entries/user-123/file.json",
      sourceFile: "journal.pdf",
      entryDate: "2025-02-01",
    });

    expect(metadata).toEqual({
      user_id: "user-123",
      client_id: "client-456",
      entry_id: "entry-abc",
      s3_key: "entries/user-123/file.json",
      source_file: "journal.pdf",
      entry_date: "2025-02-01",
    });
  });

  it("uses empty strings for nullable metadata fields", () => {
    expect(
      buildPineconeMetadata({
        userId: "user-123",
        clientId: "client-456",
        entryId: "entry-abc",
        s3Key: "entries/user-123/file.json",
        sourceFile: null,
        entryDate: null,
      }),
    ).toEqual({
      user_id: "user-123",
      client_id: "client-456",
      entry_id: "entry-abc",
      s3_key: "entries/user-123/file.json",
      source_file: "",
      entry_date: "",
    });
  });
});

describe("indexEntryEmbedding", () => {
  it("creates an embedding, upserts it, and marks the entry indexed", async () => {
    const record = createRecord();
    const { createEmbeddingInputs, dependencies, statusUpdates, upserts } =
      createDependencies();

    const result = await indexEntryEmbedding(dependencies, record);

    expect(result).toEqual({
      status: "indexed",
      vectorId: "entry:entry-abc",
    });
    expect(createEmbeddingInputs).toEqual([record.entryText]);
    expect(upserts).toEqual([
      {
        namespace: "user:user-123",
        id: "entry:entry-abc",
        values: [0.1, 0.2, 0.3],
        metadata: {
          user_id: "user-123",
          client_id: "client-456",
          entry_id: "entry-abc",
          s3_key: "entries/user-123/file.json",
          source_file: "journal.pdf",
          entry_date: "2025-02-01",
        },
      },
    ]);
    expect(statusUpdates).toEqual([
      {
        userId: "user-123",
        entryId: "entry-abc",
        status: "pending",
      },
      {
        userId: "user-123",
        entryId: "entry-abc",
        status: "indexed",
        pineconeVectorId: "entry:entry-abc",
        embeddedAt: "2026-06-03T12:00:00.000Z",
      },
    ]);
  });

  it("marks the entry failed when embedding creation fails", async () => {
    const record = createRecord();
    const createEmbeddingInputs: string[] = [];
    const { dependencies, statusUpdates, upserts } = createDependencies({
      createEmbedding: async (text) => {
        createEmbeddingInputs.push(text);
        throw new Error("OpenAI unavailable");
      },
    });

    const result = await indexEntryEmbedding(dependencies, record);

    expect(result).toEqual({
      status: "failed",
      vectorId: "entry:entry-abc",
    });
    expect(createEmbeddingInputs).toEqual([record.entryText]);
    expect(upserts).toEqual([]);
    expect(statusUpdates).toEqual([
      {
        userId: "user-123",
        entryId: "entry-abc",
        status: "pending",
      },
      {
        userId: "user-123",
        entryId: "entry-abc",
        status: "failed",
      },
    ]);
  });

  it("marks the entry failed when vector upsert fails", async () => {
    const record = createRecord();
    const { createEmbeddingInputs, dependencies, statusUpdates } =
      createDependencies({
        upsertVector: async () => {
          throw new Error("Pinecone unavailable");
        },
      });

    const result = await indexEntryEmbedding(dependencies, record);

    expect(result).toEqual({
      status: "failed",
      vectorId: "entry:entry-abc",
    });
    expect(createEmbeddingInputs).toEqual([record.entryText]);
    expect(statusUpdates).toEqual([
      {
        userId: "user-123",
        entryId: "entry-abc",
        status: "pending",
      },
      {
        userId: "user-123",
        entryId: "entry-abc",
        status: "failed",
      },
    ]);
  });

  it("throws when the indexed status update fails after a successful upsert", async () => {
    const indexedStatusError = new Error("Supabase unavailable");
    const { dependencies, statusUpdates, upserts } = createDependencies();
    dependencies.markEntryEmbeddingStatus = async (update) => {
      statusUpdates.push(update);

      if (update.status === "indexed") {
        throw indexedStatusError;
      }
    };

    await expect(indexEntryEmbedding(dependencies, createRecord())).rejects.toBe(
      indexedStatusError,
    );

    expect(upserts).toHaveLength(1);
    expect(statusUpdates).toEqual([
      {
        userId: "user-123",
        entryId: "entry-abc",
        status: "pending",
      },
      {
        userId: "user-123",
        entryId: "entry-abc",
        status: "indexed",
        pineconeVectorId: "entry:entry-abc",
        embeddedAt: "2026-06-03T12:00:00.000Z",
      },
    ]);
  });
});

describe("buildEntryEmbeddingUpdatePayload", () => {
  it("builds an indexed Supabase update payload", () => {
    expect(
      buildEntryEmbeddingUpdatePayload({
        userId: "user-123",
        entryId: "entry-abc",
        status: "indexed",
        pineconeVectorId: "entry:entry-abc",
        embeddedAt: "2026-06-03T12:00:00.000Z",
      }),
    ).toEqual({
      embedding_status: "indexed",
      pinecone_vector_id: "entry:entry-abc",
      embedded_at: "2026-06-03T12:00:00.000Z",
    });
  });

  it("builds a failed Supabase update payload that clears indexed fields", () => {
    expect(
      buildEntryEmbeddingUpdatePayload({
        userId: "user-123",
        entryId: "entry-abc",
        status: "failed",
      }),
    ).toEqual({
      embedding_status: "failed",
      pinecone_vector_id: null,
      embedded_at: null,
    });
  });
});
