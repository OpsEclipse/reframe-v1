# Reflect RAG Flow Design

## Goal

Build the real Reflect flow.

When the user chooses Reflect, the app should:

1. Pick an old journal entry.
2. Find related entries through RAG.
3. Generate a casual friend-style reflection.
4. Render the reflection with structured blocks.
5. Show a writing prompt.
6. Save the user's new writing directly to S3, Supabase, and Pinecone.

RAG means retrieval augmented generation [searching saved text first, then giving the best matches to the AI].

The experience should feel like the app found an old version of the user, connected it to other old moments, and handed them something worth writing from.

## Current Context

The app already has a Reflect path:

```text
Activity
  -> JournalEntryScreen
  -> ReflectionAnalysisScreen
  -> ReflectionPromptScreen
  -> WritingScreen
  -> CompletedWritingScreen
```

That path currently uses hardcoded text.

The import flow stores journal entries like this:

```text
S3 full entry JSON
  -> Supabase entry reference
  -> Pinecone vector
```

S3 is the full journal shelf.

Supabase is the card catalog [the main table of entry references].

Pinecone is the meaning search layer [a database that finds similar text by meaning].

The new Reflect save path should reuse the same shape. It should not invoke the ingestion Lambda [a cloud function used for imported files], because new writing is already structured.

## Chosen Approach

Use a server-driven Reflect session.

The client asks the server to create a reflection session. The server picks old entries, searches related entries, calls the AI model, and returns structured JSON for the UI.

After the user writes, the client asks the server to save the new reflection entry directly.

This keeps API keys [private service passwords] on the server. It also keeps the UI simple.

## User Flow

```text
Activity
  -> user selects Reflect
  -> app calls POST /api/reflections/session
  -> app shows selected primary entry
  -> app renders AI reflection blocks in model-chosen order
  -> app renders final writing prompt
  -> user writes
  -> app calls POST /api/reflections/session/{sessionId}/entry
  -> server writes S3 object
  -> server inserts Supabase entry row
  -> server indexes the new entry in Pinecone
  -> app shows completed writing screen
```

The AI reflection comes before the user writes. That is the point of the flow.

## Primary Entry Selection

The server should select a small candidate set first.

Candidate rules:

1. Only use entries owned by the current user.
2. Only use entries with `embedding_status = 'indexed'`.
3. Exclude entries with empty content.
4. Sample up to 3 candidate entries.

Then the model chooses one primary entry from that candidate set.

This gives the experience some taste. It is like handing a friend three old letters and asking which one feels alive today.

If fewer than 3 indexed entries exist, use however many indexed entries exist.

If no indexed entries exist, the server should return a useful empty state that says Reflect needs indexed entries first.

## Related Entry Search

After the primary entry is chosen:

1. Read the primary entry's saved `pinecone_vector_id`.
2. Search Pinecone in the user's namespace using that vector ID.
3. Exclude the primary entry.
4. Return the top 4 to 8 related entries.
5. Hydrate [load the full content for] those entries from S3.

This should not call OpenAI embeddings again for the primary entry.

The entry was already embedded during ingestion. The saved Pinecone vector is the reusable meaning fingerprint.

If Pinecone search is unavailable, continue with the primary entry only.

The model receives:

1. The primary entry.
2. The related entries.
3. The user's tone and style instructions.
4. The required output schema.

## AI Output Schema

The model must return only valid JSON.

JSON means structured text with named fields.

The UI renders blocks in the exact order returned by the model. The UI must not reorder past entry references.

Every `entry_reference.entry_id` must match either the primary entry ID or one of the related entry IDs. The server should reject or repair model output that references unknown entries.

```json
{
  "session_title": "A short optional title",
  "primary_entry_id": "entry_123",
  "blocks": [
    {
      "type": "paragraph",
      "text": "This old entry has this feeling where you are treating uncertainty like proof that nothing is working."
    },
    {
      "type": "entry_reference",
      "entry_id": "entry_456",
      "quote": "I keep thinking I should be further ahead by now.",
      "text": "This is the line that connects for me. It sounds like the same pressure, just at a different volume."
    },
    {
      "type": "paragraph",
      "text": "The bigger thing is that you keep judging the middle of the process like it is the final result."
    }
  ],
  "writing_prompt": {
    "text": "Where are you calling something failure just because it has not become visible yet?"
  }
}
```

### Block Rules

Allowed block types:

```text
paragraph
entry_reference
```

`paragraph` blocks render as normal reflection text.

`entry_reference` blocks render as quote moments. They contain:

1. `entry_id`
2. `quote`
3. `text`

The quote must be a short exact quote from the provided entry.

The `text` field explains why the quote matters.

The final writing prompt is outside the block list so the UI can render it differently.

## Prompt Rules

The system prompt should require:

1. Talk like an old friend.
2. Do not sound clinical.
3. Do not therapize the user.
4. Do not summarize every point.
5. Do not mirror the user's thoughts with headings.
6. Make connections the user may not see.
7. Comfort, validate, and challenge.
8. Be casual, but do not say "yo".
9. Sound close to the user's tone, without copying it.
10. Use entry references only as `entry_reference` blocks.
11. Let the model choose where entry references appear.
12. End with one writing prompt.

The model should write enough to feel meaningful. It should not be a tiny insight card.

## Session Storage

Create a `reflection_sessions` table.

It stores the generated reflection and the source entries used to make it.

Required fields:

```text
session_id uuid primary key
user_id uuid
client_id uuid
primary_entry_id text
related_entry_ids text[]
model text
response_json jsonb
created_entry_id text null
created_at timestamptz
updated_at timestamptz
```

This is useful because the save request should not trust the browser to resend source context.

Think of it like a receipt. The server remembers what it showed the user.

## Direct Writing Save

When the user finishes writing, save a new structured entry.

No Lambda is needed.

The S3 object should look like this:

```json
{
  "date": "2026-06-03",
  "entry_text": "User writing goes here.",
  "source_file": "reflection",
  "entry_type": "reflection",
  "reflection_context": {
    "session_id": "session uuid",
    "primary_entry_id": "entry_123",
    "related_entry_ids": ["entry_456", "entry_789"]
  }
}
```

The S3 key should follow the existing entry path rule:

```text
entries/{user_id}/{entry_id}.json
```

Then insert one row into Supabase `entries`.

Then index the new entry in Pinecone.

If Pinecone indexing fails, saving should still succeed. The row should be marked `embedding_status = 'failed'`.

## API Design

### Create Reflection Session

```text
POST /api/reflections/session
```

Response:

```json
{
  "session_id": "uuid",
  "primary_entry": {
    "entry_id": "entry_123",
    "entry_date": "2025-02-01",
    "entry_text": "..."
  },
  "related_entries": [
    {
      "entry_id": "entry_456",
      "entry_date": "2025-04-10"
    }
  ],
  "reflection": {
    "session_title": "A short optional title",
    "primary_entry_id": "entry_123",
    "blocks": [],
    "writing_prompt": {
      "text": "..."
    }
  }
}
```

The client should not receive full related entries unless the UI needs them.

### Save Reflection Writing

```text
POST /api/reflections/session/{sessionId}/entry
```

Request:

```json
{
  "entry_text": "User writing goes here."
}
```

Response:

```json
{
  "entry_id": "reflection-...",
  "s3_key": "entries/{user_id}/{entry_id}.json",
  "embedding_status": "indexed"
}
```

## Error Handling

If there are no entries:

The UI should show a gentle state that says Reflect needs imported entries first.

If RAG search fails:

Use the primary entry only. The reflection can still work.

If AI JSON parsing fails:

Retry once with a repair prompt [a second prompt asking the model to fix invalid JSON].

If saving to S3 fails:

Do not insert the Supabase row.

If Supabase insert fails:

Return an error. Do not pretend the writing was saved.

If Pinecone indexing fails:

Return success with `embedding_status = 'failed'`.

## UI Changes

`JournalEntryScreen` should render the selected primary entry.

`ReflectionAnalysisScreen` should render structured blocks:

1. Normal paragraphs for `paragraph`.
2. Quote blocks for `entry_reference`.
3. The final prompt as a distinct writing prompt.

`WritingScreen` should receive the generated writing prompt.

`CompletedWritingScreen` should save through the new reflection save endpoint when the writing came from a Reflect session.

## Testing

Add tests for:

1. The reflection schema parser.
2. Rejecting invalid model JSON.
3. Preserving the model's block order.
4. Rejecting entry references that use unknown entry IDs.
5. Saving direct reflection entries to the expected S3 key.
6. Inserting the expected Supabase row.
7. Continuing save success when Pinecone indexing fails.

Use mocks [fake services used in tests] for OpenAI, Pinecone, S3, and Supabase.

Tests must not call real services.

## Out Of Scope

This design does not include:

1. Editing old entries.
2. A daily precomputed reflection.
3. User controls for selecting the primary entry.
4. Changing the import Lambda.
5. Multi-entry user writing.
6. Public sharing.
