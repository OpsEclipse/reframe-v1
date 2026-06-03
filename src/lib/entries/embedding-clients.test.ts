import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PineconeEntryMetadata } from "@/lib/entries/embedding-index";

const clientMocks = vi.hoisted(() => {
  const openAIEmbeddingsCreate = vi.fn();
  const pineconeUpsert = vi.fn();
  const pineconeNamespace = vi.fn(() => ({
    upsert: pineconeUpsert,
  }));
  const pineconeIndex = vi.fn(() => ({
    namespace: pineconeNamespace,
  }));

  return {
    OpenAI: vi.fn(function OpenAI() {
      return {
        embeddings: {
          create: openAIEmbeddingsCreate,
        },
      };
    }),
    Pinecone: vi.fn(function Pinecone() {
      return {
        index: pineconeIndex,
      };
    }),
    openAIEmbeddingsCreate,
    pineconeIndex,
    pineconeNamespace,
    pineconeUpsert,
  };
});

vi.mock("openai", () => ({
  default: clientMocks.OpenAI,
}));

vi.mock("@pinecone-database/pinecone", () => ({
  Pinecone: clientMocks.Pinecone,
}));

const originalEnv = process.env;

async function importEmbeddingClients() {
  return import("@/lib/entries/embedding-clients");
}

function setBaseEnv() {
  process.env.OPENAI_API_KEY = "openai-key";
  process.env.PINECONE_API_KEY = "pinecone-key";
  process.env.PINECONE_INDEX_NAME = "entries-index";
}

function createMetadata(): PineconeEntryMetadata {
  return {
    user_id: "user-123",
    client_id: "client-456",
    entry_id: "entry-abc",
    s3_key: "entries/user-123/file.json",
    source_file: "journal.pdf",
    entry_date: "2025-02-01",
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  clientMocks.openAIEmbeddingsCreate.mockReset();
  clientMocks.pineconeUpsert.mockReset();
  process.env = { ...originalEnv };
  delete process.env.OPENAI_API_KEY;
  delete process.env.PINECONE_API_KEY;
  delete process.env.PINECONE_INDEX_NAME;
  delete process.env.PINECONE_NAMESPACE_PREFIX;
});

afterAll(() => {
  process.env = originalEnv;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createOpenAIEmbedding", () => {
  it("sends the expected OpenAI embedding request", async () => {
    setBaseEnv();
    clientMocks.openAIEmbeddingsCreate.mockResolvedValue({
      data: [
        {
          embedding: [0.1, 0.2, 0.3],
        },
      ],
    });
    const { createOpenAIEmbedding } = await importEmbeddingClients();

    await expect(createOpenAIEmbedding("journal text")).resolves.toEqual([
      0.1, 0.2, 0.3,
    ]);

    expect(clientMocks.OpenAI).toHaveBeenCalledWith({
      apiKey: "openai-key",
    });
    expect(clientMocks.openAIEmbeddingsCreate).toHaveBeenCalledWith({
      model: "text-embedding-3-small",
      input: "journal text",
      encoding_format: "float",
    });
  });

  it("throws when the OpenAI API key is missing", async () => {
    const { createOpenAIEmbedding } = await importEmbeddingClients();

    await expect(createOpenAIEmbedding("journal text")).rejects.toThrow(
      "Missing required environment variable: OPENAI_API_KEY",
    );
    expect(clientMocks.OpenAI).not.toHaveBeenCalled();
  });
});

