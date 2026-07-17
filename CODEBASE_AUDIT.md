# Codebase Efficiency Audit

Audit date: 2026-07-13
Baseline commit: `ff0cd65`
Status: complete, fixes not started

## Scope

Reviewed:

- All files under `src/`.
- All SQL migrations.
- Build, lint, test, TypeScript, and package configuration.
- Repository documentation for stale implementation material.

Excluded:

- `node_modules/`, `.next/`, and generated build output as source code.
- Security and correctness issues unless they directly cause wasted work.

Baseline measurements:

- 90 TypeScript and TSX files.
- 12,343 source, style, and migration lines.
- 19 test files and 98 passing tests.
- Main route: 191 kB first-load JavaScript.
- Login landing route: 219 kB first-load JavaScript.
- Middleware: 82.1 kB.
- Production CSS: 61,973 bytes.
- Emitted font files: 550,296 bytes. Browsers only fetch the subsets they use.
- No dependency is clearly removable.

Priority meanings:

- P0: can repeat paid work or create duplicate external operations.
- P1: large user-facing or operational cost.
- P2: meaningful cost as data or traffic grows.
- P3: cleanup with a smaller runtime effect.

## Findings

### [ ] A001 - P0 - Finalization runs inside a repeatable GET request

Tags: `native`, `shrink`

Evidence:

- `src/app/api/ingestion/[ingestionId]/results/route.ts:370` reads every source object from S3.
- `src/app/api/ingestion/[ingestionId]/results/route.ts:424` writes split objects back to S3.
- `src/app/api/ingestion/[ingestionId]/results/route.ts:442` upserts database rows.
- `src/app/api/ingestion/[ingestionId]/results/route.ts:468` schedules embeddings.
- `src/app/api/ingestion/[ingestionId]/results/route.ts:299` only excludes entries already marked `indexed`. A second request can queue entries still marked `pending` again.

Impact:

A refresh or retry can repeat S3 writes, database writes, OpenAI calls, and Pinecone calls. This endpoint is not idempotent [safe to repeat without doing the work again].

Smallest fix:

Move finalization into the existing ingestion worker. Make this GET route read stored results only. If that move must wait, add an atomic claim [a database update that only one request can win] before finalization.

Done when:

- Repeating the GET request causes no writes and no new embedding jobs.
- Two simultaneous requests cannot queue the same entry twice.

### [ ] A002 - P1 - Embeddings run one entry at a time

Tags: `native`, `shrink`

Evidence:

- `src/lib/entries/embedding-index.ts:183` awaits each entry inside a loop.
- One successful entry performs a pending database update, an OpenAI call, a Pinecone call, and an indexed database update.

Impact:

`N` entries cause about `4N` serial network calls. Twenty entries can require about 80 calls in sequence.

Smallest fix:

Batch [send several items in one request] OpenAI inputs, Pinecone records, and database updates. If batching changes too much at once, start with a small concurrency limit [a cap on how many tasks run at the same time].

Done when:

- Network call count no longer grows by four serial calls per entry.
- Partial failures still mark only the affected entries as failed.

### [ ] A003 - P1 - Common authentication always queries the client table

Tags: `yagni`, `shrink`

Evidence:

- `src/lib/ingestion/auth.ts:100` always calls `ensurePrimaryClient`.
- `src/lib/ingestion/auth.ts:41` queries `clients` first.
- `migrations/002_create_client_on_auth_signup.sql:22` already creates the primary client and backfills old users.
- Entry listing, entry detail, entry deletion, presigning, and status polling do not use `actor.clientId`.

Impact:

Those handlers pay for one unused database round trip. Status polling pays it every three seconds. A normal poll currently needs authentication, a client lookup, and an S3 manifest read.

Smallest fix:

Return only `supabase` and `user` from the common auth helper. Resolve `clientId` only in submit and reflection operations that use it.

Expected cut: 25 to 40 lines and one database request from five handlers.

### [ ] A004 - P1 - Results return full journal text when the UI only needs a count

Tags: `shrink`

Evidence:

- `src/app/api/ingestion/[ingestionId]/results/route.ts:477` returns every full entry and every entry key.
- `src/app/components/shared/screen-primitives.tsx:356` only reads `entries.length`.

Impact:

The response grows with all extracted journal text. The browser parses and keeps data it immediately discards.

Smallest fix:

Return `entryCount` instead of `entries` and `entryKeys`. Keep entry content behind the existing single-entry endpoint.

Done when:

- The importer can show the count without downloading journal text.
- The results response stays nearly constant in size as entry text grows.

