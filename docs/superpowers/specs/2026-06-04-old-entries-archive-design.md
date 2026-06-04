# Old Entries Archive Design

## Summary

Add an archive icon beside the importer icon. It opens a desktop-like pop-up for old entries.

The archive shows each entry as a file icon. The visible file name is the entry date. Entries are grouped by year and ordered newest to oldest. Entries without dates use `Undated entry`, `Undated entry 2`, and so on.

Double-clicking an entry opens a viewer pop-up. The viewer fetches the full entry content from S3 only when the user opens it. This uses lazy loading, which means the app fetches data only when the user needs it.

The viewer also supports deleting an entry. Delete is a hard delete. It removes the Supabase entry row, the S3 object, and the Pinecone vector when possible.

## Goals

- Add a second dock icon beside the importer.
- Show old entries as date-named file icons.
- Group dated entries by year.
- Put undated entries after dated entries.
- Fetch full entry text only after a user double-clicks an entry.
- Support JSON and plain text entry content from S3.
- Let users delete entries from the viewer.
- Keep the archive responsive when many entries exist.

## Non-Goals

- No search in the first version.
- No filters in the first version.
- No keyboard navigation in the first version.
- No bulk delete in the first version.
- No soft delete or restore flow.

## Existing Context

The app is a Next.js App Router app.

The dock is centralized in `src/app/components/shared/screen-primitives.tsx` through `DockWithImporter`. This means the archive icon can be added beside the importer in one shared place.

The app already has `GET /api/entries`. It lists entry metadata. It can also hydrate content with `includeContent=true`, but the archive should not use that for the first list load.

The app already has `GET /api/entries/[entryId]`. It loads one entry reference from Supabase and reads its content from S3. It currently expects valid JSON. This must be made more forgiving so plain text S3 objects do not throw a `JSON.parse` error.

Entries are stored in the `entries` table. Relevant fields are `entry_id`, `s3_key`, `source_file`, `entry_date`, `created_at`, `updated_at`, and optional embedding fields like `pinecone_vector_id`.

## UI Design

### Dock

`DockWithImporter` becomes a shared dock with two icons:

- Importer.
- Old entries archive.

The icons sit beside each other in the same dock area.

The archive icon opens and closes the archive pop-up.

### Archive Pop-Up

The archive pop-up is draggable. It uses the same operating-system-like style as the importer.

Title: `We're seeing old entries`

The pop-up loads entry metadata from `GET /api/entries`.

It renders dated entries by year:

- `2026`
- `2025`
- `2024`

Inside each year, entries appear as file icons. They are sorted newest to oldest.

Each file label is the formatted date, such as `Jun 03` inside a year group. If a full date label is clearer in the final UI, `Jun 03, 2026` is acceptable.

Undated entries render after all dated year groups. They use:

- `Undated entry`
- `Undated entry 2`
- `Undated entry 3`

### Entry Viewer

Double-clicking a file icon opens a viewer pop-up.

The viewer calls `GET /api/entries/[entryId]` and shows:

- Date or `Undated entry`.
- Source file when available.
- Entry text.
- Delete action.

The archive remains open while the viewer is open.

### Delete UI

Delete is available inside the entry viewer.

When the user clicks delete, show a confirmation state before calling the API.

While delete is running:

- Disable the delete button.
- Keep the viewer open.
- Show a short in-progress state.

When delete succeeds:

- Close the viewer.
- Remove the file icon from the archive list.
- If the removed entry was the last item in a year group, remove that year group.

When delete fails:

- Keep the viewer open.
- Keep the entry visible in the archive.
- Show the error near the delete action.

## API Design

### List Entries

Use the existing endpoint:

`GET /api/entries`

The archive should call this without `includeContent=true`.

The response should include:

- `entry_id`
- `s3_key`
- `source_file`
- `entry_date`
- `created_at`
- `updated_at`

The route should continue to enforce the logged-in user.

