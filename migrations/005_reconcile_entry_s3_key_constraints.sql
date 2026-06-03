-- Reconcile entry S3 key validation across environments.
-- Supports both layouts during migration window:
-- 1) entries/{user_uuid}/{file}.json
-- 2) entries/{user_uuid}/{ingestion_uuid}/{file}.json

alter table public.entries
  drop constraint if exists entries_s3_key_check;

alter table public.entries
  add constraint entries_s3_key_check
  check (
    s3_key ~ '^entries/[0-9a-fA-F-]{36}/[^/]+\\.json$'
    or s3_key ~ '^entries/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/[^/]+\\.json$'
  ) not valid;

alter table public.entries
  validate constraint entries_s3_key_check;

-- A single source object can legitimately produce multiple extracted entry rows.
-- Keep an index for lookup performance but drop uniqueness on s3_key.
alter table public.entries
  drop constraint if exists entries_s3_key_key;

create index if not exists idx_entries_s3_key on public.entries (s3_key);
