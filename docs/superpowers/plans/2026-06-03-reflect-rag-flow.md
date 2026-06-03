# Reflect RAG Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Reflect flow that picks an indexed old journal entry, finds related entries through Pinecone, generates structured JSON from OpenAI, renders it, then saves the user's response directly to S3, Supabase, and Pinecone.

**Architecture:** Supabase remains the source of truth [the main trusted record list]. S3 stores the full entry JSON. Pinecone stores meaning vectors [numeric fingerprints of text meaning] and is searched by the selected entry's existing vector ID. OpenAI returns a structured JSON response [machine-readable data with named fields] that the UI renders in model-chosen order.

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase, AWS S3, Pinecone, OpenAI Responses API, Vitest.

---

## Prerequisite

Before this plan is executed, complete the existing indexing plan:

```text
docs/superpowers/plans/2026-06-03-pinecone-rag-indexing.md
```

This Reflect plan expects these files and fields to exist:

```text
src/lib/entries/embedding-index.ts
src/lib/entries/embedding-clients.ts
migrations/007_add_entry_embedding_status.sql
entries.embedding_status
entries.pinecone_vector_id
entries.embedded_at
```

The Reflect search must not call OpenAI embeddings for the old primary entry. It reuses `entries.pinecone_vector_id`.

## File Structure

- Create: `migrations/008_create_reflection_sessions.sql`
  - Stores generated reflection sessions and source entry IDs.
- Create: `src/lib/entries/content.ts`
  - Reads full entry JSON from S3 and normalizes it into one `ExtractedEntry`.
- Create: `src/lib/reflections/types.ts`
  - Defines reflection JSON types and parser helpers.
- Create: `src/lib/reflections/types.test.ts`
  - Tests schema parsing, block order, and unknown entry references.
- Create: `src/lib/reflections/prompt.ts`
  - Builds OpenAI instructions and input payload text.
- Create: `src/lib/reflections/openai-client.ts`
  - Calls OpenAI Responses API with Structured Outputs [schema-locked JSON output].
- Create: `src/lib/reflections/pinecone-search.ts`
  - Searches Pinecone using an existing vector ID.
- Create: `src/lib/reflections/session.ts`
  - Coordinates primary selection, related search, model generation, session persistence, and direct save.
- Create: `src/lib/reflections/session.test.ts`
  - Tests selection rules, direct save shape, S3 key, and Pinecone failure behavior.
- Create: `src/app/api/reflections/session/route.ts`
  - Creates a reflection session.
- Create: `src/app/api/reflections/session/[sessionId]/entry/route.ts`
  - Saves the user's reflection writing.
- Modify: `src/app/App.tsx`
  - Stores active reflection session state and routes screen data.
- Modify: `src/app/components/JournalEntryScreen.tsx`
  - Renders the dynamic primary entry.
- Modify: `src/app/components/ReflectionAnalysisScreen.tsx`
  - Renders structured blocks instead of hardcoded analysis.
- Modify: `src/app/components/ReflectionPromptScreen.tsx`
  - Renders the generated writing prompt.
- Modify: `src/app/components/CompletedWritingScreen.tsx`
  - Supports async save before completion when used by Reflect.
- Modify: `README.md`
  - Documents required Reflect env vars.

Reference docs:

- OpenAI Structured Outputs: `https://platform.openai.com/docs/guides/structured-outputs`
- OpenAI Responses API: `https://platform.openai.com/docs/api-reference/responses`
- Pinecone query API: `https://docs.pinecone.io/reference/query`
- Pinecone fetch API: `https://docs.pinecone.io/guides/manage-data/fetch-data`

---

### Task 1: Verify Indexing Prerequisite And Add Reflection Sessions Table

**Files:**
- Create: `migrations/008_create_reflection_sessions.sql`

- [ ] **Step 1: Verify prerequisite files exist**

Run:

```bash
test -f src/lib/entries/embedding-index.ts
test -f src/lib/entries/embedding-clients.ts
test -f migrations/007_add_entry_embedding_status.sql
```

Expected: all commands exit with status `0`.

If any command fails, stop and execute:

```bash
docs/superpowers/plans/2026-06-03-pinecone-rag-indexing.md
```

- [ ] **Step 2: Create the session migration**

Create `migrations/008_create_reflection_sessions.sql`:

```sql
-- Store generated Reflect sessions and the entries used to create them.

create table if not exists public.reflection_sessions (
  session_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid references public.clients (client_id) on delete set null,
  primary_entry_id text not null,
  related_entry_ids text[] not null default '{}'::text[],
  model text not null,
  response_json jsonb not null,
  created_entry_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reflection_sessions_user_created
on public.reflection_sessions (user_id, created_at desc);

drop trigger if exists set_reflection_sessions_updated_at on public.reflection_sessions;
create trigger set_reflection_sessions_updated_at
before update on public.reflection_sessions
for each row
execute function public.set_updated_at();

alter table public.reflection_sessions enable row level security;

drop policy if exists "reflection_sessions_select_own" on public.reflection_sessions;
create policy "reflection_sessions_select_own"
on public.reflection_sessions
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "reflection_sessions_insert_own" on public.reflection_sessions;
create policy "reflection_sessions_insert_own"
on public.reflection_sessions
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "reflection_sessions_update_own" on public.reflection_sessions;
create policy "reflection_sessions_update_own"
on public.reflection_sessions
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
```

