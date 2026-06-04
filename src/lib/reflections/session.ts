import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getIngestionBucket, getS3Client } from "@/lib/aws/clients";
import {
  readEntryContentFromS3,
  type EntryReferenceWithContent,
} from "@/lib/entries/content";
import { indexEntriesWithDefaultClients } from "@/lib/entries/embedding-clients";
import type { EntryEmbeddingStatus } from "@/lib/entries/embedding-index";
import {
  generateReflectionResponse,
  getReflectionModel,
} from "@/lib/reflections/openai-client";
import { searchRelatedEntriesByVectorId } from "@/lib/reflections/pinecone-search";
import type { ReflectionResponse } from "@/lib/reflections/types";

interface IndexedEntryRow {
  entry_id: string;
  s3_key: string;
  source_file: string | null;
  entry_date: string | null;
  pinecone_vector_id: string | null;
}

interface ReflectionSessionRow {
  session_id: string;
  primary_entry_id: string;
  related_entry_ids: string[] | null;
  created_entry_id: string | null;
}

export interface ReflectionEntryPayload {
  date: string;
  entry_text: string;
  source_file: "reflection";
  entry_type: "reflection";
  reflection_context: {
    session_id: string;
    primary_entry_id: string;
    related_entry_ids: string[];
  };
}

export interface ReflectionEntrySummary {
  entry_id: string;
  entry_date: string | null;
  entry_text: string;
}

export interface ReflectionSessionResult {
  sessionId: string;
  primaryEntry: EntryReferenceWithContent;
  relatedEntries: ReflectionEntrySummary[];
  reflection: ReflectionResponse;
}

const SAFE_RANDOM_ID_PATTERN = /[^a-zA-Z0-9._-]/g;
const MAX_RANDOM_ID_LENGTH = 96;
const MAX_PRIMARY_ENTRY_ATTEMPTS = 10;

function hasEntryText(entry: EntryReferenceWithContent): boolean {
  return entry.content.entry_text.trim().length > 0;
}

async function hydrateEntryRow(
  row: IndexedEntryRow,
): Promise<EntryReferenceWithContent | null> {
  let content;

  try {
    content = await readEntryContentFromS3(row.s3_key);
  } catch (error) {
    console.warn("[reflections] skipping unreadable entry content", {
      entryId: row.entry_id,
      s3Key: row.s3_key,
      message:
        error instanceof Error ? error.message : "Unknown S3 read error.",
    });
    return null;
  }

  if (!content || !content.entry_text.trim()) {
    return null;
  }

  return {
    ...row,
    content,
  };
}

function summarizeEntry(entry: EntryReferenceWithContent): ReflectionEntrySummary {
  return {
    entry_id: entry.entry_id,
    entry_date: entry.entry_date,
    entry_text: entry.content.entry_text,
  };
}

export function buildReflectionEntryId(
  nowIso: string,
  randomId: string = randomUUID(),
): string {
  const datePrefix = nowIso.slice(0, 10);
  const safeRandomId =
    randomId.replace(SAFE_RANDOM_ID_PATTERN, "-").slice(0, MAX_RANDOM_ID_LENGTH) ||
    randomUUID();

  return `reflection-${datePrefix}-${safeRandomId}`;
}

export function buildReflectionS3Key(userId: string, entryId: string): string {
  return `entries/${userId}/${entryId}.json`;
}

export function buildRandomIndexedEntryOffset(
  entryCount: number,
  randomValue = Math.random(),
): number {
  if (!Number.isInteger(entryCount) || entryCount < 1) {
    throw new Error("entryCount must be a positive integer.");
  }

  const boundedRandom = Math.min(Math.max(randomValue, 0), 0.999999999999);
  return Math.floor(boundedRandom * entryCount);
}

export function buildReflectionEntryPayload(params: {
  date: string;
  entryText: string;
  sessionId: string;
  primaryEntryId: string;
  relatedEntryIds: string[];
}): ReflectionEntryPayload {
  return {
    date: params.date,
    entry_text: params.entryText,
    source_file: "reflection",
    entry_type: "reflection",
    reflection_context: {
      session_id: params.sessionId,
      primary_entry_id: params.primaryEntryId,
      related_entry_ids: params.relatedEntryIds,
    },
  };
}

