import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { scheduleEntryEmbeddingIndexing } from "@/lib/entries/embedding-background";
import type { EntryEmbeddingRecord } from "@/lib/entries/embedding-index";

function createRecord(
  overrides: Partial<EntryEmbeddingRecord> = {},
): EntryEmbeddingRecord {
  return {
    userId: "user-123",
    clientId: "client-456",
    entryId: "entry-abc",
    s3Key: "entries/user-123/file.json",
    sourceFile: "journal.pdf",
    entryDate: "2025-02-01",
    entryText: "I felt hopeful after a hard week.",
    ...overrides,
  };
}

describe("scheduleEntryEmbeddingIndexing", () => {
  it("schedules indexing without running it synchronously", async () => {
    const scheduledTasks: Array<() => void | Promise<void>> = [];
    const supabase = {} as SupabaseClient;
    const records = [createRecord()];
    const indexEntries = vi.fn(async () => []);

    scheduleEntryEmbeddingIndexing({
      supabase,
      records,
      schedule: (task) => {
        scheduledTasks.push(task);
      },
      indexEntries,
    });

    expect(indexEntries).not.toHaveBeenCalled();
    expect(scheduledTasks).toHaveLength(1);

    await scheduledTasks[0]();

    expect(indexEntries).toHaveBeenCalledWith({
      supabase,
      records,
    });
  });

  it("does not schedule work when there are no records", () => {
    const schedule = vi.fn();

    scheduleEntryEmbeddingIndexing({
      supabase: {} as SupabaseClient,
      records: [],
      schedule,
    });

    expect(schedule).not.toHaveBeenCalled();
  });

  it("logs background indexing errors without rethrowing", async () => {
    const scheduledTasks: Array<() => void | Promise<void>> = [];
    const logError = vi.fn();
    const indexEntries = vi.fn(async () => {
      throw new Error("Pinecone unavailable");
    });

    scheduleEntryEmbeddingIndexing({
      supabase: {} as SupabaseClient,
      records: [createRecord()],
      context: {
        ingestionId: "11111111-1111-1111-1111-111111111111",
      },
      schedule: (task) => {
        scheduledTasks.push(task);
      },
      indexEntries,
      logError,
    });

    await expect(scheduledTasks[0]()).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalledWith(
      "[entry-embeddings] background indexing failed",
      {
        ingestionId: "11111111-1111-1111-1111-111111111111",
        records: 1,
        message: "Pinecone unavailable",
      },
    );
  });
});