- [ ] **Step 3: Verify migration text**

Run:

```bash
rg "reflection_sessions|response_json|related_entry_ids|created_entry_id" migrations/008_create_reflection_sessions.sql
```

Expected: all four names appear.

- [ ] **Step 4: Commit migration**

Run:

```bash
git add migrations/008_create_reflection_sessions.sql
git commit -m "feat: add reflection session storage" -m "Store generated Reflect sessions and their source entry IDs."
```

---

### Task 2: Add Reflection JSON Types And Parser

**Files:**
- Create: `src/lib/reflections/types.test.ts`
- Create: `src/lib/reflections/types.ts`

- [ ] **Step 1: Write failing parser tests**

Create `src/lib/reflections/types.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseReflectionResponse } from "@/lib/reflections/types";

describe("parseReflectionResponse", () => {
  it("preserves block order", () => {
    const parsed = parseReflectionResponse(
      {
        session_title: "Old pressure",
        primary_entry_id: "entry-a",
        blocks: [
          { type: "paragraph", text: "First." },
          {
            type: "entry_reference",
            entry_id: "entry-b",
            quote: "I should be further ahead.",
            text: "Second.",
          },
          { type: "paragraph", text: "Third." },
        ],
        writing_prompt: {
          text: "What are you calling failure too early?",
        },
      },
      new Set(["entry-a", "entry-b"]),
    );

    expect(parsed.blocks.map((block) => block.type)).toEqual([
      "paragraph",
      "entry_reference",
      "paragraph",
    ]);
  });

  it("rejects unknown entry references", () => {
    expect(() =>
      parseReflectionResponse(
        {
          primary_entry_id: "entry-a",
          blocks: [
            {
              type: "entry_reference",
              entry_id: "entry-x",
              quote: "Not provided.",
              text: "This should fail.",
            },
          ],
          writing_prompt: {
            text: "Write from here.",
          },
        },
        new Set(["entry-a"]),
      ),
    ).toThrow("unknown entry_id");
  });

  it("rejects empty writing prompts", () => {
    expect(() =>
      parseReflectionResponse(
        {
          primary_entry_id: "entry-a",
          blocks: [{ type: "paragraph", text: "Fine." }],
          writing_prompt: { text: "" },
        },
        new Set(["entry-a"]),
      ),
    ).toThrow("writing_prompt.text");
  });
});
```

- [ ] **Step 2: Run parser tests to verify they fail**

Run:

```bash
npm test -- src/lib/reflections/types.test.ts
```

Expected: FAIL because `src/lib/reflections/types.ts` does not exist.

- [ ] **Step 3: Implement parser**

Create `src/lib/reflections/types.ts`:

```ts
export type ReflectionBlock =
  | {
      type: "paragraph";
      text: string;
    }
  | {
      type: "entry_reference";
      entry_id: string;
      quote: string;
      text: string;
    };

export interface ReflectionResponse {
  session_title?: string;
  primary_entry_id: string;
  blocks: ReflectionBlock[];
  writing_prompt: {
    text: string;
  };
}

function assertObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function readRequiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return value.trim();
}

function parseBlock(value: unknown, allowedEntryIds: Set<string>): ReflectionBlock {
  const block = assertObject(value, "block");
  const type = readRequiredString(block.type, "block.type");

  if (type === "paragraph") {
    return {
      type,
      text: readRequiredString(block.text, "paragraph.text"),
    };
  }

  if (type === "entry_reference") {
    const entryId = readRequiredString(block.entry_id, "entry_reference.entry_id");
    if (!allowedEntryIds.has(entryId)) {
      throw new Error(`entry_reference has unknown entry_id: ${entryId}`);
    }

    return {
      type,
      entry_id: entryId,
      quote: readRequiredString(block.quote, "entry_reference.quote"),
      text: readRequiredString(block.text, "entry_reference.text"),
    };
  }

  throw new Error(`Unsupported reflection block type: ${type}`);
}

export function parseReflectionResponse(
  value: unknown,
  allowedEntryIds: Set<string>,
): ReflectionResponse {
  const root = assertObject(value, "reflection response");
  const primaryEntryId = readRequiredString(root.primary_entry_id, "primary_entry_id");

  if (!allowedEntryIds.has(primaryEntryId)) {
    throw new Error(`primary_entry_id is unknown: ${primaryEntryId}`);
  }

  if (!Array.isArray(root.blocks) || root.blocks.length === 0) {
    throw new Error("blocks must be a non-empty array.");
  }

  const writingPrompt = assertObject(root.writing_prompt, "writing_prompt");

  const parsed: ReflectionResponse = {
    primary_entry_id: primaryEntryId,
    blocks: root.blocks.map((block) => parseBlock(block, allowedEntryIds)),
    writing_prompt: {
      text: readRequiredString(writingPrompt.text, "writing_prompt.text"),
    },
  };

  if (typeof root.session_title === "string" && root.session_title.trim()) {
    parsed.session_title = root.session_title.trim();
  }

  return parsed;
}
```