export async function createReflectionSession(params: {
  supabase: SupabaseClient;
  userId: string;
  clientId: string;
}): Promise<ReflectionSessionResult> {
  const { count, error: countError } = await params.supabase
    .from("entries")
    .select("entry_id", { count: "exact", head: true })
    .eq("user_id", params.userId)
    .eq("embedding_status", "indexed")
    .not("pinecone_vector_id", "is", null);

  if (countError) {
    throw new Error(`Failed to count indexed entries: ${countError.message}`);
  }

  if (!count || count < 1) {
    throw new Error("Reflect needs indexed entries before it can start.");
  }

  const attemptedOffsets = new Set<number>();
  let primaryEntry: EntryReferenceWithContent | null = null;

  for (
    let attempt = 0;
    attempt < Math.min(count, MAX_PRIMARY_ENTRY_ATTEMPTS);
    attempt += 1
  ) {
    let offset = buildRandomIndexedEntryOffset(count);
    while (attemptedOffsets.has(offset) && attemptedOffsets.size < count) {
      offset = (offset + 1) % count;
    }
    attemptedOffsets.add(offset);

    const { data, error } = await params.supabase
      .from("entries")
      .select("entry_id,s3_key,source_file,entry_date,pinecone_vector_id")
      .eq("user_id", params.userId)
      .eq("embedding_status", "indexed")
      .not("pinecone_vector_id", "is", null)
      .range(offset, offset);

    if (error) {
      throw new Error(`Failed to load indexed entries: ${error.message}`);
    }

    const row = data?.[0] as IndexedEntryRow | undefined;
    if (!row) {
      continue;
    }

    const hydrated = await hydrateEntryRow(row);

    if (hydrated && hasEntryText(hydrated) && hydrated.pinecone_vector_id) {
      primaryEntry = hydrated;
      break;
    }
  }

  if (!primaryEntry) {
    throw new Error("Reflect needs indexed entries before it can start.");
  }

  const vectorId = primaryEntry.pinecone_vector_id;
  if (!vectorId) {
    throw new Error("Reflect needs indexed entries before it can start.");
  }

  // If Pinecone is unavailable, Reflect still works from the primary entry.
  const relatedMatches = await searchRelatedEntriesByVectorId({
    userId: params.userId,
    primaryEntryId: primaryEntry.entry_id,
    vectorId,
  }).catch(() => []);

  const relatedEntries: EntryReferenceWithContent[] = [];
  const seenEntryIds = new Set([primaryEntry.entry_id]);

  for (const match of relatedMatches) {
    if (!match.s3Key || seenEntryIds.has(match.entryId)) {
      continue;
    }

    const relatedEntry = await hydrateEntryRow({
      entry_id: match.entryId,
      s3_key: match.s3Key,
      source_file: null,
      entry_date: match.entryDate,
      pinecone_vector_id: null,
    });

    if (!relatedEntry || !hasEntryText(relatedEntry)) {
      continue;
    }

    seenEntryIds.add(relatedEntry.entry_id);
    relatedEntries.push(relatedEntry);

    if (relatedEntries.length >= 8) {
      break;
    }
  }

  const reflection = await generateReflectionResponse({
    primaryEntry,
    relatedEntries,
  });

  const { data: sessionRows, error: insertError } = await params.supabase
    .from("reflection_sessions")
    .insert({
      user_id: params.userId,
      client_id: params.clientId,
      primary_entry_id: primaryEntry.entry_id,
      related_entry_ids: relatedEntries.map((entry) => entry.entry_id),
      model: getReflectionModel(),
      response_json: reflection,
    })
    .select("session_id")
    .limit(1);

  if (insertError) {
    throw new Error(`Failed to store reflection session: ${insertError.message}`);
  }

  const sessionId = (sessionRows?.[0] as { session_id?: string } | undefined)
    ?.session_id;

  if (!sessionId) {
    throw new Error("Reflection session was not created.");
  }

  return {
    sessionId,
    primaryEntry,
    relatedEntries: relatedEntries.map(summarizeEntry),
    reflection,
  };
}

