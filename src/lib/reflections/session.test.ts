import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildRandomIndexedEntryOffset,
  buildReflectionEntryId,
  buildReflectionEntryPayload,
  buildReflectionS3Key,
  saveReflectionEntry,
} from "@/lib/reflections/session";

const mocks = vi.hoisted(() => ({
  s3Send: vi.fn(),
  scheduleEntryEmbeddingIndexing: vi.fn(),
}));

vi.mock("@/lib/aws/clients", () => ({
  getIngestionBucket: () => "journal-bucket",
  getS3Client: () => ({ send: mocks.s3Send }),
}));

vi.mock("@/lib/entries/embedding-background", () => ({
  scheduleEntryEmbeddingIndexing: mocks.scheduleEntryEmbeddingIndexing,
}));

function createSupabaseForSave(options: {
  claimRows: unknown[];
  existingRows?: unknown[];
  entryInsertError?: { message: string } | null;
}) {
  const sessionUpdateLimit = vi.fn(async () => ({
    data: options.claimRows,
    error: null,
  }));
  const sessionUpdateSelect = vi.fn(() => ({ limit: sessionUpdateLimit }));
  const sessionUpdateIs = vi.fn(() => ({ select: sessionUpdateSelect }));
  const sessionRollbackEqCreated = vi.fn(async () => ({ error: null }));
  const sessionUpdateEqSession = vi.fn(() => ({
    is: sessionUpdateIs,
    eq: sessionRollbackEqCreated,
  }));
  const sessionUpdateEqUser = vi.fn(() => ({ eq: sessionUpdateEqSession }));
  const sessionUpdate = vi.fn(() => ({ eq: sessionUpdateEqUser }));

  const sessionSelectLimit = vi.fn(async () => ({
    data: options.existingRows ?? [],
    error: null,
  }));
  const sessionSelectEqSession = vi.fn(() => ({ limit: sessionSelectLimit }));
  const sessionSelectEqUser = vi.fn(() => ({ eq: sessionSelectEqSession }));
  const sessionSelect = vi.fn(() => ({ eq: sessionSelectEqUser }));

  const entryInsert = vi.fn(async () => ({
    error: options.entryInsertError ?? null,
  }));

  const entryUpdateEqEntry = vi.fn(async () => ({
    error: null,
  }));
  const entryUpdateEqUser = vi.fn(() => ({ eq: entryUpdateEqEntry }));
  const entryUpdate = vi.fn(() => ({ eq: entryUpdateEqUser }));

  const from = vi.fn((table: string) => {
    if (table === "reflection_sessions") {
      return {
        update: sessionUpdate,
        select: sessionSelect,
      };
    }

    if (table === "entries") {
      return {
        insert: entryInsert,
        update: entryUpdate,
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    supabase: { from },
    spies: {
      from,
      sessionUpdate,
      sessionUpdateEqUser,
      sessionUpdateEqSession,
      sessionUpdateIs,
      sessionRollbackEqCreated,
      sessionUpdateSelect,
      sessionUpdateLimit,
      sessionSelect,
      sessionSelectEqUser,
      sessionSelectEqSession,
      sessionSelectLimit,
      entryInsert,
      entryUpdate,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("reflection direct save helpers", () => {
  it("hydrates related entries in parallel", () => {
    const source = readFileSync(new URL("./session.ts", import.meta.url), "utf8");
    expect(source).toContain("Promise.all(matchesToHydrate.map");
  });

  it("builds a stable reflection entry id prefix", () => {
    expect(
      buildReflectionEntryId("2026-06-03T12:00:00.000Z", "fixed-random-id"),
    ).toBe("reflection-2026-06-03-fixed-random-id");
  });

  it("builds a flat entries S3 key", () => {
    expect(buildReflectionS3Key("user-123", "reflection-abc")).toBe(
      "entries/user-123/reflection-abc.json",
    );
  });

  it("builds random indexed entry offsets across the full count", () => {
    expect(buildRandomIndexedEntryOffset(100, 0)).toBe(0);
    expect(buildRandomIndexedEntryOffset(100, 0.42)).toBe(42);
    expect(buildRandomIndexedEntryOffset(100, 0.999999999999)).toBe(99);
  });

  it("builds structured reflection entry payload", () => {
    expect(
      buildReflectionEntryPayload({
        date: "2026-06-03",
        entryText: "This is what I wrote.",
        sessionId: "session-1",
        primaryEntryId: "entry-a",
        relatedEntryIds: ["entry-b"],
      }),
    ).toEqual({
      date: "2026-06-03",
      entry_text: "This is what I wrote.",
      source_file: "reflection",
      entry_type: "reflection",
      reflection_context: {
        session_id: "session-1",
        primary_entry_id: "entry-a",
        related_entry_ids: ["entry-b"],
      },
    });
  });
});

describe("saveReflectionEntry", () => {
  it("claims the session before writing the entry", async () => {
    mocks.s3Send.mockResolvedValue({});
    const { supabase, spies } = createSupabaseForSave({
      claimRows: [
        {
          session_id: "session-1",
          primary_entry_id: "entry-a",
          related_entry_ids: ["entry-b"],
          created_entry_id: "reflection-claimed",
        },
      ],
    });

    const result = await saveReflectionEntry({
      supabase: supabase as never,
      userId: "user-123",
      clientId: "client-456",
      sessionId: "session-1",
      entryText: "  Fresh thought.  ",
    });

    expect(spies.sessionUpdate).toHaveBeenCalledWith({
      created_entry_id: expect.stringMatching(/^reflection-/),
    });
    expect(spies.sessionUpdateIs).toHaveBeenCalledWith("created_entry_id", null);
    expect(mocks.s3Send).toHaveBeenCalled();
    expect(spies.entryInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        source_file: "reflection",
        embedding_status: "pending",
      }),
    );
    expect(result.embedding_status).toBe("pending");
    expect(mocks.scheduleEntryEmbeddingIndexing).toHaveBeenCalledWith(
      expect.objectContaining({
        records: [
          expect.objectContaining({
            entryId: result.entry_id,
            entryText: "Fresh thought.",
          }),
        ],
      }),
    );
  });

  it("rejects an already saved session without writing to S3", async () => {
    mocks.s3Send.mockClear();
    const { supabase } = createSupabaseForSave({
      claimRows: [],
      existingRows: [
        {
          session_id: "session-1",
          primary_entry_id: "entry-a",
          related_entry_ids: ["entry-b"],
          created_entry_id: "reflection-existing",
        },
      ],
    });

    await expect(
      saveReflectionEntry({
        supabase: supabase as never,
        userId: "user-123",
        clientId: "client-456",
        sessionId: "session-1",
        entryText: "Fresh thought.",
      }),
    ).rejects.toThrow("already has a saved entry");

    expect(mocks.s3Send).not.toHaveBeenCalled();
  });

  it("cleans up the S3 object when the entry insert fails", async () => {
    mocks.s3Send.mockResolvedValue({});
    const { supabase } = createSupabaseForSave({
      claimRows: [
        {
          session_id: "session-1",
          primary_entry_id: "entry-a",
          related_entry_ids: ["entry-b"],
          created_entry_id: "reflection-claimed",
        },
      ],
      entryInsertError: { message: "duplicate key" },
    });

    await expect(
      saveReflectionEntry({
        supabase: supabase as never,
        userId: "user-123",
        clientId: "client-456",
        sessionId: "session-1",
        entryText: "Fresh thought.",
      }),
    ).rejects.toThrow("Failed to save reflection entry reference");

    expect(mocks.s3Send).toHaveBeenCalledTimes(2);
    expect(mocks.s3Send.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        input: expect.objectContaining({
          Bucket: "journal-bucket",
          Key: expect.stringMatching(/^entries\/user-123\/reflection-/),
        }),
      }),
    );
  });
});
