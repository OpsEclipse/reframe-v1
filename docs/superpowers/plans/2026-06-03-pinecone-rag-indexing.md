# Pinecone RAG Indexing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Index each imported journal entry into Pinecone with one OpenAI `text-embedding-3-small` vector.

**Architecture:** Supabase remains the source of truth [the trusted main record]. The ingestion results route saves entry rows first, then calls a focused entry indexing module. The module creates an OpenAI embedding [a numeric meaning map of text], upserts [writes or overwrites] one Pinecone vector, and updates `entries.embedding_status`.

**Tech Stack:** Next.js App Router, TypeScript, Supabase, AWS S3, OpenAI Node SDK, Pinecone Node SDK, Vitest.

---

## File Structure

- Create: `vitest.config.ts`
  - Configures Vitest [a fast JavaScript and TypeScript test runner] with the `@/*` path alias.
- Modify: `package.json`
  - Adds `test` script and dependencies.
- Modify: `package-lock.json`
  - Updated by `npm install`.
- Create: `migrations/007_add_entry_embedding_status.sql`
  - Adds embedding status fields to `entries`.
- Create: `src/lib/entries/embedding-index.ts`
  - Pure helpers and indexing orchestration [the code that coordinates smaller steps].
- Create: `src/lib/entries/embedding-index.test.ts`
  - Unit tests for helper output and indexing success/failure behavior.
- Create: `src/lib/entries/embedding-clients.ts`
  - OpenAI, Pinecone, and Supabase adapters [small wrappers around external services].
- Modify: `src/app/api/ingestion/[ingestionId]/results/route.ts`
  - Returns synced entry references and calls indexing after Supabase upsert.
- Modify: `.env.example`
  - Adds server-only OpenAI and Pinecone env vars.
- Modify: `README.md`
  - Documents new env vars.

Reference docs:

- OpenAI embeddings guide: `https://platform.openai.com/docs/guides/embeddings`
- OpenAI Node SDK: `https://github.com/openai/openai-node`
- Pinecone data upsert docs: `https://docs.pinecone.io/guides/data/upsert-data`
- Pinecone Node SDK docs: `https://docs.pinecone.io/reference/node-sdk`

---

### Task 1: Add Test And SDK Tooling

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install dependencies**

Run:

```bash
npm install openai @pinecone-database/pinecone
npm install -D vitest
```

Expected: `package.json` and `package-lock.json` include `openai`, `@pinecone-database/pinecone`, and `vitest`.

- [ ] **Step 2: Add the test script**

Edit `package.json` so `scripts` includes this exact `test` command:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "CI=1 NEXT_TELEMETRY_DISABLED=1 next build",
    "start": "next start",
    "lint": "eslint .",
    "test": "vitest run"
  }
}
```

- [ ] **Step 3: Create Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
});
```

- [ ] **Step 4: Verify test tooling**

Run:

```bash
npm test -- --passWithNoTests
```

Expected: Vitest exits successfully. It may report that no tests were found.

- [ ] **Step 5: Commit tooling**

Run:

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add test and embedding sdk tooling" -m "Install OpenAI, Pinecone, and Vitest so the indexing feature can be built and tested."
```

---

### Task 2: Add Entry Embedding Status Migration

**Files:**
- Create: `migrations/007_add_entry_embedding_status.sql`

- [ ] **Step 1: Create migration**

Create `migrations/007_add_entry_embedding_status.sql`:

```sql
-- Track whether each entry has been indexed into Pinecone.

alter table public.entries
  add column if not exists embedding_status text not null default 'pending',
  add column if not exists pinecone_vector_id text,
  add column if not exists embedded_at timestamptz;

alter table public.entries
  drop constraint if exists entries_embedding_status_check;

alter table public.entries
  add constraint entries_embedding_status_check
  check (embedding_status in ('pending', 'indexed', 'failed')) not valid;