describe("upsertPineconeVector", () => {
  it("sends the expected namespaced Pinecone upsert payload", async () => {
    setBaseEnv();
    clientMocks.pineconeUpsert.mockResolvedValue(undefined);
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { upsertPineconeVector } = await importEmbeddingClients();

    await upsertPineconeVector({
      namespace: "user:user-123",
      id: "entry:entry-abc",
      values: [0.1, 0.2, 0.3],
      metadata: createMetadata(),
    });

    expect(clientMocks.Pinecone).toHaveBeenCalledWith({
      apiKey: "pinecone-key",
    });
    expect(clientMocks.pineconeIndex).toHaveBeenCalledWith("entries-index");
    expect(clientMocks.pineconeNamespace).toHaveBeenCalledWith("user:user-123");
    expect(clientMocks.pineconeUpsert).toHaveBeenCalledWith({
      records: [
        {
          id: "entry:entry-abc",
          values: [0.1, 0.2, 0.3],
          metadata: createMetadata(),
        },
      ],
    });
    expect(consoleLog).toHaveBeenCalledWith(
      "[entry-embeddings] pinecone upsert starting",
      {
        indexName: "entries-index",
        namespace: "user:user-123",
        vectorId: "entry:entry-abc",
        entryId: "entry-abc",
        dimensions: 3,
      },
    );
    expect(consoleLog).toHaveBeenCalledWith(
      "[entry-embeddings] pinecone upsert completed",
      {
        indexName: "entries-index",
        namespace: "user:user-123",
        vectorId: "entry:entry-abc",
        entryId: "entry-abc",
        dimensions: 3,
      },
    );
  });

  it("logs Pinecone upsert failures before rethrowing", async () => {
    setBaseEnv();
    const pineconeError = new Error("index not found");
    clientMocks.pineconeUpsert.mockRejectedValue(pineconeError);
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const { upsertPineconeVector } = await importEmbeddingClients();

    await expect(
      upsertPineconeVector({
        namespace: "user:user-123",
        id: "entry:entry-abc",
        values: [0.1, 0.2, 0.3],
        metadata: createMetadata(),
      }),
    ).rejects.toBe(pineconeError);

    expect(consoleLog).toHaveBeenCalledWith(
      "[entry-embeddings] pinecone upsert starting",
      {
        indexName: "entries-index",
        namespace: "user:user-123",
        vectorId: "entry:entry-abc",
        entryId: "entry-abc",
        dimensions: 3,
      },
    );
    expect(consoleError).toHaveBeenCalledWith(
      "[entry-embeddings] pinecone upsert failed",
      {
        indexName: "entries-index",
        namespace: "user:user-123",
        vectorId: "entry:entry-abc",
        entryId: "entry-abc",
        dimensions: 3,
        message: "index not found",
      },
    );
  });
});

