# Old Entries Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a date-grouped old entries archive with lazy entry loading and hard delete.

**Architecture:** Keep the first archive load light by fetching only entry metadata from `GET /api/entries`. Fetch full S3 content only when a user opens one file icon. Put server-only S3, Supabase, and Pinecone deletion behind `DELETE /api/entries/[entryId]`.

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest, Supabase, AWS S3 SDK, Pinecone TypeScript SDK, Tailwind CSS.

---

## File Structure

- Modify: `src/lib/entries/content.ts`
  - Owns reading and normalizing one entry S3 object.
  - Adds plain text support so `JSON.parse` failures become valid entry text.
- Create: `src/lib/entries/content.test.ts`
  - Tests JSON and plain text parsing.
- Modify: `src/lib/entries/embedding-clients.ts`
  - Adds a server-side Pinecone vector delete helper.
- Modify: `src/lib/entries/embedding-clients.test.ts`
  - Tests the Pinecone delete helper.
- Modify: `src/app/api/entries/[entryId]/route.ts`
  - Keeps `GET`.
  - Adds `DELETE`.
  - Makes `GET` use the improved content parser.
- Create: `src/app/api/entries/[entryId]/route.test.ts`
  - Tests detail and delete behavior through the route handlers.
- Create: `src/lib/entries/archive.ts`
  - Pure helper for grouping entries by year and labeling undated entries.
  - Pure helper means it has no browser or network dependency.
- Create: `src/lib/entries/archive.test.ts`
  - Tests grouping, sorting, and labels in Node.
- Create: `src/app/components/archive/OldEntriesArchive.tsx`
  - React UI for the archive pop-up and entry viewer.
- Modify: `src/app/components/shared/screen-primitives.tsx`
  - Changes `DockWithImporter` into a two-icon dock and mounts `OldEntriesArchive`.
- Run: `npm run test`, `npm run lint`, `npm run build`
  - Confirms the feature works in tests, passes lint, and builds for production.

## Task 1: Make Entry Content Parsing Forgiving

**Files:**
- Modify: `src/lib/entries/content.ts`
- Create: `src/lib/entries/content.test.ts`

- [ ] **Step 1: Write failing parser tests**

Create `src/lib/entries/content.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizeEntryPayload, normalizeEntryRawContent } from "@/lib/entries/content";

describe("normalizeEntryPayload", () => {
  it("keeps a valid single JSON entry", () => {
    expect(
      normalizeEntryPayload({
        date: "2026-06-03",
        entry_text: "A dated entry.",
        source_file: "journal.pdf",
      }),
    ).toEqual({
      date: "2026-06-03",
      entry_text: "A dated entry.",
      source_file: "journal.pdf",
    });
  });

  it("uses the first valid entry in a JSON array", () => {
    expect(
      normalizeEntryPayload([
        {
          date: null,
          entry_text: "First entry.",
          source_file: "scan.png",
        },
        {
          date: "2026-06-03",
          entry_text: "Second entry.",
          source_file: "scan.png",
        },
      ]),
    ).toEqual({
      date: null,
      entry_text: "First entry.",
      source_file: "scan.png",
    });
  });

  it("uses the first valid entry in an entries wrapper", () => {
    expect(
      normalizeEntryPayload({
        entries: [
          {
            date: "2025-12-12",
            entry_text: "Wrapped entry.",
            source_file: "journal.pdf",
          },
        ],
      }),
    ).toEqual({
      date: "2025-12-12",
      entry_text: "Wrapped entry.",
      source_file: "journal.pdf",
    });
  });
});

describe("normalizeEntryRawContent", () => {
  it("parses JSON entry content", () => {
    expect(
      normalizeEntryRawContent(
        JSON.stringify({
          date: "2026-06-03",
          entry_text: "JSON entry.",
          source_file: "journal.pdf",
        }),
        "fallback.pdf",
      ),
    ).toEqual({
      date: "2026-06-03",
      entry_text: "JSON entry.",
      source_file: "journal.pdf",
    });
  });

  it("treats non-JSON S3 content as plain text", () => {
    expect(normalizeEntryRawContent("ENTRY\n\nplain text", "scan.png")).toEqual({
      date: null,
      entry_text: "ENTRY\n\nplain text",
      source_file: "scan.png",
    });
  });

  it("returns null for empty content", () => {
    expect(normalizeEntryRawContent("   ", "scan.png")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the new test and verify it fails**

Run:

```bash
npm run test -- src/lib/entries/content.test.ts
```

Expected:

```text
FAIL src/lib/entries/content.test.ts
normalizeEntryRawContent is not exported
```

- [ ] **Step 3: Implement forgiving raw content parsing**

Modify `src/lib/entries/content.ts` so the parser section becomes:

```ts
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

export function normalizeEntryRawContent(
  raw: string,
  fallbackSourceFile: string | null,
): ExtractedEntry | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const normalized = normalizeEntryPayload(parsed);
    if (normalized) return normalized;
  } catch (error) {
    if (!(error instanceof SyntaxError)) {
      throw error;
    }
  }

  return {
    date: null,
    entry_text: raw,
    source_file: fallbackSourceFile ?? "",
  };
}