create index if not exists idx_entries_embedding_status
on public.entries (user_id, embedding_status);
```

- [ ] **Step 2: Verify migration text**

Run:

```bash
rg "embedding_status|pinecone_vector_id|embedded_at|entries_embedding_status_check" migrations/007_add_entry_embedding_status.sql
```

Expected: all four names appear in the migration.

- [ ] **Step 3: Commit migration**

Run:

```bash
git add migrations/007_add_entry_embedding_status.sql
git commit -m "feat: add entry embedding status fields" -m "Track Pinecone indexing state for each imported entry."
```

---

### Task 3: Build Pure Pinecone Record Helpers

**Files:**
- Create: `src/lib/entries/embedding-index.test.ts`
- Create: `src/lib/entries/embedding-index.ts`

- [ ] **Step 1: Write failing helper tests**

Create `src/lib/entries/embedding-index.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildPineconeMetadata,
  buildPineconeNamespace,
  buildPineconeVectorId,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
} from "@/lib/entries/embedding-index";

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
      entryText: "This text must not be stored in Pinecone metadata.",
    });

    expect(metadata).toEqual({
      user_id: "user-123",
      client_id: "client-456",
      entry_id: "entry-abc",
      s3_key: "entries/user-123/file.json",
      source_file: "journal.pdf",
      entry_date: "2025-02-01",
    });
    expect(Object.values(metadata)).not.toContain("This text must not be stored in Pinecone metadata.");
  });
});
```

- [ ] **Step 2: Run helper tests to verify they fail**

Run:

```bash
npm test -- src/lib/entries/embedding-index.test.ts
```

Expected: FAIL because `src/lib/entries/embedding-index.ts` does not exist.

- [ ] **Step 3: Implement helpers**

Create `src/lib/entries/embedding-index.ts`:

```ts
export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;
export const DEFAULT_PINECONE_NAMESPACE_PREFIX = "user";

export type EntryEmbeddingStatus = "pending" | "indexed" | "failed";

export interface EntryEmbeddingRecord {
  userId: string;
  clientId: string;
  entryId: string;
  s3Key: string;
  sourceFile: string | null;
  entryDate: string | null;
  entryText: string;
}

export interface PineconeEntryMetadata {
  user_id: string;
  client_id: string;
  entry_id: string;
  s3_key: string;
  source_file: string;
  entry_date: string;
}

export function buildPineconeNamespace(
  userId: string,
  prefix = DEFAULT_PINECONE_NAMESPACE_PREFIX,
): string {
  return `${prefix}:${userId}`;
}

export function buildPineconeVectorId(entryId: string): string {
  return `entry:${entryId}`;
}

export function buildPineconeMetadata(record: EntryEmbeddingRecord): PineconeEntryMetadata {
  return {
    user_id: record.userId,
    client_id: record.clientId,
    entry_id: record.entryId,
    s3_key: record.s3Key,
    source_file: record.sourceFile ?? "",
    entry_date: record.entryDate ?? "",
  };
}
```

- [ ] **Step 4: Run helper tests to verify they pass**

Run:

```bash
npm test -- src/lib/entries/embedding-index.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit helpers**

Run:

```bash
git add src/lib/entries/embedding-index.ts src/lib/entries/embedding-index.test.ts
git commit -m "feat: add entry embedding record helpers" -m "Create stable Pinecone namespaces, vector ids, and metadata for imported entries."
```

---

### Task 4: Add Indexing Orchestration

**Files:**
- Modify: `src/lib/entries/embedding-index.test.ts`
- Modify: `src/lib/entries/embedding-index.ts`

- [ ] **Step 1: Add failing indexing tests**

Append these tests to `src/lib/entries/embedding-index.test.ts`:

```ts
import type {
  EntryEmbeddingDependencies,
  EntryEmbeddingRecord,
  EntryEmbeddingStatusUpdate,
} from "@/lib/entries/embedding-index";
import { indexEntryEmbedding } from "@/lib/entries/embedding-index";

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

function createDependencies(overrides: Partial<EntryEmbeddingDependencies> = {}) {
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

describe("indexEntryEmbedding", () => {
  it("marks an entry indexed after OpenAI and Pinecone succeed", async () => {
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

  it("marks an entry failed when embedding creation fails", async () => {
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

  it("marks an entry failed when Pinecone upsert fails", async () => {
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
```

- [ ] **Step 2: Run indexing tests to verify they fail**

Run:

```bash
npm test -- src/lib/entries/embedding-index.test.ts
```

Expected: FAIL because `indexEntryEmbedding` and related types are missing.

- [ ] **Step 3: Implement indexing orchestration**

Append this code to `src/lib/entries/embedding-index.ts`:

```ts
export interface EntryEmbeddingStatusUpdate {
  userId: string;
  entryId: string;
  status: EntryEmbeddingStatus;
  pineconeVectorId?: string;
  embeddedAt?: string;
}

export interface PineconeVectorUpsert {
  namespace: string;
  id: string;
  values: number[];
  metadata: PineconeEntryMetadata;
}

export interface EntryEmbeddingDependencies {
  createEmbedding: (text: string) => Promise<number[]>;
  upsertVector: (vector: PineconeVectorUpsert) => Promise<void>;
  markEntryEmbeddingStatus: (update: EntryEmbeddingStatusUpdate) => Promise<void>;
  now: () => Date;
  namespacePrefix?: string;
}

export interface EntryEmbeddingResult {
  status: EntryEmbeddingStatus;
  vectorId: string;
}

export async function indexEntryEmbedding(
  dependencies: EntryEmbeddingDependencies,
  record: EntryEmbeddingRecord,
): Promise<EntryEmbeddingResult> {
  const vectorId = buildPineconeVectorId(record.entryId);

  await dependencies.markEntryEmbeddingStatus({
    userId: record.userId,
    entryId: record.entryId,
    status: "pending",
  });

  try {
    const values = await dependencies.createEmbedding(record.entryText);
    await dependencies.upsertVector({
      namespace: buildPineconeNamespace(record.userId, dependencies.namespacePrefix),
      id: vectorId,
      values,
      metadata: buildPineconeMetadata(record),
    });

    await dependencies.markEntryEmbeddingStatus({
      userId: record.userId,
      entryId: record.entryId,
      status: "indexed",
      pineconeVectorId: vectorId,
      embeddedAt: dependencies.now().toISOString(),
    });

    return {
      status: "indexed",
      vectorId,
    };
  } catch {
    await dependencies.markEntryEmbeddingStatus({
      userId: record.userId,
      entryId: record.entryId,
      status: "failed",
    });

    return {
      status: "failed",
      vectorId,
    };
  }
}

export async function indexEntryEmbeddings(
  dependencies: EntryEmbeddingDependencies,
  records: EntryEmbeddingRecord[],
): Promise<EntryEmbeddingResult[]> {
  const results: EntryEmbeddingResult[] = [];

  for (const record of records) {
    results.push(await indexEntryEmbedding(dependencies, record));
  }

  return results;
}
```

- [ ] **Step 4: Run indexing tests to verify they pass**

Run:

```bash
npm test -- src/lib/entries/embedding-index.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit orchestration**

Run:

```bash
git add src/lib/entries/embedding-index.ts src/lib/entries/embedding-index.test.ts
git commit -m "feat: add entry embedding indexing flow" -m "Coordinate OpenAI embedding, Pinecone upsert, and Supabase status updates without blocking imports."
```

---

### Task 5: Add OpenAI, Pinecone, And Supabase Adapters

**Files:**
- Create: `src/lib/entries/embedding-clients.ts`
- Modify: `src/lib/entries/embedding-index.test.ts`

- [ ] **Step 1: Add failing status adapter test**

Append this test to `src/lib/entries/embedding-index.test.ts`:

```ts
import { buildEntryEmbeddingUpdatePayload } from "@/lib/entries/embedding-clients";