- [ ] **Step 4: Run parser tests**

Run:

```bash
npm test -- src/lib/reflections/types.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit parser**

Run:

```bash
git add src/lib/reflections/types.ts src/lib/reflections/types.test.ts
git commit -m "feat: add reflection response parser" -m "Validate structured AI reflection JSON and preserve block order for rendering."
```

---

### Task 3: Add Entry Content Loader

**Files:**
- Create: `src/lib/entries/content.ts`

- [ ] **Step 1: Create entry content loader**

Create `src/lib/entries/content.ts`:

```ts
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getIngestionBucket, getS3Client } from "@/lib/aws/clients";
import type { ExtractedEntry } from "@/lib/ingestion/types";

export interface EntryReferenceWithContent {
  entry_id: string;
  s3_key: string;
  source_file: string | null;
  entry_date: string | null;
  pinecone_vector_id?: string | null;
  content: ExtractedEntry;
}

async function bodyToString(body: unknown): Promise<string> {
  if (!body) return "";

  const transformable = body as { transformToString?: () => Promise<string> };
  if (typeof transformable.transformToString === "function") {
    return transformable.transformToString();
  }

  if (typeof body === "string") return body;
  if (body instanceof Uint8Array) return Buffer.from(body).toString("utf8");

  const iterable = body as AsyncIterable<Uint8Array | string>;
  if (typeof iterable[Symbol.asyncIterator] === "function") {
    const chunks: Uint8Array[] = [];
    for await (const chunk of iterable) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks).toString("utf8");
  }

  throw new Error("Unsupported S3 body format.");
}

function isExtractedEntry(value: unknown): value is ExtractedEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as ExtractedEntry;
  return (
    (typeof entry.date === "string" || entry.date === null) &&
    typeof entry.entry_text === "string" &&
    typeof entry.source_file === "string"
  );
}

export function normalizeEntryPayload(payload: unknown): ExtractedEntry | null {
  if (isExtractedEntry(payload)) return payload;

  if (Array.isArray(payload)) {
    return payload.find(isExtractedEntry) ?? null;
  }

  const wrapper = payload as { entries?: unknown[] };
  if (Array.isArray(wrapper?.entries)) {
    return wrapper.entries.find(isExtractedEntry) ?? null;
  }

  return null;
}

export async function readEntryContentFromS3(s3Key: string): Promise<ExtractedEntry | null> {
  const object = await getS3Client().send(
    new GetObjectCommand({
      Bucket: getIngestionBucket(),
      Key: s3Key,
    }),
  );

  const raw = await bodyToString(object.Body);
  if (!raw) return null;

  return normalizeEntryPayload(JSON.parse(raw));
}
```

- [ ] **Step 2: Run TypeScript check**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Commit content loader**

Run:

```bash
git add src/lib/entries/content.ts
git commit -m "feat: add entry content loader" -m "Read full journal entry JSON from S3 for Reflect session generation."
```

---

### Task 4: Add Pinecone Related Entry Search

**Files:**
- Create: `src/lib/reflections/pinecone-search.ts`

- [ ] **Step 1: Create Pinecone search helper**

Create `src/lib/reflections/pinecone-search.ts`:

```ts
import { Pinecone } from "@pinecone-database/pinecone";
import { buildPineconeNamespace } from "@/lib/entries/embedding-index";

let pineconeClient: Pinecone | null = null;

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getPineconeClient(): Pinecone {
  if (!pineconeClient) {
    pineconeClient = new Pinecone({
      apiKey: getRequiredEnv("PINECONE_API_KEY"),
    });
  }

  return pineconeClient;
}

export interface RelatedEntryMatch {
  entryId: string;
  score: number;
  s3Key: string | null;
}

export async function searchRelatedEntriesByVectorId(params: {
  userId: string;
  primaryEntryId: string;
  vectorId: string;
  topK?: number;
}): Promise<RelatedEntryMatch[]> {
  const index = getPineconeClient().index(getRequiredEnv("PINECONE_INDEX_NAME"));
  const namespace = buildPineconeNamespace(
    params.userId,
    process.env.PINECONE_NAMESPACE_PREFIX || "user",
  );

  const result = await index.namespace(namespace).query({
    id: params.vectorId,
    topK: params.topK ?? 9,
    includeMetadata: true,
    includeValues: false,
  });

  return (result.matches ?? [])
    .map((match) => {
      const metadata = match.metadata as Record<string, unknown> | undefined;
      const entryId = typeof metadata?.entry_id === "string" ? metadata.entry_id : null;
      const s3Key = typeof metadata?.s3_key === "string" ? metadata.s3_key : null;

      if (!entryId || entryId === params.primaryEntryId) return null;

      return {
        entryId,
        s3Key,
        score: typeof match.score === "number" ? match.score : 0,
      };
    })
    .filter((match): match is RelatedEntryMatch => match !== null)
    .slice(0, 8);
}
```

- [ ] **Step 2: Run TypeScript check**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Commit Pinecone search helper**

Run:

```bash
git add src/lib/reflections/pinecone-search.ts
git commit -m "feat: add related entry vector search" -m "Search Pinecone for Reflect context using an existing entry vector ID."
```

---

### Task 5: Add Prompt Builder And OpenAI Structured Output Client

**Files:**
- Create: `src/lib/reflections/prompt.ts`
- Create: `src/lib/reflections/openai-client.ts`

- [ ] **Step 1: Create prompt builder**

Create `src/lib/reflections/prompt.ts`:

```ts
import type { EntryReferenceWithContent } from "@/lib/entries/content";