### [ ] A005 - P1 - An unused entry-list mode can launch 500 S3 reads

Tags: `delete`, `yagni`

Evidence:

- `src/app/api/entries/route.ts:95` accepts `includeContent=true`.
- `src/app/api/entries/route.ts:124` launches one S3 request per database row with no limit on simultaneous requests.
- The route allows 500 rows.
- No runtime caller in this repository uses `includeContent`.
- The archive already uses `src/app/api/entries/[entryId]/route.ts` for one entry at a time.

Impact:

This dormant path is an N+1 pattern [one database request followed by one storage request for each result]. It can open hundreds of requests and hold hundreds of documents in memory.

Smallest fix:

Delete `includeContent` and its parsing helpers. Keep metadata listing and the single-entry endpoint.

Expected cut: about 105 lines.

### [ ] A006 - P1 - Saving a reflection waits for embedding work

Tags: `native`, `shrink`

Evidence:

- `src/lib/reflections/session.ts:420` waits for the full embedding pipeline before returning.
- `src/lib/entries/embedding-background.ts:18` already provides a background scheduler.

Impact:

The user waits for database, OpenAI, Pinecone, and another database call after the entry is already saved.

Smallest fix:

Reuse the existing background scheduler. Return `embedding_status: "pending"` after S3 and database storage succeed.

### [ ] A007 - P2 - Related reflection entries are read from S3 serially

Tags: `native`

Evidence:

- `src/lib/reflections/session.ts:229` loops through up to eight matches.
- `src/lib/reflections/session.ts:234` awaits each S3 read before starting the next one.

Impact:

Reflection startup can wait for eight storage round trips back-to-back before the Anthropic call starts.

Smallest fix:

Hydrate the eight matches with `Promise.all`, preserve their order, then filter unreadable results.

### [ ] A008 - P2 - Database indexes do not match the real queries

Tags: `delete`, `native`

Evidence:

- `src/app/api/entries/route.ts:101` filters by `user_id`, sorts by `created_at DESC`, and limits the result.
- No index covers `(user_id, created_at DESC)`.
- `migrations/001_initial_clients_entries.sql:26` creates a unique index for `(user_id, name)`.
- `migrations/001_initial_clients_entries.sql:39` creates a unique index for `(user_id, entry_id)`.
- `migrations/001_initial_clients_entries.sql:44` to `:47` add three indexes that duplicate those unique indexes fully or by their first column.

Impact:

Entry listing can sort more rows than needed. Inserts and updates also maintain three redundant lookup structures.

Smallest fix:

Add a new migration. Drop `idx_clients_user_id`, `idx_entries_user_id`, and `idx_entries_user_entry`. Add a composite index [one index covering several columns] on `(user_id, created_at DESC)`.

Do not rewrite applied migrations.

### [ ] A009 - P2 - A small screen primitive pulls importer code into login

Tags: `shrink`

Evidence:

- `src/app/components/LoginScreen.tsx:2` imports `FadeScreen` from `screen-primitives.tsx`.
- `src/app/components/shared/screen-primitives.tsx:16` imports the archive.
- The same 1,064-line module contains the complete importer from line 286 onward.
- The production login route includes a 28,329-byte raw chunk containing importer and archive strings.
- The login route reaches 219 kB first-load JavaScript.

Impact:

The login page downloads importer and archive code it cannot use.

Smallest fix:

Keep `FadeScreen`, `ScreenHeader`, and enter controls in the small primitives module. Move `DockWithImporter` and its private code to its own module. Confirm the importer chunk disappears from the login route after the split.

### [ ] A010 - P2 - Every workflow screen is loaded before the first screen appears

Tags: `native`

Evidence:

- `src/app/App.tsx:10` to `:20` statically import all workflow screens.
- Several large screens are only reachable later: `ReflectionAnalysisScreen.tsx` is 768 lines, `OldEntriesArchive.tsx` is 464 lines, and `PostReflectionActivityScreen.tsx` is 332 lines.
- The main route starts at 191 kB first-load JavaScript.

Impact:

The browser parses late-flow code before showing the greeting.

Smallest fix:

Use code splitting [download code only when that part of the app is needed] for the heaviest later screens and archive popup. Measure after each split. Keep a split only when the build report improves.

### [ ] A011 - P2 - Random reflection selection needs count plus offset queries

Tags: `native`

Evidence:

- `src/lib/reflections/session.ts:156` runs an exact count.
- `src/lib/reflections/session.ts:185` runs another query with a random offset.
- Failed hydration can repeat the offset query up to ten times.

Impact:

