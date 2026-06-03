# Pinecone RAG Indexing Design

## Goal

Add Pinecone indexing for imported journal entries.

Every imported entry should get one OpenAI embedding [a list of numbers that represents the meaning of text] and one Pinecone vector [a searchable record made from that embedding].

Supabase stays the source of truth [the trusted main record]. Pinecone is the search index [a fast lookup layer for meaning-based search].

## Current Context

Imported entries are finalized in `src/app/api/ingestion/[ingestionId]/results/route.ts`.

That route currently:

1. Authenticates the user.
2. Loads the ingestion manifest [a JSON status file for the import job] from S3.
3. Reads extracted entry JSON from S3.
4. Splits multi-entry payloads into one S3 object per entry.
5. Upserts [inserts or updates] entry references into Supabase.
6. Returns entries and synced reference counts.

The full entry text lives in S3 [AWS file storage, like a cloud filing cabinet].

Supabase stores entry references in the `entries` table.

## Chosen Approach

Use inline indexing.

When `/api/ingestion/{ingestionId}/results` saves entries to Supabase, it should also:

1. Send each `entry_text` to OpenAI.
2. Use `text-embedding-3-small`.
3. Receive a 1536-dimension embedding [1536 numbers that describe meaning].
4. Upsert one vector per entry into Pinecone.
5. Update Supabase with the indexing status.

This is the first version.

It avoids a queue [a waiting line for background jobs] for now. A retry job can be added later.

## Data Flow

The import flow becomes:

```text
S3 extracted JSON
  -> Supabase entry row
  -> OpenAI embedding
  -> Pinecone vector
  -> Supabase indexing status
```

Think of it like a library.

Supabase is the card catalog. S3 is the shelf with the full books. OpenAI creates a meaning fingerprint. Pinecone stores that fingerprint so the app can find entries by meaning or emotion.

## Supabase Changes

Add three fields to `entries`:

```text
embedding_status text not null default 'pending'
pinecone_vector_id text
embedded_at timestamptz
```

Allowed `embedding_status` values:

```text
pending
indexed
failed
```

Do not store `embedding_model`, `embedding_dimensions`, or `embedding_error` in this first version.

The model and dimensions should live in code constants:

```ts
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;
```

## Pinecone Shape

Each entry creates one vector.

Vector ID:

```text
entry:{entry_id}
```

Namespace [a separate partition inside one Pinecone index]:

```text
user:{user_id}
```

Metadata [extra labels stored with the vector]:

```json
{
  "user_id": "...",
  "client_id": "...",
  "entry_id": "...",
  "s3_key": "...",
  "source_file": "...",
  "entry_date": "2025-02-01"
}
```

Do not store full journal text in Pinecone metadata.

Pinecone should point back to Supabase and S3. S3 should keep the full entry text.

## RAG Path

RAG means retrieval augmented generation [first find relevant saved text, then give that text to the AI model].

Future RAG flow:

1. Embed the user's current prompt.
2. Search Pinecone for nearby entry vectors.
3. Read returned metadata.
4. Load full matching entries from S3.
5. Give those entries to the AI model as context.

This design only builds indexing. The future search endpoint is out of scope for this first version.

## Error Handling

Pinecone indexing must not block import.

The results route should:

1. Save the entry row in Supabase.
2. Set `embedding_status` to `pending`.
3. Try OpenAI embedding.
4. Try Pinecone upsert.
5. If both work, set `embedding_status` to `indexed`, set `pinecone_vector_id`, and set `embedded_at`.
6. If either fails, set `embedding_status` to `failed`.

This means the user's import can still succeed if OpenAI or Pinecone is temporarily unavailable.

Retry can be added later through a route such as:

```text
POST /api/entries/reindex
```

That retry route is out of scope for this first version.

## Environment Variables

Required server-only values:

```text
OPENAI_API_KEY
PINECONE_API_KEY
PINECONE_INDEX_NAME
```

Optional value:

```text
PINECONE_NAMESPACE_PREFIX
```

Default namespace prefix:

```text
user
```

These values must stay on the server. They must not be exposed through `NEXT_PUBLIC_` variables.

## Implementation Units

Create a focused embeddings module.

It should:

1. Build vector IDs.
2. Build Pinecone namespaces.
3. Build Pinecone metadata.
4. Call OpenAI for embeddings.
5. Upsert vectors into Pinecone.
6. Update Supabase status.

The ingestion results route should call this module after Supabase rows are saved.

This keeps the route from becoming too large.

## Testing

Add Vitest [a fast JavaScript and TypeScript test runner].

Use mocks [fake services used in tests] for OpenAI and Pinecone.

Tests should cover:

1. Building a namespace from `user_id`.
2. Building a vector ID from `entry_id`.
3. Building metadata from an entry row.
4. Marking entries `indexed` after successful indexing.
5. Marking entries `failed` if OpenAI fails.
6. Marking entries `failed` if Pinecone fails.

Tests should not call real OpenAI or Pinecone.

## Out Of Scope

This first version does not include:

1. A RAG search endpoint.
2. A retry endpoint.
3. Chunking [splitting long entries into smaller searchable text pieces].
4. Storing full journal text in Pinecone metadata.
5. Background queue processing.