export const REFLECTION_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["primary_entry_id", "blocks", "writing_prompt"],
  properties: {
    session_title: { type: "string" },
    primary_entry_id: { type: "string" },
    blocks: {
      type: "array",
      minItems: 3,
      maxItems: 10,
      items: {
        oneOf: [
          {
            type: "object",
            additionalProperties: false,
            required: ["type", "text"],
            properties: {
              type: { const: "paragraph" },
              text: { type: "string" },
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["type", "entry_id", "quote", "text"],
            properties: {
              type: { const: "entry_reference" },
              entry_id: { type: "string" },
              quote: { type: "string" },
              text: { type: "string" },
            },
          },
        ],
      },
    },
    writing_prompt: {
      type: "object",
      additionalProperties: false,
      required: ["text"],
      properties: {
        text: { type: "string" },
      },
    },
  },
} as const;

export function buildReflectionInstructions(): string {
  return [
    "You are helping the user reflect on old journal entries.",
    "Talk like an old friend.",
    "Do not sound clinical.",
    "Do not therapize the user.",
    "Do not summarize every point.",
    "Do not mirror the user's thoughts with headings.",
    "Make connections the user may not see.",
    "Comfort, validate, and challenge.",
    "Be casual, but do not say yo.",
    "Sound close to the user's tone, without copying it.",
    "Use entry references only as entry_reference blocks.",
    "Let the narrative decide where entry_reference blocks appear.",
    "End with exactly one writing prompt.",
    "Return only JSON that matches the supplied schema.",
  ].join("\n");
}

function formatEntry(label: string, entry: EntryReferenceWithContent): string {
  return [
    `${label}:`,
    `entry_id: ${entry.entry_id}`,
    `entry_date: ${entry.entry_date ?? entry.content.date ?? "unknown"}`,
    `entry_text: ${entry.content.entry_text}`,
  ].join("\n");
}

export function buildReflectionInput(params: {
  primaryEntry: EntryReferenceWithContent;
  relatedEntries: EntryReferenceWithContent[];
}): string {
  const related = params.relatedEntries.map((entry, index) =>
    formatEntry(`Related entry ${index + 1}`, entry),
  );

  return [
    formatEntry("Primary entry", params.primaryEntry),
    "",
    "Related entries:",
    related.length > 0 ? related.join("\n\n") : "No related entries were available.",
  ].join("\n");
}
```

- [ ] **Step 2: Create OpenAI client**

Create `src/lib/reflections/openai-client.ts`:

```ts
import OpenAI from "openai";
import { parseReflectionResponse, type ReflectionResponse } from "@/lib/reflections/types";
import {
  buildReflectionInput,
  buildReflectionInstructions,
  REFLECTION_RESPONSE_SCHEMA,
} from "@/lib/reflections/prompt";
import type { EntryReferenceWithContent } from "@/lib/entries/content";

let openAIClient: OpenAI | null = null;

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getOpenAIClient(): OpenAI {
  if (!openAIClient) {
    openAIClient = new OpenAI({
      apiKey: getRequiredEnv("OPENAI_API_KEY"),
    });
  }

  return openAIClient;
}

export function getReflectionModel(): string {
  return process.env.OPENAI_REFLECTION_MODEL || "gpt-5.2";
}

export async function generateReflectionResponse(params: {
  primaryEntry: EntryReferenceWithContent;
  relatedEntries: EntryReferenceWithContent[];
}): Promise<ReflectionResponse> {
  const allowedEntryIds = new Set([
    params.primaryEntry.entry_id,
    ...params.relatedEntries.map((entry) => entry.entry_id),
  ]);

  const response = await getOpenAIClient().responses.create({
    model: getReflectionModel(),
    instructions: buildReflectionInstructions(),
    input: buildReflectionInput(params),
    text: {
      format: {
        type: "json_schema",
        name: "reflect_response",
        strict: true,
        schema: REFLECTION_RESPONSE_SCHEMA,
      },
    },
  });

  const raw = response.output_text;
  if (!raw) {
    throw new Error("OpenAI did not return reflection JSON.");
  }

  return parseReflectionResponse(JSON.parse(raw) as unknown, allowedEntryIds);
}
```

- [ ] **Step 3: Run TypeScript check**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit prompt and OpenAI client**

Run:

```bash
git add src/lib/reflections/prompt.ts src/lib/reflections/openai-client.ts
git commit -m "feat: add structured reflection generation" -m "Use OpenAI Structured Outputs to generate renderable Reflect JSON."
```

---

### Task 6: Add Reflection Session Orchestration

**Files:**
- Create: `src/lib/reflections/session.test.ts`
- Create: `src/lib/reflections/session.ts`

- [ ] **Step 1: Write direct save tests**

Create `src/lib/reflections/session.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildReflectionEntryId, buildReflectionEntryPayload, buildReflectionS3Key } from "@/lib/reflections/session";

