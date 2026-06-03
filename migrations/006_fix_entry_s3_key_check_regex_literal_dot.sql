-- Ensure entry key constraint uses a literal dot without backslash escaping ambiguity.
-- This migration keeps the same accepted key layouts as 005.

alter table public.entries
  drop constraint if exists entries_s3_key_check;

alter table public.entries
  add constraint entries_s3_key_check
  check (
    s3_key ~ '^entries/[0-9a-fA-F-]{36}/[^/]+[.]json$'
    or s3_key ~ '^entries/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/[^/]+[.]json$'
  ) not valid;