describe("markSupabaseEntryEmbeddingStatus", () => {
  it("updates an entry status and requests the updated row", async () => {
    const select = vi.fn(async () => ({
      data: [{ entry_id: "entry-abc" }],
      error: null,
    }));
    const eqEntryId = vi.fn(() => ({ select }));
    const eqUserId = vi.fn(() => ({ eq: eqEntryId }));
    const update = vi.fn(() => ({ eq: eqUserId }));
    const from = vi.fn(() => ({ update }));
    const supabase = { from } as unknown as SupabaseClient;
    const { markSupabaseEntryEmbeddingStatus } = await importEmbeddingClients();

    await markSupabaseEntryEmbeddingStatus(supabase, {
      userId: "user-123",
      entryId: "entry-abc",
      status: "indexed",
      pineconeVectorId: "entry:entry-abc",
      embeddedAt: "2026-06-03T12:00:00.000Z",
    });

    expect(from).toHaveBeenCalledWith("entries");
    expect(update).toHaveBeenCalledWith({
      embedding_status: "indexed",
      pinecone_vector_id: "entry:entry-abc",
      embedded_at: "2026-06-03T12:00:00.000Z",
    });
    expect(eqUserId).toHaveBeenCalledWith("user_id", "user-123");
    expect(eqEntryId).toHaveBeenCalledWith("entry_id", "entry-abc");
    expect(select).toHaveBeenCalledWith("entry_id");
  });

  it("retries indexed status updates without embedded_at when Supabase schema cache is stale", async () => {
    const staleSchemaError = {
      message:
        "Could not find the 'embedded_at' column of 'entries' in the schema cache",
    };
    const firstSelect = vi.fn(async () => ({
      data: null,
      error: staleSchemaError,
    }));
    const secondSelect = vi.fn(async () => ({
      data: [{ entry_id: "entry-abc" }],
      error: null,
    }));
    const firstEqEntryId = vi.fn(() => ({ select: firstSelect }));
    const secondEqEntryId = vi.fn(() => ({ select: secondSelect }));
    const firstEqUserId = vi.fn(() => ({ eq: firstEqEntryId }));
    const secondEqUserId = vi.fn(() => ({ eq: secondEqEntryId }));
    const update = vi
      .fn()
      .mockReturnValueOnce({ eq: firstEqUserId })
      .mockReturnValueOnce({ eq: secondEqUserId });
    const from = vi.fn(() => ({ update }));
    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    const supabase = { from } as unknown as SupabaseClient;
    const { markSupabaseEntryEmbeddingStatus } = await importEmbeddingClients();

    await markSupabaseEntryEmbeddingStatus(supabase, {
      userId: "user-123",
      entryId: "entry-abc",
      status: "indexed",
      pineconeVectorId: "entry:entry-abc",
      embeddedAt: "2026-06-03T12:00:00.000Z",
    });

    expect(update).toHaveBeenNthCalledWith(1, {
      embedding_status: "indexed",
      pinecone_vector_id: "entry:entry-abc",
      embedded_at: "2026-06-03T12:00:00.000Z",
    });
    expect(update).toHaveBeenNthCalledWith(2, {
      embedding_status: "indexed",
      pinecone_vector_id: "entry:entry-abc",
    });
    expect(consoleWarn).toHaveBeenCalledWith(
      "[entry-embeddings] retrying status update without embedded_at",
      {
        entryId: "entry-abc",
        message:
          "Could not find the 'embedded_at' column of 'entries' in the schema cache",
      },
    );
  });

  it("does not block indexing when embedding status columns are missing", async () => {
    const missingStatusError = {
      message:
        "Could not find the 'embedding_status' column of 'entries' in the schema cache",
    };
    const select = vi.fn(async () => ({
      data: null,
      error: missingStatusError,
    }));
    const eqEntryId = vi.fn(() => ({ select }));
    const eqUserId = vi.fn(() => ({ eq: eqEntryId }));
    const update = vi.fn(() => ({ eq: eqUserId }));
    const from = vi.fn(() => ({ update }));
    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    const supabase = { from } as unknown as SupabaseClient;
    const { markSupabaseEntryEmbeddingStatus } = await importEmbeddingClients();

    await expect(
      markSupabaseEntryEmbeddingStatus(supabase, {
        userId: "user-123",
        entryId: "entry-abc",
        status: "pending",
      }),
    ).resolves.toBeUndefined();

    expect(consoleWarn).toHaveBeenCalledWith(
      "[entry-embeddings] skipping embedding status update",
      {
        entryId: "entry-abc",
        status: "pending",
        message:
          "Could not find the 'embedding_status' column of 'entries' in the schema cache",
      },
    );
  });

  it("throws when no entry row is updated", async () => {
    const select = vi.fn(async () => ({
      data: [],
      error: null,
    }));
    const eqEntryId = vi.fn(() => ({ select }));
    const eqUserId = vi.fn(() => ({ eq: eqEntryId }));
    const update = vi.fn(() => ({ eq: eqUserId }));
    const supabase = {
      from: vi.fn(() => ({ update })),
    } as unknown as SupabaseClient;
    const { markSupabaseEntryEmbeddingStatus } = await importEmbeddingClients();

    await expect(
      markSupabaseEntryEmbeddingStatus(supabase, {
        userId: "user-123",
        entryId: "entry-missing",
        status: "failed",
      }),
    ).rejects.toThrow(
      "Failed to update embedding status: no entry matched entry-missing.",
    );
  });

  it("preserves Supabase errors as the cause", async () => {
    const supabaseError = { message: "permission denied" };
    const select = vi.fn(async () => ({
      data: null,
      error: supabaseError,
    }));
    const eqEntryId = vi.fn(() => ({ select }));
    const eqUserId = vi.fn(() => ({ eq: eqEntryId }));
    const update = vi.fn(() => ({ eq: eqUserId }));
    const supabase = {
      from: vi.fn(() => ({ update })),
    } as unknown as SupabaseClient;
    const { markSupabaseEntryEmbeddingStatus } = await importEmbeddingClients();

    try {
      await markSupabaseEntryEmbeddingStatus(supabase, {
        userId: "user-123",
        entryId: "entry-abc",
        status: "failed",
      });
      throw new Error("Expected markSupabaseEntryEmbeddingStatus to throw.");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(
        "Failed to update embedding status: permission denied",
      );
      expect((error as Error).cause).toBe(supabaseError);
    }
  });
});
