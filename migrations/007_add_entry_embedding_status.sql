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

alter table public.entries
  validate constraint entries_embedding_status_check;

create index if not exists idx_entries_embedding_status
on public.entries (user_id, embedding_status);