export async function readEntryContentFromS3(
  s3Key: string,
  fallbackSourceFile: string | null = null,
): Promise<ExtractedEntry | null> {
  const object = await getS3Client().send(
    new GetObjectCommand({
      Bucket: getIngestionBucket(),
      Key: s3Key,
    }),
  );

  const raw = await bodyToString(object.Body);
  return normalizeEntryRawContent(raw, fallbackSourceFile);
}
```

- [ ] **Step 4: Run the content tests**

Run:

```bash
npm run test -- src/lib/entries/content.test.ts
```

Expected:

```text
PASS src/lib/entries/content.test.ts
```

- [ ] **Step 5: Commit**

Run:

```bash
git add src/lib/entries/content.ts src/lib/entries/content.test.ts
git commit -m "fix: support plain text entry content" -m "Treat non-JSON S3 entry content as valid plain text so old entries can still open."
```

## Task 2: Add Pinecone Vector Deletion Helper

**Files:**
- Modify: `src/lib/entries/embedding-clients.ts`
- Modify: `src/lib/entries/embedding-clients.test.ts`

- [ ] **Step 1: Add a failing Pinecone delete test**

In `src/lib/entries/embedding-clients.test.ts`, add this test near the existing Pinecone tests:

```ts
describe("deletePineconeEntryVector", () => {
  it("deletes one vector from the user's namespace", async () => {
    const { deletePineconeEntryVector } = await import("@/lib/entries/embedding-clients");
    process.env.PINECONE_API_KEY = "pinecone-key";
    process.env.PINECONE_INDEX_NAME = "entries-index";
    process.env.PINECONE_NAMESPACE_PREFIX = "user";

    await deletePineconeEntryVector({
      userId: "user-123",
      vectorId: "entry:entry-abc",
    });

    expect(clientMocks.pineconeIndex).toHaveBeenCalledWith("entries-index");
    expect(clientMocks.pineconeDeleteOne).toHaveBeenCalledWith({
      id: "entry:entry-abc",
      namespace: "user:user-123",
    });
  });
});
```

If the current mock object does not have `pineconeDeleteOne`, extend the `vi.hoisted` mock at the top of the file:

```ts
const clientMocks = vi.hoisted(() => ({
  openAIEmbeddingsCreate: vi.fn(),
  pineconeIndex: vi.fn(),
  pineconeUpsert: vi.fn(),
  pineconeDeleteOne: vi.fn(),
}));
```

Update the Pinecone mock so `index()` returns both `namespace().upsert()` and `deleteOne()`:

```ts
vi.mock("@pinecone-database/pinecone", () => ({
  Pinecone: vi.fn(() => ({
    index: clientMocks.pineconeIndex.mockReturnValue({
      namespace: vi.fn(() => ({
        upsert: clientMocks.pineconeUpsert,
      })),
      deleteOne: clientMocks.pineconeDeleteOne,
    }),
  })),
}));
```

- [ ] **Step 2: Run the Pinecone helper test and verify it fails**

Run:

```bash
npm run test -- src/lib/entries/embedding-clients.test.ts
```

Expected:

```text
FAIL src/lib/entries/embedding-clients.test.ts
deletePineconeEntryVector is not exported
```

- [ ] **Step 3: Implement the helper**

Add this to `src/lib/entries/embedding-clients.ts` after `upsertPineconeVector`:

```ts
export async function deletePineconeEntryVector(params: {
  userId: string;
  vectorId: string;
}): Promise<void> {
  const indexName = getRequiredEnv("PINECONE_INDEX_NAME");
  const namespace = buildPineconeNamespace(
    params.userId,
    getPineconeNamespacePrefix(),
  );
  const index = getPineconeClient().index(indexName);

  console.log("[entry-embeddings] pinecone delete starting", {
    indexName,
    namespace,
    vectorId: params.vectorId,
  });

  await index.deleteOne({
    id: params.vectorId,
    namespace,
  });

  console.log("[entry-embeddings] pinecone delete completed", {
    indexName,
    namespace,
    vectorId: params.vectorId,
  });
}
```

- [ ] **Step 4: Run the embedding client tests**

Run:

```bash
npm run test -- src/lib/entries/embedding-clients.test.ts
```

Expected:

```text
PASS src/lib/entries/embedding-clients.test.ts
```

- [ ] **Step 5: Commit**

Run:

```bash
git add src/lib/entries/embedding-clients.ts src/lib/entries/embedding-clients.test.ts
git commit -m "feat: add entry vector deletion helper" -m "Add a Pinecone cleanup helper for hard-deleting old entries."
```

## Task 3: Add Entry Detail And Delete Route Tests

**Files:**
- Create: `src/app/api/entries/[entryId]/route.test.ts`
- Modify later: `src/app/api/entries/[entryId]/route.ts`

- [ ] **Step 1: Write failing route tests**

Create `src/app/api/entries/[entryId]/route.test.ts`:

```ts
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getIngestionActor: vi.fn(),
  readEntryContentFromS3: vi.fn(),
  deletePineconeEntryVector: vi.fn(),
  s3Send: vi.fn(),
}));

vi.mock("@/lib/ingestion/auth", () => ({
  getIngestionActor: mocks.getIngestionActor,
}));

vi.mock("@/lib/entries/content", () => ({
  readEntryContentFromS3: mocks.readEntryContentFromS3,
}));

vi.mock("@/lib/entries/embedding-clients", () => ({
  deletePineconeEntryVector: mocks.deletePineconeEntryVector,
}));

vi.mock("@/lib/aws/clients", () => ({
  getIngestionBucket: () => "journal-bucket",
  getS3Client: () => ({ send: mocks.s3Send }),
}));

function routeContext(entryId: string) {
  return {
    params: Promise.resolve({ entryId }),
  };
}

