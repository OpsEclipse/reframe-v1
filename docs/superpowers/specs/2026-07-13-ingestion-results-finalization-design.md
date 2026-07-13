# Ingestion Results Finalization Design

Date: 2026-07-13

## Goal

Make `GET /api/ingestion/[ingestionId]/results` safe to repeat.

Today the route finalizes ingestion results inside a repeatable GET request. A refresh, retry, or concurrent request can repeat S3 writes, database upserts, and embedding scheduling. The fix is to add a manifest-backed finalization gate [a saved state marker that lets only one request perform the expensive work].

## Scope

In scope:

- Add finalization state to ingestion manifests.
- Let one request claim result finalization before it writes results.
- Return stored finalized results on later requests.
- Return `409` while another request is finalizing.
- Let retries run again after a failed finalization.
- Let the importer read a stored `entryCount` so repeated result reads do not need full entry text.
- Add focused tests for the claim, finalized, finalizing, and retry paths.

Out of scope:

- Moving finalization into the external ingestion worker.
- Changing how Textract or the starter Lambda works.
- Batching embeddings.
- Redesigning the importer UI.

## Manifest Shape

Extend `IngestionManifest` with optional fields:

- `resultsFinalizationStatus`: `"FINALIZING" | "FINALIZED" | "FAILED"`
- `resultsFinalizationStartedAt`: ISO timestamp for the active claim.
- `resultsFinalizedAt`: ISO timestamp for successful completion.
- `resultsFinalizationError`: last failure message, or `null`.
- `resultEntryKeys`: finalized per-entry object keys.
- `resultEntryCount`: finalized entry count.
- `resultReferencesSynced`: number of database rows synced.
- `resultEmbeddingsQueued`: number of embedding records scheduled.

Old manifests may not have these fields. Missing fields mean results are not finalized yet.

## Route Behavior

The results route keeps its current authentication and terminal-status checks.

After those checks:

1. Read the manifest with its S3 ETag [a version identifier for the object].
2. If `resultsFinalizationStatus` is `"FINALIZED"`, return the stored result summary from the manifest. Do not read entry objects, write S3, upsert rows, or schedule embeddings.
3. If `resultsFinalizationStatus` is `"FINALIZING"`, return `409` with `{ error, status: "FINALIZING" }`. Do not do finalization work.
4. Otherwise, write a claim manifest with `resultsFinalizationStatus: "FINALIZING"`, a start timestamp, and cleared error. Use S3 `IfMatch` with the ETag from step 1 so only one request can win the claim.
5. If the claim write loses the ETag race, return `409` with `{ error, status: "FINALIZING" }`.
6. Run the existing finalization work.
7. On success, write a finalized manifest with stored result keys and counts.
8. On failure, write a failed manifest with `resultsFinalizationStatus: "FAILED"` and the error message, then return the existing `500` response.

This is a minimal in-repo fix that uses S3 conditional writes [writes that only succeed if the stored object still has the expected version] instead of adding a new database lock table.

## Data Flow

The first successful finalization still:

- Reads extracted entry objects from S3.
- Splits multi-entry payloads into per-entry objects.
- Upserts entry metadata into Supabase.
- Looks up embedding status.
- Schedules background embedding indexing.

Later result reads use only the manifest summary:

- `ingestionId`
- `entryCount`
- `entries: []`
- `referencesSynced`
- `embeddingsQueued`
- `entryKeys`

The importer should read `entryCount` when present and fall back to `entries.length`. This keeps first-time responses compatible and lets repeated reads avoid downloading or storing full journal text.

## Failure And Retry

If finalization fails after the claim:

- The route records the failure in the manifest.
- A later request may claim finalization again because `"FAILED"` is retryable.
- The route keeps returning the original error status for that failing request.

If a request sees `"FINALIZING"`, it does not retry inside the same request. The client already polls status and can request results again.

If a request loses the S3 `IfMatch` claim race, it returns the same `409 FINALIZING` response. That handles two simultaneous requests without running finalization twice.

## Testing

Add route-level tests for:

- Returning stored finalized results does not call S3 writes, database upserts, or embedding scheduling.
- A finalizing manifest returns `409`.
- A claim conflict returns `409`.
- A failed manifest is retryable and can claim finalization again.
- A successful first finalization writes `"FINALIZING"` before work and `"FINALIZED"` after work.
- The importer count uses `entryCount` when present and falls back to `entries.length`.

Add manifest helper tests if helpers are introduced.

## Acceptance Criteria

- Repeating a finalized results request causes no writes and schedules no embedding jobs.
- A second request during finalization does no writes and returns `409`.
- Two simultaneous claim attempts cannot both finalize the same ingestion.
- Failed finalization can be retried.
- Existing tests, lint, and build pass.