### Get Entry Detail

Use the existing endpoint:

`GET /api/entries/[entryId]`

Behavior:

1. Authenticate the user.
2. Find the entry row by `user_id` and `entry_id`.
3. Read the S3 object at `s3_key`.
4. Parse the content.
5. Return the normalized entry.

Content parsing must support:

- A single JSON entry object.
- A JSON array of entry objects.
- A JSON object with an `entries` array.
- Plain text.

Plain text should return an entry-like object:

```json
{
  "date": null,
  "entry_text": "raw plain text",
  "source_file": "source file when available"
}
```

If JSON parsing fails, treat the S3 body as plain text instead of returning a JSON parse error.

### Delete Entry

Add:

`DELETE /api/entries/[entryId]`

Behavior:

1. Authenticate the user.
2. Load the entry row by `user_id` and `entry_id`.
3. Return `404` if no owned entry exists.
4. Delete the S3 object at `s3_key`.
5. Delete the Supabase row.
6. Delete the Pinecone vector if `pinecone_vector_id` exists.
7. Return a success response.

Delete should be treated as a hard delete.

If S3 deletion fails, return an error and keep the database row.

If Supabase deletion fails, return an error.

If Pinecone deletion fails, log the failure and still return success after the database row and S3 object are deleted. This avoids trapping the user because cleanup of the search copy failed.

The endpoint must never delete an entry owned by another user.

## Data Flow

Initial archive open:

1. User clicks archive icon.
2. UI calls `GET /api/entries`.
3. UI groups entries by year.
4. UI renders file icons.

Entry open:

1. User double-clicks an entry icon.
2. UI opens viewer in a loading state.
3. UI calls `GET /api/entries/[entryId]`.
4. API reads S3.
5. UI shows entry text.

Entry delete:

1. User clicks delete.
2. UI asks for confirmation.
3. UI calls `DELETE /api/entries/[entryId]`.
4. API deletes S3 and Supabase data.
5. API attempts Pinecone cleanup.
6. UI removes the entry from the archive.

## Error Handling

Archive list failures show a short error inside the archive pop-up.

Entry detail failures show a short error in the viewer. The archive stays open.

Plain text S3 content is valid content.

Missing or empty S3 content returns a user-facing message: `Entry content could not be loaded.`

Delete failures show a short error in the viewer. The entry remains visible.

Unauthorized API calls return `401`.

Owned-entry misses return `404`.

## Testing Plan

API tests:

- `GET /api/entries` returns metadata without content by default.
- `GET /api/entries/[entryId]` handles a JSON entry object.
- `GET /api/entries/[entryId]` handles a JSON array.
- `GET /api/entries/[entryId]` handles a JSON object with `entries`.
- `GET /api/entries/[entryId]` handles plain text.
- `DELETE /api/entries/[entryId]` rejects unauthenticated users.
- `DELETE /api/entries/[entryId]` returns `404` for entries owned by another user.
- `DELETE /api/entries/[entryId]` deletes the S3 object and Supabase row.
- `DELETE /api/entries/[entryId]` attempts Pinecone cleanup when `pinecone_vector_id` exists.
- `DELETE /api/entries/[entryId]` still succeeds if only Pinecone cleanup fails.

UI tests or focused component tests:

- Archive groups entries by year.
- Archive sorts dated entries newest to oldest.
- Archive labels undated entries as `Undated entry`, `Undated entry 2`, and so on.
- Double-clicking a file icon opens the viewer.
- Successful delete removes the icon from the archive.
- Failed delete keeps the icon visible and shows an error.

## Implementation Notes

Prefer small components inside or near `screen-primitives.tsx` unless the file becomes too large. If it grows too much, split the archive into focused components under `src/app/components/archive/`.

Use existing UI primitives and visual patterns before adding new abstractions.

Use server-side AWS and Pinecone clients only inside API routes or server-only helpers.

Do not fetch all entry content during archive list load.