export async function saveReflectionEntry(params: {
  supabase: SupabaseClient;
  userId: string;
  clientId: string;
  sessionId: string;
  entryText: string;
}): Promise<{
  entry_id: string;
  s3_key: string;
  embedding_status: EntryEmbeddingStatus;
}> {
  const cleanText = params.entryText.trim();
  if (!cleanText) {
    throw new Error("entry_text is required.");
  }

  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const entryId = buildReflectionEntryId(now.toISOString());
  const s3Key = buildReflectionS3Key(params.userId, entryId);

  const { data: claimedSessions, error: claimError } = await params.supabase
    .from("reflection_sessions")
    .update({ created_entry_id: entryId })
    .eq("user_id", params.userId)
    .eq("session_id", params.sessionId)
    .is("created_entry_id", null)
    .select("session_id,primary_entry_id,related_entry_ids,created_entry_id")
    .limit(1);

  if (claimError) {
    throw new Error(`Failed to claim reflection session: ${claimError.message}`);
  }

  let session = (claimedSessions?.[0] as ReflectionSessionRow | undefined) ?? null;

  if (!session) {
    const { data: sessions, error: sessionError } = await params.supabase
      .from("reflection_sessions")
      .select("session_id,primary_entry_id,related_entry_ids,created_entry_id")
      .eq("user_id", params.userId)
      .eq("session_id", params.sessionId)
      .limit(1);

    if (sessionError) {
      throw new Error(`Failed to load reflection session: ${sessionError.message}`);
    }

    session = (sessions?.[0] as ReflectionSessionRow | undefined) ?? null;
    if (!session) {
      throw new Error("Reflection session not found.");
    }

    if (session.created_entry_id) {
      throw new Error("Reflection session already has a saved entry.");
    }

    throw new Error("Reflection session could not be claimed.");
  }

  const relatedEntryIds = session.related_entry_ids ?? [];
  const payload = buildReflectionEntryPayload({
    date,
    entryText: cleanText,
    sessionId: params.sessionId,
    primaryEntryId: session.primary_entry_id,
    relatedEntryIds,
  });

  let wroteS3Object = false;

  try {
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: getIngestionBucket(),
        Key: s3Key,
        ContentType: "application/json",
        Body: JSON.stringify(payload),
      }),
    );
    wroteS3Object = true;

    const { error: entryError } = await params.supabase.from("entries").insert({
      user_id: params.userId,
      client_id: params.clientId,
      entry_id: entryId,
      s3_key: s3Key,
      source_file: "reflection",
      entry_date: date,
      embedding_status: "pending",
    });

    if (entryError) {
      throw new Error(
        `Failed to save reflection entry reference: ${entryError.message}`,
      );
    }
  } catch (error) {
    if (wroteS3Object) {
      await getS3Client()
        .send(
          new DeleteObjectCommand({
            Bucket: getIngestionBucket(),
            Key: s3Key,
          }),
        )
        .catch((cleanupError) => {
          console.warn("[reflections] failed to clean up reflection S3 object", {
            entryId,
            s3Key,
            message:
              cleanupError instanceof Error
                ? cleanupError.message
                : "Unknown S3 cleanup error.",
          });
        });
    }

    await params.supabase
      .from("reflection_sessions")
      .update({ created_entry_id: null })
      .eq("user_id", params.userId)
      .eq("session_id", params.sessionId)
      .eq("created_entry_id", entryId);

    throw error;
  }

  let embeddingStatus: EntryEmbeddingStatus = "failed";

  try {
    const [indexResult] = await indexEntriesWithDefaultClients({
      supabase: params.supabase,
      records: [
        {
          userId: params.userId,
          clientId: params.clientId,
          entryId,
          s3Key,
          sourceFile: "reflection",
          entryDate: date,
          entryText: cleanText,
        },
      ],
    });
    embeddingStatus = indexResult?.status ?? "failed";
  } catch {
    await params.supabase
      .from("entries")
      .update({
        embedding_status: "failed",
        pinecone_vector_id: null,
        embedded_at: null,
      })
      .eq("user_id", params.userId)
      .eq("entry_id", entryId);
    embeddingStatus = "failed";
  }

  return {
    entry_id: entryId,
    s3_key: s3Key,
    embedding_status: embeddingStatus,
  };
}