The first entry needs at least two database calls before S3 is read. Large offsets get slower as a user stores more entries.

Smallest fix:

Add one small Postgres function that returns one random eligible row. Keep the current method until query timing shows this path matters.

### [ ] A012 - P3 - The same S3 body decoder exists four times

Tags: `native`, `shrink`

Evidence:

- `src/app/api/entries/route.ts:18`
- `src/app/api/ingestion/[ingestionId]/results/route.ts:41`
- `src/lib/entries/content.ts:14`
- `src/lib/ingestion/manifest.ts:23`

Impact:

About 120 lines maintain the same stream branches and temporary buffers.

Smallest fix:

Use the AWS SDK body's native `transformToString()` method in these Node.js paths. Keep one tiny shared fallback only if a test proves another body shape is required.

Expected cut: 100 to 110 lines.

### [ ] A013 - P3 - Archive grouping copies growing arrays

Tags: `shrink`

Evidence:

- `src/lib/entries/archive.ts:70` spreads the whole year group for every added entry.

Impact:

One large year causes quadratic work [work that grows roughly with the square of the entry count] and repeated allocations.

Smallest fix:

Get the existing array and call `push`.

### [ ] A014 - P3 - Successful embedding work produces many server logs

Tags: `delete`

Evidence:

- The codebase has 26 `console.log`, `console.warn`, and `console.error` calls.
- A successful embedding logs pending, OpenAI start, OpenAI complete, Pinecone start, Pinecone complete, and vector completion.
- Most success logs are not behind a debug flag.

Impact:

Large imports create high log volume and extra serverless logging cost.

Smallest fix:

Keep errors and one batch summary. Put per-entry success logs behind `INGESTION_DEBUG` or remove them.

### [ ] A015 - P3 - Dead helpers and migration compatibility remain

Tags: `delete`, `yagni`

Evidence:

- `src/lib/ingestion/s3-keys.ts:12`, `:33`, and `:37` export helpers with no callers.
- `src/lib/ingestion/types.ts:65` exports terminal-status helpers with no callers while two modules keep local copies.
- `src/lib/entries/embedding-clients.ts:171` to `:237` handles schemas missing fields added by migration 007.

Impact:

Dead code adds maintenance work. The schema fallback can issue a failed update before retrying, but it cannot make the rest of the application work against a fully stale schema.

Smallest fix:

Delete unused helpers. Reuse one terminal-status helper or keep the two simple local checks. Remove the schema fallback only after every deployed database confirms migration 007.

Expected cut after migration confirmation: 55 to 65 lines.

### [ ] A016 - P3 - Completed implementation plans dominate repository docs

Tags: `delete`

Evidence:

- Repository documentation totals 7,473 lines.
- Five completed implementation plans total 5,629 lines.
- Their named features are present in the current source.

Impact:

Search results and repository navigation include a large amount of historical step-by-step material. There is no runtime cost.

Smallest fix:

Keep design decisions. Archive or delete completed step-by-step plans after confirming they are no longer used for onboarding.

## Recommended Order

1. A001. Stop repeated finalization and duplicate paid calls.
2. A003 and A004. Remove one request from polling and shrink the result payload.
3. A002 and A006. Shorten embedding work and move it off the user response path.
4. A005 and A012. Delete unused and duplicated storage code.
5. A007 and A008. Improve reflection and archive query latency.
6. A009 and A010. Reduce initial browser work and confirm with a new build report.
7. A013 to A016. Take the low-risk cleanup wins.

## Verification Record

- [x] `npm test`: 19 files passed, 98 tests passed.
- [x] `npm run lint`: passed.
- [x] `npm run build`: passed.
- [x] `npx tsc --noEmit --noUnusedLocals --noUnusedParameters`: passed.
- [x] Production route sizes recorded above.
- [x] Declared dependencies checked against imports and framework-required packages.
- [ ] Production request traces reviewed. Not available in this local audit.
- [ ] Database query plans reviewed with real production row counts. Not available in this local audit.

## Ponytail Summary

- `delete:` remove the unused `includeContent` mode, dead key/status helpers, redundant indexes, noisy success logs, and confirmed stale compatibility code.
- `native:` use the ingestion worker, background scheduler, AWS stream conversion, batched provider calls, and a query-shaped Postgres index.
- `yagni:` stop resolving `clientId` in handlers that do not use it.
- `shrink:` return a result count, parallelize related S3 reads, and split importer code away from login primitives.

Net: about -250 to -300 application lines, -0 dependencies, and -3 redundant database indexes possible. One query-shaped index should be added.
