import { describe, expect, it } from "vitest";
import {
  buildPineconeMetadata,
  buildPineconeNamespace,
  buildPineconeVectorId,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  type EntryEmbeddingDependencies,
  type EntryEmbeddingRecord,
  type EntryEmbeddingStatusUpdate,
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
  const statusUpdates: EntryEmbeddingStatusUpdate[] = [];
  const upserts: Array<{
    namespace: string;
    id: string;
    values: number[];
  }> = [];

  const dependencies: EntryEmbeddingDependencies = {
    createEmbedding: async () => [0.1, 0.2, 0.3],
    upsertVector: async (vector) => {
      upserts.push({
        namespace: vector.namespace,
        id: vector.id,
        values: vector.values,
      });
    },
    markEntryEmbeddingStatus: async (update) => {
      statusUpdates.push(update);
    },
    now: () => new Date("2026-06-03T12:00:00.000Z"),
    namespacePrefix: "user",
    ...overrides,
  };

  return { dependencies, statusUpdates, upserts };
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
    const { dependencies, statusUpdates, upserts } = createDependencies();

    const result = await indexEntryEmbedding(dependencies, createRecord());

    expect(result).toEqual({
      status: "indexed",
      vectorId: "entry:entry-abc",
    });
    expect(upserts).toEqual([
      {
        namespace: "user:user-123",
        id: "entry:entry-abc",
        values: [0.1, 0.2, 0.3],
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
    const { dependencies, statusUpdates, upserts } = createDependencies({
      createEmbedding: async () => {
        throw new Error("OpenAI unavailable");
      },
    });

    const result = await indexEntryEmbedding(dependencies, createRecord());

    expect(result).toEqual({
      status: "failed",
      vectorId: "entry:entry-abc",
    });
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
    const { dependencies, statusUpdates } = createDependencies({
      upsertVector: async () => {
        throw new Error("Pinecone unavailable");
      },
    });

    const result = await indexEntryEmbedding(dependencies, createRecord());

    expect(result).toEqual({
      status: "failed",
      vectorId: "entry:entry-abc",
    });
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
});