function createSupabaseWithEntry(options: {
  row: null | {
    entry_id: string;
    s3_key: string;
    source_file: string | null;
    entry_date: string | null;
    pinecone_vector_id?: string | null;
  };
  selectError?: { message: string } | null;
  deleteError?: { message: string } | null;
}) {
  const selectLimit = vi.fn(async () => ({
    data: options.row ? [options.row] : [],
    error: options.selectError ?? null,
  }));
  const selectEqEntry = vi.fn(() => ({ limit: selectLimit }));
  const selectEqUser = vi.fn(() => ({ eq: selectEqEntry }));
  const select = vi.fn(() => ({ eq: selectEqUser }));

  const deleteLimit = vi.fn(async () => ({
    data: options.deleteError ? [] : options.row ? [{ entry_id: options.row.entry_id }] : [],
    error: options.deleteError ?? null,
  }));
  const deleteSelect = vi.fn(() => ({ limit: deleteLimit }));
  const deleteEqEntry = vi.fn(() => ({ select: deleteSelect }));
  const deleteEqUser = vi.fn(() => ({ eq: deleteEqEntry }));
  const deleteFn = vi.fn(() => ({ eq: deleteEqUser }));

  const from = vi.fn((table: string) => {
    if (table !== "entries") {
      throw new Error(`Unexpected table: ${table}`);
    }
    return {
      select,
      delete: deleteFn,
    };
  });

  return {
    supabase: { from },
    spies: {
      from,
      select,
      selectEqUser,
      selectEqEntry,
      selectLimit,
      deleteFn,
      deleteEqUser,
      deleteEqEntry,
      deleteSelect,
      deleteLimit,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.s3Send.mockResolvedValue({});
  mocks.deletePineconeEntryVector.mockResolvedValue(undefined);
});

describe("GET /api/entries/[entryId]", () => {
  it("loads one owned entry with S3 content", async () => {
    const { GET } = await import("@/app/api/entries/[entryId]/route");
    const { supabase } = createSupabaseWithEntry({
      row: {
        entry_id: "entry-abc",
        s3_key: "entries/user-123/entry-abc.json",
        source_file: "journal.pdf",
        entry_date: "2026-06-03",
      },
    });
    mocks.getIngestionActor.mockResolvedValue({
      user: { id: "user-123" },
      supabase,
    });
    mocks.readEntryContentFromS3.mockResolvedValue({
      date: "2026-06-03",
      entry_text: "Old entry.",
      source_file: "journal.pdf",
    });

    const response = await GET(new Request("http://test.local"), routeContext("entry-abc"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      entry_id: "entry-abc",
      entry_date: "2026-06-03",
      source_file: "journal.pdf",
      content: {
        date: "2026-06-03",
        entry_text: "Old entry.",
        source_file: "journal.pdf",
      },
    });
    expect(mocks.readEntryContentFromS3).toHaveBeenCalledWith(
      "entries/user-123/entry-abc.json",
      "journal.pdf",
    );
  });
});

describe("DELETE /api/entries/[entryId]", () => {
  it("rejects unauthenticated users", async () => {
    const { DELETE } = await import("@/app/api/entries/[entryId]/route");
    mocks.getIngestionActor.mockResolvedValue(null);

    const response = await DELETE(new Request("http://test.local"), routeContext("entry-abc"));

    expect(response.status).toBe(401);
  });

  it("returns 404 when no owned entry exists", async () => {
    const { DELETE } = await import("@/app/api/entries/[entryId]/route");
    const { supabase } = createSupabaseWithEntry({ row: null });
    mocks.getIngestionActor.mockResolvedValue({
      user: { id: "user-123" },
      supabase,
    });

    const response = await DELETE(new Request("http://test.local"), routeContext("entry-abc"));

    expect(response.status).toBe(404);
    expect(mocks.s3Send).not.toHaveBeenCalled();
  });

  it("deletes the S3 object, Supabase row, and Pinecone vector", async () => {
    const { DELETE } = await import("@/app/api/entries/[entryId]/route");
    const { supabase, spies } = createSupabaseWithEntry({
      row: {
        entry_id: "entry-abc",
        s3_key: "entries/user-123/entry-abc.json",
        source_file: "journal.pdf",
        entry_date: "2026-06-03",
        pinecone_vector_id: "entry:entry-abc",
      },
    });
    mocks.getIngestionActor.mockResolvedValue({
      user: { id: "user-123" },
      supabase,
    });

    const response = await DELETE(new Request("http://test.local"), routeContext("entry-abc"));

    expect(response.status).toBe(200);
    expect(mocks.s3Send).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
    expect(mocks.s3Send.mock.calls[0]?.[0].input).toEqual({
      Bucket: "journal-bucket",
      Key: "entries/user-123/entry-abc.json",
    });
    expect(spies.deleteEqUser).toHaveBeenCalledWith("user_id", "user-123");
    expect(spies.deleteEqEntry).toHaveBeenCalledWith("entry_id", "entry-abc");
    expect(mocks.deletePineconeEntryVector).toHaveBeenCalledWith({
      userId: "user-123",
      vectorId: "entry:entry-abc",
    });
    await expect(response.json()).resolves.toEqual({
      deleted: true,
      entry_id: "entry-abc",
    });
  });

  it("still succeeds when only Pinecone cleanup fails", async () => {
    const { DELETE } = await import("@/app/api/entries/[entryId]/route");
    const { supabase } = createSupabaseWithEntry({
      row: {
        entry_id: "entry-abc",
        s3_key: "entries/user-123/entry-abc.json",
        source_file: null,
        entry_date: null,
        pinecone_vector_id: "entry:entry-abc",
      },
    });
    mocks.getIngestionActor.mockResolvedValue({
      user: { id: "user-123" },
      supabase,
    });
    mocks.deletePineconeEntryVector.mockRejectedValue(new Error("pinecone down"));

    const response = await DELETE(new Request("http://test.local"), routeContext("entry-abc"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      deleted: true,
      entry_id: "entry-abc",
    });
  });
});
```

- [ ] **Step 2: Run the route test and verify it fails**

Run:

```bash
npm run test -- 'src/app/api/entries/[entryId]/route.test.ts'
```

Expected:

```text
FAIL src/app/api/entries/[entryId]/route.test.ts
DELETE is not exported
```

## Task 4: Implement Entry Delete Route

**Files:**
- Modify: `src/app/api/entries/[entryId]/route.ts`

- [ ] **Step 1: Update imports and row type**

At the top of `src/app/api/entries/[entryId]/route.ts`, replace the imports and `EntryReferenceRow` with:

```ts
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { getIngestionBucket, getS3Client } from "@/lib/aws/clients";
import { readEntryContentFromS3 } from "@/lib/entries/content";
import { deletePineconeEntryVector } from "@/lib/entries/embedding-clients";
import { getIngestionActor } from "@/lib/ingestion/auth";

export const runtime = "nodejs";

interface EntryRouteContext {
  params: Promise<{
    entryId: string;
  }>;
}

interface EntryReferenceRow {
  entry_id: string;
  s3_key: string;
  source_file: string | null;
  entry_date: string | null;
  pinecone_vector_id?: string | null;
}
```

- [ ] **Step 2: Make GET pass source file fallback to S3 content parser**

In `GET`, change the select and read call:

```ts
const { data, error } = await actor.supabase
  .from("entries")
  .select("entry_id,s3_key,source_file,entry_date,pinecone_vector_id")
  .eq("user_id", actor.user.id)
  .eq("entry_id", cleanEntryId)
  .limit(1);
```

And:

```ts
content = await readEntryContentFromS3(reference.s3_key, reference.source_file);
```

- [ ] **Step 3: Add DELETE handler**

Add this below `GET` in `src/app/api/entries/[entryId]/route.ts`:

```ts
export async function DELETE(_request: Request, context: EntryRouteContext) {
  try {
    const actor = await getIngestionActor();
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { entryId } = await context.params;
    const cleanEntryId = entryId.trim();
    if (!cleanEntryId) {
      return NextResponse.json({ error: "entryId is required." }, { status: 400 });
    }

    const { data, error } = await actor.supabase
      .from("entries")
      .select("entry_id,s3_key,source_file,entry_date,pinecone_vector_id")
      .eq("user_id", actor.user.id)
      .eq("entry_id", cleanEntryId)
      .limit(1);

    if (error) {
      return NextResponse.json(
        { error: `Failed to load entry reference: ${error.message}` },
        { status: 500 },
      );
    }

    const reference = (data?.[0] as EntryReferenceRow | undefined) ?? null;
    if (!reference) {
      return NextResponse.json({ error: "Entry not found." }, { status: 404 });
    }

    try {
      await getS3Client().send(
        new DeleteObjectCommand({
          Bucket: getIngestionBucket(),
          Key: reference.s3_key,
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete entry file from S3.";
      return NextResponse.json(
        { error: `Failed to delete entry file from S3: ${message}` },
        { status: 502 },
      );
    }

    const deleteResult = await actor.supabase
      .from("entries")
      .delete()
      .eq("user_id", actor.user.id)
      .eq("entry_id", cleanEntryId)
      .select("entry_id")
      .limit(1);

    if (deleteResult.error) {
      return NextResponse.json(
        { error: `Failed to delete entry reference: ${deleteResult.error.message}` },
        { status: 500 },
      );
    }

    if (reference.pinecone_vector_id) {
      try {
        await deletePineconeEntryVector({
          userId: actor.user.id,
          vectorId: reference.pinecone_vector_id,
        });
      } catch (error) {
        console.error("[entries] failed to delete pinecone vector", {
          entryId: cleanEntryId,
          vectorId: reference.pinecone_vector_id,
          message: error instanceof Error ? error.message : "Unknown Pinecone error.",
        });
      }
    }

    return NextResponse.json({
      deleted: true,
      entry_id: reference.entry_id,
    });
  } catch (error) {
    if (isUnauthorizedError(error)) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : "Failed to delete entry.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run the route tests**

Run:

```bash
npm run test -- 'src/app/api/entries/[entryId]/route.test.ts'
```

Expected:

```text
PASS src/app/api/entries/[entryId]/route.test.ts
```

- [ ] **Step 5: Commit**

Run:

```bash
git add 'src/app/api/entries/[entryId]/route.ts' 'src/app/api/entries/[entryId]/route.test.ts'
git commit -m "feat: add hard delete for entries" -m "Add the entry delete route and keep Pinecone cleanup non-blocking."
```

## Task 5: Add Archive Grouping Helpers

**Files:**
- Create: `src/lib/entries/archive.ts`
- Create: `src/lib/entries/archive.test.ts`

- [ ] **Step 1: Write failing archive helper tests**

Create `src/lib/entries/archive.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { groupArchiveEntries } from "@/lib/entries/archive";

describe("groupArchiveEntries", () => {
  it("groups dated entries by year and sorts newest first", () => {
    expect(
      groupArchiveEntries([
        {
          entry_id: "old",
          s3_key: "entries/user/old.json",
          source_file: "journal.pdf",
          entry_date: "2025-12-12",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
        {
          entry_id: "new",
          s3_key: "entries/user/new.json",
          source_file: "journal.pdf",
          entry_date: "2026-06-03",
          created_at: "2026-06-04T00:00:00.000Z",
          updated_at: "2026-06-04T00:00:00.000Z",
        },
        {
          entry_id: "mid",
          s3_key: "entries/user/mid.json",
          source_file: "journal.pdf",
          entry_date: "2026-05-28",
          created_at: "2026-06-02T00:00:00.000Z",
          updated_at: "2026-06-02T00:00:00.000Z",
        },
      ]),
    ).toEqual([
      {
        key: "2026",
        label: "2026",
        entries: [
          expect.objectContaining({ entry_id: "new", label: "Jun 03" }),
          expect.objectContaining({ entry_id: "mid", label: "May 28" }),
        ],
      },
      {
        key: "2025",
        label: "2025",
        entries: [expect.objectContaining({ entry_id: "old", label: "Dec 12" })],
      },
    ]);
  });

  it("puts undated entries after dated groups with numbered labels", () => {
    expect(
      groupArchiveEntries([
        {
          entry_id: "dated",
          s3_key: "entries/user/dated.json",
          source_file: null,
          entry_date: "2026-06-03",
          created_at: "2026-06-03T00:00:00.000Z",
          updated_at: "2026-06-03T00:00:00.000Z",
        },
        {
          entry_id: "undated-new",
          s3_key: "entries/user/u1.json",
          source_file: null,
          entry_date: null,
          created_at: "2026-06-04T00:00:00.000Z",
          updated_at: "2026-06-04T00:00:00.000Z",
        },
        {
          entry_id: "undated-old",
          s3_key: "entries/user/u2.json",
          source_file: null,
          entry_date: null,
          created_at: "2026-06-01T00:00:00.000Z",
          updated_at: "2026-06-01T00:00:00.000Z",
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        key: "2026",
        entries: [expect.objectContaining({ entry_id: "dated", label: "Jun 03" })],
      }),
      {
        key: "undated",
        label: "Undated",
        entries: [
          expect.objectContaining({ entry_id: "undated-new", label: "Undated entry" }),
          expect.objectContaining({ entry_id: "undated-old", label: "Undated entry 2" }),
        ],
      },
    ]);
  });
});
```

- [ ] **Step 2: Run the helper test and verify it fails**

Run:

```bash
npm run test -- src/lib/entries/archive.test.ts
```

Expected:

```text
FAIL src/lib/entries/archive.test.ts
Cannot find module '@/lib/entries/archive'
```

- [ ] **Step 3: Implement archive grouping**

Create `src/lib/entries/archive.ts`:

```ts
export interface ArchiveEntryReference {
  entry_id: string;
  s3_key: string;
  source_file: string | null;
  entry_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ArchiveEntryViewModel extends ArchiveEntryReference {
  label: string;
  year: string | null;
  sortTime: number;
}

export interface ArchiveEntryGroup {
  key: string;
  label: string;
  entries: ArchiveEntryViewModel[];
}

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  timeZone: "UTC",
});

function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function parseTimestamp(value: string): number {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

export function groupArchiveEntries(
  entries: ArchiveEntryReference[],
): ArchiveEntryGroup[] {
  const datedGroups = new Map<string, ArchiveEntryViewModel[]>();
  const undated: ArchiveEntryViewModel[] = [];

  for (const entry of entries) {
    const parsedDate = entry.entry_date ? parseDateOnly(entry.entry_date) : null;

    if (parsedDate) {
      const year = String(parsedDate.getUTCFullYear());
      const viewModel: ArchiveEntryViewModel = {
        ...entry,
        label: MONTH_FORMATTER.format(parsedDate),
        year,
        sortTime: parsedDate.getTime(),
      };
      datedGroups.set(year, [...(datedGroups.get(year) ?? []), viewModel]);
    } else {
      undated.push({
        ...entry,
        label: "Undated entry",
        year: null,
        sortTime: parseTimestamp(entry.created_at),
      });
    }
  }

  const groups: ArchiveEntryGroup[] = Array.from(datedGroups.entries())
    .sort(([leftYear], [rightYear]) => Number(rightYear) - Number(leftYear))
    .map(([year, groupEntries]) => ({
      key: year,
      label: year,
      entries: groupEntries.sort((left, right) => right.sortTime - left.sortTime),
    }));

  if (undated.length > 0) {
    const sortedUndated = undated
      .sort((left, right) => right.sortTime - left.sortTime)
      .map((entry, index) => ({
        ...entry,
        label: index === 0 ? "Undated entry" : `Undated entry ${index + 1}`,
      }));

    groups.push({
      key: "undated",
      label: "Undated",
      entries: sortedUndated,
    });
  }

  return groups;
}
```

- [ ] **Step 4: Run the helper tests**

Run:

```bash
npm run test -- src/lib/entries/archive.test.ts
```

Expected:

```text
PASS src/lib/entries/archive.test.ts
```

- [ ] **Step 5: Commit**

Run:

```bash
git add src/lib/entries/archive.ts src/lib/entries/archive.test.ts
git commit -m "feat: group archive entries by date" -m "Add tested helpers for year groups, sorting, and undated labels."
```

## Task 6: Build Archive Pop-Up UI

**Files:**
- Create: `src/app/components/archive/OldEntriesArchive.tsx`

- [ ] **Step 1: Create the archive component**

Create `src/app/components/archive/OldEntriesArchive.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useDragControls } from "motion/react";
import { FileText, Trash2, X } from "lucide-react";
import { groupArchiveEntries, type ArchiveEntryReference } from "@/lib/entries/archive";
import type { ExtractedEntry } from "@/lib/ingestion/types";
import { cn } from "@/app/components/ui/utils";

const MODAL_RIGHT_OFFSET_PX = 84;
const MODAL_BOTTOM_OFFSET_PX = 80;

interface EntriesResponse {
  count: number;
  entries: ArchiveEntryReference[];
}

interface EntryDetailResponse {
  entry_id: string;
  entry_date: string | null;
  source_file: string | null;
  content: ExtractedEntry;
  error?: string;
}

interface OldEntriesArchiveProps {
  isVisible: boolean;
  onClose: () => void;
}

function parseError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const candidate = payload as { error?: unknown };
    if (typeof candidate.error === "string") return candidate.error;
  }
  return fallback;
}

export function OldEntriesArchive({ isVisible, onClose }: OldEntriesArchiveProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const [entries, setEntries] = useState<ArchiveEntryReference[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EntryDetailResponse | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dragConstraints, setDragConstraints] = useState({
    top: 0,
    right: MODAL_RIGHT_OFFSET_PX,
    bottom: MODAL_BOTTOM_OFFSET_PX,
    left: 0,
  });

  const groups = useMemo(() => groupArchiveEntries(entries), [entries]);
  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.entry_id === selectedEntryId) ?? null,
    [entries, selectedEntryId],
  );

  const updateDragConstraints = useCallback(() => {
    if (!popupRef.current) return;
    const { width: modalWidth, height: modalHeight } = popupRef.current.getBoundingClientRect();
    setDragConstraints({
      top: -Math.max(0, window.innerHeight - modalHeight - MODAL_BOTTOM_OFFSET_PX),
      right: MODAL_RIGHT_OFFSET_PX,
      bottom: MODAL_BOTTOM_OFFSET_PX,
      left: -Math.max(0, window.innerWidth - modalWidth - MODAL_RIGHT_OFFSET_PX),
    });
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    updateDragConstraints();
    window.addEventListener("resize", updateDragConstraints);
    return () => window.removeEventListener("resize", updateDragConstraints);
  }, [isVisible, updateDragConstraints]);

  useEffect(() => {
    if (!isVisible) return;

    let isActive = true;
    setIsLoadingList(true);
    setListError(null);

    fetch("/api/entries")
      .then(async (response) => {
        const payload = (await response.json()) as EntriesResponse | { error?: string };
        if (!response.ok) {
          throw new Error(parseError(payload, "Failed to load old entries."));
        }
        return payload as EntriesResponse;
      })
      .then((payload) => {
        if (isActive) setEntries(Array.isArray(payload.entries) ? payload.entries : []);
      })
      .catch((error) => {
        if (isActive) setListError(error instanceof Error ? error.message : "Failed to load old entries.");
      })
      .finally(() => {
        if (isActive) setIsLoadingList(false);
      });

    return () => {
      isActive = false;
    };
  }, [isVisible]);

  const openEntry = useCallback((entryId: string) => {
    setSelectedEntryId(entryId);
    setDetail(null);
    setDetailError(null);
    setDeleteError(null);
    setIsConfirmingDelete(false);
    setIsLoadingDetail(true);

    fetch(`/api/entries/${encodeURIComponent(entryId)}`)
      .then(async (response) => {
        const payload = (await response.json()) as EntryDetailResponse | { error?: string };
        if (!response.ok) {
          throw new Error(parseError(payload, "Entry content could not be loaded."));
        }
        return payload as EntryDetailResponse;
      })
      .then(setDetail)
      .catch((error) => {
        setDetailError(error instanceof Error ? error.message : "Entry content could not be loaded.");
      })
      .finally(() => setIsLoadingDetail(false));
  }, []);

  const closeViewer = useCallback(() => {
    setSelectedEntryId(null);
    setDetail(null);
    setDetailError(null);
    setDeleteError(null);
    setIsConfirmingDelete(false);
    setIsDeleting(false);
  }, []);

  const deleteSelectedEntry = useCallback(async () => {
    if (!selectedEntryId) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/entries/${encodeURIComponent(selectedEntryId)}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(parseError(payload, "Failed to delete entry."));
      }
      setEntries((current) => current.filter((entry) => entry.entry_id !== selectedEntryId));
      closeViewer();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Failed to delete entry.");
    } finally {
      setIsDeleting(false);
    }
  }, [closeViewer, selectedEntryId]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          ref={popupRef}
          className="absolute bottom-[80px] right-[84px] z-20 w-[432px] rounded-[2px] bg-[#333332] text-white"
          drag
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={dragConstraints}
          dragElastic={0}
          dragMomentum={false}
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex w-full flex-col overflow-hidden rounded-[inherit]">
            <div className="relative border-b border-white/10">
              <div
                className="flex w-full touch-none select-none items-center justify-between p-[8px]"
                onPointerDown={(event) => dragControls.start(event)}
              >
                <div className="flex items-center gap-[8px]">
                  <FileText size={16} className="text-white/90" />
                  <p className="font-manrope text-[12px] font-semibold text-white">
                    We&apos;re seeing old entries
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close old entries"
                  onClick={onClose}
                  onPointerDown={(event) => event.stopPropagation()}
                  className="flex size-[18px] items-center justify-center bg-white/10 text-white/80 transition-colors hover:bg-white/20"
                >
                  <X size={12} />
                </button>
              </div>
            </div>

            <div className="max-h-[460px] overflow-auto px-[18px] py-[16px]">
              {isLoadingList ? (
                <p className="font-manrope text-[12px] text-white/60">Loading old entries...</p>
              ) : listError ? (
                <p className="font-manrope text-[12px] text-[#ffb3b3]">{listError}</p>
              ) : groups.length === 0 ? (
                <p className="font-manrope text-[12px] text-white/60">No old entries yet.</p>
              ) : (
                <div className="flex flex-col gap-[20px]">
                  {groups.map((group) => (
                    <section key={group.key} className="flex flex-col gap-[10px]">
                      <p className="font-manrope text-[12px] font-semibold text-white/50">{group.label}</p>
                      <div className="grid grid-cols-4 gap-x-[14px] gap-y-[16px]">
                        {group.entries.map((entry) => (
                          <button
                            key={entry.entry_id}
                            type="button"
                            onDoubleClick={() => openEntry(entry.entry_id)}
                            className="flex min-h-[86px] flex-col items-center justify-start gap-[6px] rounded-[4px] px-[4px] py-[6px] text-center transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35"
                          >
                            <FileText size={36} className="text-white/85" />
                            <span className="w-full break-words font-manrope text-[11px] leading-[1.2] text-white/80">
                              {entry.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>
          </div>

          {selectedEntryId && (
            <div className="absolute bottom-0 left-[-360px] w-[340px] rounded-[2px] bg-[#2b2b2a] shadow-[0px_18px_48px_rgba(0,0,0,0.32)]">
              <div className="flex items-center justify-between border-b border-white/10 p-[8px]">
                <p className="font-manrope text-[12px] font-semibold text-white">
                  {selectedEntry?.entry_date ?? "Undated entry"}
                </p>
                <button
                  type="button"
                  aria-label="Close entry viewer"
                  onClick={closeViewer}
                  className="flex size-[18px] items-center justify-center bg-white/10 text-white/80 transition-colors hover:bg-white/20"
                >
                  <X size={12} />
                </button>
              </div>

              <div className="flex max-h-[420px] flex-col gap-[12px] overflow-auto p-[16px]">
                {selectedEntry?.source_file ? (
                  <p className="font-manrope text-[11px] text-white/45">{selectedEntry.source_file}</p>
                ) : null}

                {isLoadingDetail ? (
                  <p className="font-manrope text-[12px] text-white/60">Opening entry...</p>
                ) : detailError ? (
                  <p className="font-manrope text-[12px] text-[#ffb3b3]">{detailError}</p>
                ) : (
                  <p className="whitespace-pre-wrap font-manrope text-[13px] leading-[1.55] text-white/82">
                    {detail?.content.entry_text ?? ""}
                  </p>
                )}

                {deleteError ? (
                  <p className="font-manrope text-[12px] text-[#ffb3b3]">{deleteError}</p>
                ) : null}

                <div className="flex gap-[8px]">
                  {isConfirmingDelete ? (
                    <>
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => void deleteSelectedEntry()}
                        className="flex flex-1 items-center justify-center gap-[6px] rounded-[3px] bg-[#ffb3b3] px-[10px] py-[9px] font-inter text-[12px] text-black disabled:opacity-60"
                      >
                        <Trash2 size={14} />
                        {isDeleting ? "DELETING" : "CONFIRM DELETE"}
                      </button>
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => setIsConfirmingDelete(false)}
                        className="rounded-[3px] border border-white/20 px-[10px] py-[9px] font-inter text-[12px] text-white disabled:opacity-60"
                      >
                        CANCEL
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsConfirmingDelete(true)}
                      className="flex items-center gap-[6px] rounded-[3px] border border-white/20 px-[10px] py-[9px] font-inter text-[12px] text-white transition-colors hover:bg-white/10"
                    >
                      <Trash2 size={14} />
                      DELETE
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[2px] border border-white/5 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.25)]"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Run TypeScript through build**

Run:

```bash
npm run build
```

Expected:

```text
Compiled successfully
```

If the build reports a TypeScript error in `OldEntriesArchive.tsx`, fix the named property or import exactly where the build points.

- [ ] **Step 3: Commit**

Run:

```bash
git add src/app/components/archive/OldEntriesArchive.tsx
git commit -m "feat: add old entries archive popup" -m "Add the archive window, lazy entry viewer, and delete confirmation UI."
```

## Task 7: Add The Archive Icon Beside Importer

**Files:**
- Modify: `src/app/components/shared/screen-primitives.tsx`

- [ ] **Step 1: Import the archive component and icon**

At the top of `src/app/components/shared/screen-primitives.tsx`, add:

```ts
import { FileText } from "lucide-react";
import { OldEntriesArchive } from "@/app/components/archive/OldEntriesArchive";
```

If there is already a `lucide-react` import, add `FileText` to it instead of creating a second import.

- [ ] **Step 2: Add a reusable dock icon button**

Replace the current `PrimaryDockIcon` function with:

```tsx
function DockIconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="dock-glass cursor-pointer bg-[rgba(235,235,235,0.3)] transition-colors hover:bg-[rgba(255,255,255,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35"
    >
      <div aria-hidden="true" className="dock-glass-border" />
      <div className="dock-icon-frame">{children}</div>
    </button>
  );
}

function ImporterDockIcon({ onClick }: { onClick: () => void }) {
  return (
    <DockIconButton label="Open importer" onClick={onClick}>
      <svg width="40" height="40" fill="none" viewBox="0 0 40 40">
        <path
          d="M33.0361 10.0001C33.5202 10.0002 33.9984 10.1058 34.4375 10.3095C34.8766 10.5132 35.266 10.81 35.5788 11.1794C35.8916 11.5488 36.1202 11.9819 36.2486 12.4486C36.3771 12.9152 36.4024 13.4043 36.3228 13.8817L33.5461 30.5484C33.4163 31.3267 33.0146 32.0337 32.4125 32.5437C31.8104 33.0537 31.0469 33.3335 30.2578 33.3334H9.74781C8.95875 33.3335 8.19523 33.0537 7.5931 32.5437C6.99098 32.0337 6.58928 31.3267 6.45948 30.5484L3.68281 13.8817C3.60319 13.4043 3.6285 12.9152 3.75698 12.4486C3.88547 11.9819 4.11404 11.5488 4.42682 11.1794C4.73959 10.81 5.12907 10.5132 5.56817 10.3095C6.00726 10.1058 6.48545 10.0002 6.96948 10.0001H33.0361Z"
          fill="white"
          fillOpacity="0.9"
        />
        <path
          d="M30.0019 5.0001C30.4439 5.0001 30.8678 5.17569 31.1804 5.48825C31.4929 5.80081 31.6685 6.22474 31.6685 6.66677C31.6685 7.10879 31.4929 7.53272 31.1804 7.84528C30.8678 8.15784 30.4439 8.33343 30.0019 8.33343H10.0019C9.55985 8.33343 9.13593 8.15784 8.82336 7.84528C8.5108 7.53272 8.33521 7.10879 8.33521 6.66677C8.33521 6.22474 8.5108 5.80081 8.82336 5.48825C9.13593 5.17569 9.55985 5.0001 10.0019 5.0001H30.0019Z"
          fill="white"
          fillOpacity="0.9"
          opacity="0.3"
        />
      </svg>
    </DockIconButton>
  );
}

function ArchiveDockIcon({ onClick }: { onClick: () => void }) {
  return (
    <DockIconButton label="We're seeing old entries" onClick={onClick}>
      <FileText size={38} strokeWidth={1.7} className="text-white/90" />
    </DockIconButton>
  );
}
```

- [ ] **Step 3: Update `DockWithImporter`**

Replace `DockWithImporter` with:

```tsx
export function DockWithImporter() {
  const [showImporter, setShowImporter] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const toggleImporter = useCallback(() => setShowImporter((value) => !value), []);
  const toggleArchive = useCallback(() => setShowArchive((value) => !value), []);

  return (
    <>
      <div className="dock-shell flex gap-[10px]">
        <ImporterDockIcon onClick={toggleImporter} />
        <ArchiveDockIcon onClick={toggleArchive} />
      </div>
      <ImporterPopup
        isVisible={showImporter}
        onClose={() => setShowImporter(false)}
      />
      <OldEntriesArchive
        isVisible={showArchive}
        onClose={() => setShowArchive(false)}
      />
    </>
  );
}
```

- [ ] **Step 4: Run build to catch component errors**

Run:

```bash
npm run build
```

Expected:

```text
Compiled successfully
```

- [ ] **Step 5: Commit**

Run:

```bash
git add src/app/components/shared/screen-primitives.tsx
git commit -m "feat: add archive dock icon" -m "Show the old entries archive beside the importer in the shared dock."
```

## Task 8: Full Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm run test -- src/lib/entries/content.test.ts src/lib/entries/archive.test.ts src/lib/entries/embedding-clients.test.ts 'src/app/api/entries/[entryId]/route.test.ts'
```

Expected:

```text
PASS src/lib/entries/content.test.ts
PASS src/lib/entries/archive.test.ts
PASS src/lib/entries/embedding-clients.test.ts
PASS src/app/api/entries/[entryId]/route.test.ts
```

- [ ] **Step 2: Run the full test suite**

Run:

```bash
npm run test
```

Expected:

```text
Test Files  all passed
Tests  all passed
```

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected:

```text
No ESLint errors
```

- [ ] **Step 4: Run production build**

Run:

```bash
npm run build
```

Expected:

```text
Compiled successfully
```

- [ ] **Step 5: Manual smoke test in browser**

Run:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Check:

- The dock shows the importer icon and the old entries icon side by side.
- Clicking the old entries icon opens `We're seeing old entries`.
- Entries are grouped by year.
- Undated entries show `Undated entry` labels.
- Double-clicking a file icon opens the viewer.
- Plain text content opens without a JSON parse error.
- Delete asks for confirmation.
- Successful delete removes the icon.

- [ ] **Step 6: Commit verification-only fixes if needed**

If verification required small fixes, commit them:

```bash
git add src
git commit -m "fix: polish old entries archive" -m "Resolve verification issues found while testing the archive flow."
```

If no fixes were needed, do not create a commit.

## Self-Review

Spec coverage:

- Dock icon beside importer: Task 7.
- Date-grouped file icons: Tasks 5 and 6.
- Lazy content fetch: Task 6 uses `/api/entries` first and `/api/entries/[entryId]` on double-click.
- Plain text S3 support: Task 1.
- Delete endpoint: Tasks 2, 3, and 4.
- Delete UI: Task 6.
- Error handling: Tasks 4 and 6.
- Tests: Tasks 1, 2, 3, 5, and 8.

Plan quality scan:

- No vague markers or fill-in steps.
- Each code task includes exact files, exact commands, and concrete code.

Type consistency:

- Entry metadata uses `ArchiveEntryReference`.
- Entry content uses existing `ExtractedEntry`.
- Detail response uses `content.entry_text`.
- Delete response uses `{ deleted: true, entry_id }`.
