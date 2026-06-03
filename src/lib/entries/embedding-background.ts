import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  indexEntriesWithDefaultClients,
  type IndexEntriesWithDefaultClients,
} from "@/lib/entries/embedding-clients";
import type { EntryEmbeddingRecord } from "@/lib/entries/embedding-index";

interface ScheduleEntryEmbeddingIndexingParams {
  supabase: SupabaseClient;
  records: EntryEmbeddingRecord[];
  context?: Record<string, string | number | boolean | null>;
  schedule?: (task: () => void | Promise<void>) => void;
  indexEntries?: IndexEntriesWithDefaultClients;
  logError?: (message: string, details: Record<string, unknown>) => void;
}

export function scheduleEntryEmbeddingIndexing({
  supabase,
  records,
  context = {},
  schedule = after,
  indexEntries = indexEntriesWithDefaultClients,
  logError = console.error,
}: ScheduleEntryEmbeddingIndexingParams): void {
  if (records.length === 0) {
    console.log("[entry-embeddings] no records queued for indexing", {
      ...context,
    });
    return;
  }

  console.log("[entry-embeddings] scheduling background indexing", {
    ...context,
    records: records.length,
    entryIds: records.slice(0, 10).map((record) => record.entryId),
  });

  schedule(async () => {
    console.log("[entry-embeddings] background indexing started", {
      ...context,
      records: records.length,
    });

    try {
      const results = await indexEntries({ supabase, records });
      console.log("[entry-embeddings] background indexing completed", {
        ...context,
        indexed: results.filter((result) => result.status === "indexed").length,
        failed: results.filter((result) => result.status === "failed").length,
      });
    } catch (error) {
      logError("[entry-embeddings] background indexing failed", {
        ...context,
        records: records.length,
        message: error instanceof Error ? error.message : "Unknown indexing error.",
      });
    }
  });
}