describe("reflection direct save helpers", () => {
  it("builds a stable reflection entry id prefix", () => {
    expect(buildReflectionEntryId("2026-06-03T12:00:00.000Z")).toMatch(/^reflection-2026-06-03-/);
  });

  it("builds a flat entries S3 key", () => {
    expect(buildReflectionS3Key("user-123", "reflection-abc")).toBe("entries/user-123/reflection-abc.json");
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- src/lib/reflections/session.test.ts
```

Expected: FAIL because `src/lib/reflections/session.ts` does not exist.

- [ ] **Step 3: Implement session orchestration**

Create `src/lib/reflections/session.ts`:

```ts
import { PutObjectCommand } from "@aws-sdk/client-s3";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { getIngestionBucket, getS3Client } from "@/lib/aws/clients";
import { readEntryContentFromS3, type EntryReferenceWithContent } from "@/lib/entries/content";
import { indexEntriesWithDefaultClients } from "@/lib/entries/embedding-clients";
import { generateReflectionResponse, getReflectionModel } from "@/lib/reflections/openai-client";
import { searchRelatedEntriesByVectorId } from "@/lib/reflections/pinecone-search";
import type { ReflectionResponse } from "@/lib/reflections/types";

interface EntryRow {
  entry_id: string;
  s3_key: string;
  source_file: string | null;
  entry_date: string | null;
  pinecone_vector_id: string | null;
}

export interface ReflectionSessionResult {
  sessionId: string;
  primaryEntry: EntryReferenceWithContent;
  relatedEntries: Array<Pick<EntryReferenceWithContent, "entry_id" | "entry_date">>;
  reflection: ReflectionResponse;
}

export function buildReflectionEntryId(nowIso: string): string {
  const digest = createHash("sha256").update(`${nowIso}-${crypto.randomUUID()}`).digest("hex").slice(0, 10);
  return `reflection-${nowIso.slice(0, 10)}-${digest}`;
}

export function buildReflectionS3Key(userId: string, entryId: string): string {
  return `entries/${userId}/${entryId}.json`;
}

export function buildReflectionEntryPayload(params: {
  date: string;
  entryText: string;
  sessionId: string;
  primaryEntryId: string;
  relatedEntryIds: string[];
}) {
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

async function hydrateRow(row: EntryRow): Promise<EntryReferenceWithContent | null> {
  const content = await readEntryContentFromS3(row.s3_key);
  if (!content || !content.entry_text.trim()) return null;

  return {
    entry_id: row.entry_id,
    s3_key: row.s3_key,
    source_file: row.source_file,
    entry_date: row.entry_date,
    pinecone_vector_id: row.pinecone_vector_id,
    content,
  };
}

export async function createReflectionSession(params: {
  supabase: SupabaseClient;
  userId: string;
  clientId: string;
}): Promise<ReflectionSessionResult> {
  const { data, error } = await params.supabase
    .from("entries")
    .select("entry_id,s3_key,source_file,entry_date,pinecone_vector_id")
    .eq("user_id", params.userId)
    .eq("embedding_status", "indexed")
    .not("pinecone_vector_id", "is", null)
    .limit(50);

  if (error) throw new Error(`Failed to load indexed entries: ${error.message}`);

  const rows = ((data ?? []) as EntryRow[]).sort(() => Math.random() - 0.5).slice(0, 3);
  const hydrated = (await Promise.all(rows.map(hydrateRow))).filter(
    (entry): entry is EntryReferenceWithContent => entry !== null,
  );

  if (hydrated.length === 0) {
    throw new Error("Reflect needs indexed entries before it can start.");
  }

  const selectorReflection = await generateReflectionResponse({
    primaryEntry: hydrated[0],
    relatedEntries: hydrated.slice(1),
  });

  const primaryEntry =
    hydrated.find((entry) => entry.entry_id === selectorReflection.primary_entry_id) ?? hydrated[0];

  const relatedMatches = await searchRelatedEntriesByVectorId({
    userId: params.userId,
    primaryEntryId: primaryEntry.entry_id,
    vectorId: primaryEntry.pinecone_vector_id ?? "",
  }).catch(() => []);

  const relatedRows = relatedMatches
    .filter((match) => match.s3Key)
    .map((match) => ({
      entry_id: match.entryId,
      s3_key: match.s3Key as string,
      source_file: null,
      entry_date: null,
      pinecone_vector_id: null,
    }));

  const relatedEntries = (await Promise.all(relatedRows.map(hydrateRow))).filter(
    (entry): entry is EntryReferenceWithContent => entry !== null,
  );

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

  if (insertError) throw new Error(`Failed to store reflection session: ${insertError.message}`);

  const sessionId = (sessionRows?.[0] as { session_id?: string } | undefined)?.session_id;
  if (!sessionId) throw new Error("Reflection session was not created.");

  return {
    sessionId,
    primaryEntry,
    relatedEntries: relatedEntries.map((entry) => ({
      entry_id: entry.entry_id,
      entry_date: entry.entry_date,
    })),
    reflection,
  };
}

export async function saveReflectionEntry(params: {
  supabase: SupabaseClient;
  userId: string;
  clientId: string;
  sessionId: string;
  entryText: string;
}) {
  const cleanText = params.entryText.trim();
  if (!cleanText) throw new Error("entry_text is required.");

  const { data: sessions, error: sessionError } = await params.supabase
    .from("reflection_sessions")
    .select("session_id,primary_entry_id,related_entry_ids,created_entry_id")
    .eq("user_id", params.userId)
    .eq("session_id", params.sessionId)
    .limit(1);

  if (sessionError) throw new Error(`Failed to load reflection session: ${sessionError.message}`);

  const session = sessions?.[0] as
    | {
        session_id: string;
        primary_entry_id: string;
        related_entry_ids: string[];
        created_entry_id: string | null;
      }
    | undefined;

  if (!session) throw new Error("Reflection session not found.");
  if (session.created_entry_id) throw new Error("Reflection session already has a saved entry.");

  const now = new Date();
  const entryId = buildReflectionEntryId(now.toISOString());
  const s3Key = buildReflectionS3Key(params.userId, entryId);
  const payload = buildReflectionEntryPayload({
    date: now.toISOString().slice(0, 10),
    entryText: cleanText,
    sessionId: params.sessionId,
    primaryEntryId: session.primary_entry_id,
    relatedEntryIds: session.related_entry_ids,
  });

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: getIngestionBucket(),
      Key: s3Key,
      ContentType: "application/json",
      Body: JSON.stringify(payload),
    }),
  );

  const { error: entryError } = await params.supabase.from("entries").insert({
    user_id: params.userId,
    client_id: params.clientId,
    entry_id: entryId,
    s3_key: s3Key,
    source_file: "reflection",
    entry_date: payload.date,
    embedding_status: "pending",
  });

  if (entryError) throw new Error(`Failed to save reflection entry reference: ${entryError.message}`);

  const [indexResult] = await indexEntriesWithDefaultClients({
    supabase: params.supabase,
    namespaceUserId: params.userId,
    records: [
      {
        userId: params.userId,
        clientId: params.clientId,
        entryId,
        s3Key,
        sourceFile: "reflection",
        entryDate: payload.date,
        entryText: cleanText,
      },
    ],
  }).catch(() => [{ status: "failed" as const }]);

  await params.supabase
    .from("reflection_sessions")
    .update({ created_entry_id: entryId })
    .eq("user_id", params.userId)
    .eq("session_id", params.sessionId);

  return {
    entry_id: entryId,
    s3_key: s3Key,
    embedding_status: indexResult?.status ?? "failed",
  };
}
```

- [ ] **Step 4: Run session tests**

Run:

```bash
npm test -- src/lib/reflections/session.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit session orchestration**

Run:

```bash
git add src/lib/reflections/session.ts src/lib/reflections/session.test.ts
git commit -m "feat: add reflection session orchestration" -m "Create Reflect sessions and save new reflection writing directly to storage and indexing."
```

---

### Task 7: Add Reflection API Routes

**Files:**
- Create: `src/app/api/reflections/session/route.ts`
- Create: `src/app/api/reflections/session/[sessionId]/entry/route.ts`

- [ ] **Step 1: Create session route**

Create `src/app/api/reflections/session/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getIngestionActor } from "@/lib/ingestion/auth";
import { createReflectionSession } from "@/lib/reflections/session";

export const runtime = "nodejs";

export async function POST() {
  try {
    const actor = await getIngestionActor();
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const session = await createReflectionSession({
      supabase: actor.supabase,
      userId: actor.user.id,
      clientId: actor.clientId,
    });

    return NextResponse.json({
      session_id: session.sessionId,
      primary_entry: {
        entry_id: session.primaryEntry.entry_id,
        entry_date: session.primaryEntry.entry_date,
        entry_text: session.primaryEntry.content.entry_text,
      },
      related_entries: session.relatedEntries,
      reflection: session.reflection,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create reflection session.";
    const status = message.includes("Reflect needs indexed entries") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
```

- [ ] **Step 2: Create save route**

Create `src/app/api/reflections/session/[sessionId]/entry/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getIngestionActor } from "@/lib/ingestion/auth";
import { saveReflectionEntry } from "@/lib/reflections/session";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    const actor = await getIngestionActor();
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { sessionId } = await context.params;
    const body = (await request.json()) as { entry_text?: unknown };
    if (typeof body.entry_text !== "string" || !body.entry_text.trim()) {
      return NextResponse.json({ error: "entry_text is required." }, { status: 400 });
    }

    const result = await saveReflectionEntry({
      supabase: actor.supabase,
      userId: actor.user.id,
      clientId: actor.clientId,
      sessionId,
      entryText: body.entry_text,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save reflection entry.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit API routes**

Run:

```bash
git add src/app/api/reflections/session/route.ts 'src/app/api/reflections/session/[sessionId]/entry/route.ts'
git commit -m "feat: add reflection session api" -m "Create Reflect sessions and save completed reflection writing through server routes."
```

---

### Task 8: Wire Reflect Session State Into The UI

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/components/JournalEntryScreen.tsx`
- Modify: `src/app/components/ReflectionAnalysisScreen.tsx`
- Modify: `src/app/components/ReflectionPromptScreen.tsx`
- Modify: `src/app/components/CompletedWritingScreen.tsx`

- [ ] **Step 1: Add client-side response types**

In `src/app/App.tsx`, add these types near the `Screen` type:

```ts
type ReflectionBlock =
  | { type: 'paragraph'; text: string }
  | {
      type: 'entry_reference';
      entry_id: string;
      quote: string;
      text: string;
    };

interface ActiveReflectionSession {
  sessionId: string;
  primaryEntry: {
    entry_id: string;
    entry_date: string | null;
    entry_text: string;
  };
  reflection: {
    session_title?: string;
    primary_entry_id: string;
    blocks: ReflectionBlock[];
    writing_prompt: {
      text: string;
    };
  };
}
```

- [ ] **Step 2: Add session state and loader**

In `App`, add:

```ts
const [activeReflection, setActiveReflection] = useState<ActiveReflectionSession | null>(null);
const [reflectionError, setReflectionError] = useState<string | null>(null);
```

Replace `handleSelectReflect` with:

```ts
const handleSelectReflect = useCallback(async () => {
  setReflectionError(null);
  setScreen('journalEntry');

  try {
    const response = await fetch('/api/reflections/session', {
      method: 'POST',
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || 'Failed to create reflection.');
    }

    setActiveReflection({
      sessionId: payload.session_id,
      primaryEntry: payload.primary_entry,
      reflection: payload.reflection,
    });
  } catch (error) {
    setReflectionError(error instanceof Error ? error.message : 'Failed to create reflection.');
  }
}, []);
```

- [ ] **Step 3: Pass dynamic primary entry**

In the `journalEntry` case, pass:

```tsx
<JournalEntryScreen
  currentDate={currentDate}
  currentTime={currentTime}
  entry={activeReflection?.primaryEntry ?? null}
  error={reflectionError}
  onContinue={handleJournalContinue}
/>
```

- [ ] **Step 4: Update `JournalEntryScreen` props**

Change props in `src/app/components/JournalEntryScreen.tsx`:

```ts
interface JournalEntryScreenProps {
  currentDate: string;
  currentTime: string;
  entry: {
    entry_id: string;
    entry_date: string | null;
    entry_text: string;
  } | null;
  error: string | null;
  onContinue: () => void;
}
```

Render loading text if `entry` is null and `error` is null:

```tsx
{!entry && !error && (
  <p className="font-inter font-medium text-[20px] text-[rgba(255,255,255,0.7)]">
    Finding an old entry...
  </p>
)}
```

Render `error` if present:

```tsx
{error && (
  <p className="font-inter font-medium text-[20px] text-[rgba(255,255,255,0.7)]">
    {error}
  </p>
)}
```

Only start the 4 second timer when `entry` exists:

```ts
useEffect(() => {
  if (!entry) return;
  const timer = setTimeout(onContinue, 4000);
  return () => clearTimeout(timer);
}, [entry, onContinue]);
```

- [ ] **Step 5: Pass dynamic analysis and prompt**

In the `reflectionAnalysis` case:

```tsx
<ReflectionAnalysisScreen
  currentDate={currentDate}
  currentTime={currentTime}
  userName={userName}
  entry={activeReflection?.primaryEntry ?? null}
  reflection={activeReflection?.reflection ?? null}
  onComplete={handleAnalysisComplete}
/>
```

In the `reflectionPrompt` case:

```tsx
<ReflectionPromptScreen
  currentDate={currentDate}
  currentTime={currentTime}
  promptText={activeReflection?.reflection.writing_prompt.text ?? REFLECTION_PROMPT_TEXT}
  onStart={handleStartReflection}
/>
```

In the `reflectionWriting` and `completedReflectionWriting` cases, use the generated prompt text:

```ts
const activeReflectionPrompt =
  activeReflection?.reflection.writing_prompt.text ?? REFLECTION_PROMPT_TEXT;
```

- [ ] **Step 6: Render structured blocks in `ReflectionAnalysisScreen`**

Change `ReflectionAnalysisScreenProps` to include:

```ts
entry: {
  entry_id: string;
  entry_date: string | null;
  entry_text: string;
} | null;
reflection: {
  session_title?: string;
  primary_entry_id: string;
  blocks: ReflectionBlock[];
  writing_prompt: {
    text: string;
  };
} | null;
```

Replace hardcoded paragraph phases with a single ordered block render:

```tsx
{reflection?.blocks.map((block, index) => {
  if (block.type === 'entry_reference') {
    return (
      <TimelineEntry
        key={`${block.entry_id}-${index}`}
        label={block.entry_id}
        text={`"${block.quote}"\n\n${block.text}`}
        color="gold"
        strokeColor="#FCC84E"
        strokeOpacity="1"
        active={phase === index + 1}
        onDone={phase === index + 1 ? advance : undefined}
      />
    );
  }

  return (
    <p key={index} className={inter}>
      <TypewriterText
        text={block.text}
        active={phase === index + 1}
        onDone={phase === index + 1 ? advance : undefined}
      />
    </p>
  );
})}
```

Set completion threshold from block count:

```ts
const completionPhase = (reflection?.blocks.length ?? 0) + 1;
```

Use `phase >= completionPhase` for the start button and Enter shortcut.

- [ ] **Step 7: Add async save support to `CompletedWritingScreen`**

Add prop:

```ts
onSave?: () => Promise<void>;
```

Add state:

```ts
const [isSaving, setIsSaving] = useState(false);
const [saveError, setSaveError] = useState<string | null>(null);
```

Add handler:

```ts
async function handleComplete() {
  if (isSaving) return;
  setSaveError(null);
  setIsSaving(true);
  try {
    await onSave?.();
    onComplete();
  } catch (error) {
    setSaveError(error instanceof Error ? error.message : 'Failed to save.');
  } finally {
    setIsSaving(false);
  }
}
```

Use `handleComplete` for Enter and the button. Change the button label to:

```tsx
label={isSaving ? 'SAVING' : 'COMPLETE'}
```

Render `saveError` under the written text.

- [ ] **Step 8: Save reflection writing through API**

In `App`, add:

```ts
const saveActiveReflectionWriting = useCallback(async () => {
  if (!activeReflection) return;

  const response = await fetch(`/api/reflections/session/${activeReflection.sessionId}/entry`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      entry_text: writtenText,
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to save reflection writing.');
  }
}, [activeReflection, writtenText]);
```

Pass it only to `completedReflectionWriting`:

```tsx
<CompletedWritingScreen
  currentDate={currentDate}
  currentTime={currentTime}
  promptText={activeReflectionPrompt}
  writtenText={writtenText}
  onSave={saveActiveReflectionWriting}
  onComplete={handleCompletedReflectionWriting}
/>
```

- [ ] **Step 9: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 10: Commit UI wiring**

Run:

```bash
git add src/app/App.tsx src/app/components/JournalEntryScreen.tsx src/app/components/ReflectionAnalysisScreen.tsx src/app/components/ReflectionPromptScreen.tsx src/app/components/CompletedWritingScreen.tsx
git commit -m "feat: wire reflect flow to rag sessions" -m "Render structured reflection JSON and save completed reflection writing through the new API."
```

---

### Task 9: Document Env Vars And Verify End To End

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document Reflect env vars**

Append to `README.md`:

```md
Required env vars for Reflect RAG:

- `OPENAI_API_KEY`
- `OPENAI_REFLECTION_MODEL` optional, defaults to `gpt-5.2`
- `PINECONE_API_KEY`
- `PINECONE_INDEX_NAME`
- `PINECONE_NAMESPACE_PREFIX` optional, defaults to `user`
```

- [ ] **Step 2: Run unit tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Run local server**

Run:

```bash
npm run dev
```

Expected: local server starts, usually at:

```text
http://localhost:3000
```

- [ ] **Step 5: Manual Reflect smoke test**

In the browser:

1. Sign in.
2. Choose Reflect.
3. Confirm an old entry appears.
4. Confirm the AI reflection appears with paragraphs and quote blocks.
5. Confirm the writing prompt appears.
6. Write a short response.
7. Complete the flow.
8. Confirm the save call returns `200`.

- [ ] **Step 6: Commit docs**

Run:

```bash
git add README.md
git commit -m "docs: document reflect rag configuration" -m "List server-only environment variables needed for Reflect session generation."
```

---

## Self-Review

Spec coverage:

1. Reflect before writing: Task 8.
2. Random indexed primary entry: Task 6.
3. Reuse saved Pinecone vector ID: Task 4 and Task 6.
4. Related entry search: Task 4.
5. Structured JSON with model-chosen order: Task 2, Task 5, Task 8.
6. Distinct writing prompt rendering: Task 8.
7. Direct save to S3, Supabase, and Pinecone: Task 6 and Task 7.
8. No ingestion Lambda for new writing: Task 6.
9. Session storage: Task 1 and Task 6.
10. Error handling for no indexed entries and Pinecone search failure: Task 6 and Task 7.

Placeholder scan:

No `TBD`, `TODO`, or incomplete task placeholders are intended in this plan.

Type consistency:

1. `ReflectionResponse` is defined in Task 2 and used by Task 5, Task 6, and Task 8.
2. `EntryReferenceWithContent` is defined in Task 3 and used by Task 5 and Task 6.
3. `session_id` is API response JSON. `sessionId` is client-side state.
4. `entry_reference` block order is preserved because the UI maps `reflection.blocks` directly.