describe("buildEntryEmbeddingUpdatePayload", () => {
  it("builds an indexed Supabase update payload", () => {
    expect(
      buildEntryEmbeddingUpdatePayload({
        userId: "user-123",
        entryId: "entry-abc",
        status: "indexed",
        pineconeVectorId: "entry:entry-abc",
        embeddedAt: "2026-06-03T12:00:00.000Z",
      }),
    ).toEqual({
      embedding_status: "indexed",
      pinecone_vector_id: "entry:entry-abc",
      embedded_at: "2026-06-03T12:00:00.000Z",
    });
  });

  it("builds a failed Supabase update payload that clears indexed fields", () => {
    expect(
      buildEntryEmbeddingUpdatePayload({
        userId: "user-123",
        entryId: "entry-abc",
        status: "failed",
      }),
    ).toEqual({
      embedding_status: "failed",
      pinecone_vector_id: null,
      embedded_at: null,
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- src/lib/entries/embedding-index.test.ts
```

Expected: FAIL because `src/lib/entries/embedding-clients.ts` does not exist.

- [ ] **Step 3: Implement adapters**

Create `src/lib/entries/embedding-clients.ts`:

```ts
import { Pinecone } from "@pinecone-database/pinecone";
import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EMBEDDING_MODEL,
  indexEntryEmbeddings,
  type EntryEmbeddingRecord,
  type EntryEmbeddingStatusUpdate,
  type PineconeVectorUpsert,
} from "@/lib/entries/embedding-index";

let openAIClient: OpenAI | null = null;
let pineconeClient: Pinecone | null = null;

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
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

function getPineconeClient(): Pinecone {
  if (!pineconeClient) {
    pineconeClient = new Pinecone({
      apiKey: getRequiredEnv("PINECONE_API_KEY"),
    });
  }
  return pineconeClient;
}

export function getPineconeNamespacePrefix(): string {
  return process.env.PINECONE_NAMESPACE_PREFIX || "user";
}

export async function createOpenAIEmbedding(text: string): Promise<number[]> {
  const response = await getOpenAIClient().embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
    encoding_format: "float",
  });

  const embedding = response.data[0]?.embedding;
  if (!embedding) {
    throw new Error("OpenAI did not return an embedding.");
  }

  return embedding;
}

export async function upsertPineconeVector(vector: PineconeVectorUpsert): Promise<void> {
  const index = getPineconeClient().index(getRequiredEnv("PINECONE_INDEX_NAME"));
  await index.namespace(vector.namespace).upsert([
    {
      id: vector.id,
      values: vector.values,
      metadata: vector.metadata,
    },
  ]);
}

export function buildEntryEmbeddingUpdatePayload(update: EntryEmbeddingStatusUpdate): {
  embedding_status: EntryEmbeddingStatusUpdate["status"];
  pinecone_vector_id: string | null;
  embedded_at: string | null;
} {
  if (update.status === "indexed") {
    return {
      embedding_status: "indexed",
      pinecone_vector_id: update.pineconeVectorId ?? null,
      embedded_at: update.embeddedAt ?? null,
    };
  }

  return {
    embedding_status: update.status,
    pinecone_vector_id: null,
    embedded_at: null,
  };
}

export async function markSupabaseEntryEmbeddingStatus(
  supabase: SupabaseClient,
  update: EntryEmbeddingStatusUpdate,
): Promise<void> {
  const { error } = await supabase
    .from("entries")
    .update(buildEntryEmbeddingUpdatePayload(update))
    .eq("user_id", update.userId)
    .eq("entry_id", update.entryId);

  if (error) {
    throw new Error(`Failed to update embedding status: ${error.message}`);
  }
}

export async function indexEntriesWithDefaultClients(params: {
  supabase: SupabaseClient;
  records: EntryEmbeddingRecord[];
}) {
  return indexEntryEmbeddings(
    {
      createEmbedding: createOpenAIEmbedding,
      upsertVector: upsertPineconeVector,
      markEntryEmbeddingStatus: (update) => markSupabaseEntryEmbeddingStatus(params.supabase, update),
      now: () => new Date(),
      namespacePrefix: getPineconeNamespacePrefix(),
    },
    params.records,
  );
}
```

- [ ] **Step 4: Run adapter tests**

Run:

```bash
npm test -- src/lib/entries/embedding-index.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run TypeScript build to verify SDK usage**

Run:

```bash
npm run build
```

Expected: PASS. If TypeScript reports a Pinecone SDK method name mismatch, keep the adapter boundary and adjust only `upsertPineconeVector` to match the installed SDK type.

- [ ] **Step 6: Commit adapters**

Run:

```bash
git add src/lib/entries/embedding-clients.ts src/lib/entries/embedding-index.test.ts
git commit -m "feat: add embedding service adapters" -m "Connect entry indexing to OpenAI, Pinecone, and Supabase status updates."
```

---

### Task 6: Integrate Indexing Into Ingestion Results

**Files:**
- Modify: `src/app/api/ingestion/[ingestionId]/results/route.ts`

- [ ] **Step 1: Update imports**

Add this import near the other local imports:

```ts
import { indexEntriesWithDefaultClients } from "@/lib/entries/embedding-clients";
import type { EntryEmbeddingRecord } from "@/lib/entries/embedding-index";
```

- [ ] **Step 2: Update `syncEntriesToDatabase` return shape**

Inside `src/app/api/ingestion/[ingestionId]/results/route.ts`, replace the existing `syncEntriesToDatabase` return type with:

```ts
interface SyncedEntryReference extends EntryEmbeddingRecord {}
```

Change the function signature to:

```ts
async function syncEntriesToDatabase(params: {
  supabase: IngestionActor["supabase"];
  userId: string;
  clientId: string;
  entryObjects: Array<{ key: string; entry: ExtractedEntry }>;
}): Promise<SyncedEntryReference[]> {
```

- [ ] **Step 3: Track synced references while building Supabase rows**

Inside `syncEntriesToDatabase`, add this array next to `rows`:

```ts
const syncedReferences: SyncedEntryReference[] = [];
```

After each `rows.push(...)`, add the matching indexing record:

```ts
syncedReferences.push({
  userId: params.userId,
  clientId: params.clientId,
  entryId,
  s3Key: item.key,
  sourceFile: item.entry.source_file || null,
  entryDate: normalizeEntryDate(item.entry.date),
  entryText: item.entry.entry_text,
});
```

When no rows exist, return an empty array:

```ts
return [];
```

When the Supabase upsert succeeds, return the synced references:

```ts
return syncedReferences;
```

- [ ] **Step 4: Call indexing after Supabase sync**

Replace the current `syncedReferences` number call site with:

```ts
const syncedReferences = await syncEntriesToDatabase({
  supabase: actor.supabase,
  userId: actor.user.id,
  clientId: manifest.clientId || actor.clientId,
  entryObjects: materializedEntryObjects,
});

let embeddingResults: Array<{ status: "indexed" | "failed" }> = [];
try {
  embeddingResults = await indexEntriesWithDefaultClients({
    supabase: actor.supabase,
    records: syncedReferences,
  });
} catch (indexingError) {
  if (INGESTION_DEBUG) {
    console.error("[ingestion-results] embedding indexing failed", {
      ingestionId,
      userId: actor.user.id,
      message: indexingError instanceof Error ? indexingError.message : "Unknown indexing error.",
    });
  }
}
```

Update the JSON response fields:

```ts
return NextResponse.json({
  ingestionId,
  entries,
  referencesSynced: syncedReferences.length,
  embeddingsIndexed: embeddingResults.filter((result) => result.status === "indexed").length,
  embeddingsFailed: embeddingResults.filter((result) => result.status === "failed").length,
  entryKeys: materializedEntryObjects.map((item) => item.key),
});
```

- [ ] **Step 5: Run tests and build**

Run:

```bash
npm test
npm run build
```

Expected: both pass.

- [ ] **Step 6: Commit route integration**

Run:

```bash
git add 'src/app/api/ingestion/[ingestionId]/results/route.ts'
git commit -m "feat: index imported entries in pinecone" -m "Run embedding indexing after imported entries are saved to Supabase."
```

---

### Task 7: Document Required Environment Variables

**Files:**
- Modify: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Update `.env.example`**

Append these lines:

```text
# Entry embedding indexing
# OPENAI_API_KEY=
# PINECONE_API_KEY=
# PINECONE_INDEX_NAME=
# PINECONE_NAMESPACE_PREFIX=user
```

- [ ] **Step 2: Update README**

In `README.md`, add this section under the existing ingestion env vars:

```md
Required env vars for entry embedding indexing:

- `OPENAI_API_KEY`
- `PINECONE_API_KEY`
- `PINECONE_INDEX_NAME`
- `PINECONE_NAMESPACE_PREFIX` (optional, defaults to `user`)
```

- [ ] **Step 3: Verify docs mention all new variables**

Run:

```bash
rg "OPENAI_API_KEY|PINECONE_API_KEY|PINECONE_INDEX_NAME|PINECONE_NAMESPACE_PREFIX" .env.example README.md
```

Expected: all four variable names appear in both files.

- [ ] **Step 4: Commit docs**

Run:

```bash
git add .env.example README.md
git commit -m "docs: document embedding index configuration" -m "List the server-only OpenAI and Pinecone variables required for entry indexing."
```

---

### Task 8: Final Verification

**Files:**
- No new file changes expected.

- [ ] **Step 1: Run unit tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Inspect changed files**

Run:

```bash
git status --short
```

Expected: only intentional files are changed, or the worktree is clean after commits. Existing unrelated changes may still appear:

```text
 M src/app/page.tsx
 D textract.amazonaws.com
?? deep-dive.md
?? src/app/components/SettingsMenu.tsx
```

- [ ] **Step 5: Final commit if needed**

If any intentional files remain unstaged, run:

```bash
git add package.json package-lock.json vitest.config.ts migrations/007_add_entry_embedding_status.sql src/lib/entries/embedding-index.ts src/lib/entries/embedding-index.test.ts src/lib/entries/embedding-clients.ts 'src/app/api/ingestion/[ingestionId]/results/route.ts' .env.example README.md
git commit -m "feat: add pinecone indexing for imported entries" -m "Create embeddings for imported entries and track Pinecone indexing status in Supabase."
```

Expected: no intentional files remain uncommitted.

---

## Self-Review

Spec coverage:

- One vector per entry: Task 3 and Task 6.
- Inline indexing in results route: Task 6.
- Slim Supabase fields: Task 2.
- OpenAI `text-embedding-3-small`: Task 3 and Task 5.
- Pinecone namespace and metadata shape: Task 3.
- No full text in Pinecone metadata: Task 3.
- Non-blocking import failure model: Task 4 and Task 6.
- Tests with mocks: Task 3, Task 4, and Task 5.
- Env var docs: Task 7.

No red-flag planning text remains.

Type consistency:

- `EntryEmbeddingRecord.entryId` maps to Supabase `entry_id`.
- `EntryEmbeddingRecord.s3Key` maps to Supabase `s3_key`.
- `EntryEmbeddingStatusUpdate.pineconeVectorId` maps to Supabase `pinecone_vector_id`.
- `EntryEmbeddingStatusUpdate.embeddedAt` maps to Supabase `embedded_at`.
