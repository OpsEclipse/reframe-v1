-- Enforce user-scoped entry key paths in S3.
-- Expected format: entries/{user_uuid}/{ingestion_uuid}/{entry_file}.json

alter table public.entries
  drop constraint if exists entries_s3_key_check;

alter table public.entries
  add constraint entries_s3_key_check
  check (
    s3_key ~ '^entries/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/.+\\.json$'
  ) not valid;
