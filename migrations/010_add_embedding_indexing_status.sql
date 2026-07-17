-- Let one background job claim an entry before it calls paid providers.

alter table public.entries
  drop constraint if exists entries_embedding_status_check;

alter table public.entries
  add constraint entries_embedding_status_check
  check (embedding_status in ('pending', 'indexing', 'indexed', 'failed')) not valid;

alter table public.entries
  validate constraint entries_embedding_status_check;
