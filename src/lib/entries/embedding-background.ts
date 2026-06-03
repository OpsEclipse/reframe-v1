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
    return;
  }

  schedule(async () => {
    try {
      await indexEntries({ supabase, records });
    } catch (error) {
      logError("[entry-embeddings] background indexing failed", {
        ...context,
        records: records.length,
        message: error instanceof Error ? error.message : "Unknown indexing error.",
      });
    }
  });
}
