-- Initial schema for clients and journal entries.
-- Designed for Supabase/Postgres.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.clients (
  client_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  display_name text not null,
  is_active boolean not null default true,
  last_seen_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid references public.clients (client_id) on delete set null,
  entry_id text not null,
  s3_key text not null,
  source_file text,
  entry_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_id),
  unique (s3_key),
  check (s3_key like 'entries/%/%')
);

create index if not exists idx_clients_user_id on public.clients (user_id);
create index if not exists idx_entries_user_id on public.entries (user_id);
create index if not exists idx_entries_client_id on public.entries (client_id);
create index if not exists idx_entries_user_entry on public.entries (user_id, entry_id);

drop trigger if exists set_clients_updated_at on public.clients;
create trigger set_clients_updated_at
before update on public.clients
for each row
execute function public.set_updated_at();

drop trigger if exists set_entries_updated_at on public.entries;
create trigger set_entries_updated_at
before update on public.entries
for each row
execute function public.set_updated_at();

alter table public.clients enable row level security;
alter table public.entries enable row level security;

drop policy if exists "clients_select_own" on public.clients;
create policy "clients_select_own"
on public.clients
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "clients_insert_own" on public.clients;
create policy "clients_insert_own"
on public.clients
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "clients_update_own" on public.clients;
create policy "clients_update_own"
on public.clients
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "clients_delete_own" on public.clients;
create policy "clients_delete_own"
on public.clients
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "entries_select_own" on public.entries;
create policy "entries_select_own"
on public.entries
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "entries_insert_own" on public.entries;
create policy "entries_insert_own"
on public.entries
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "entries_update_own" on public.entries;
create policy "entries_update_own"
on public.entries
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "entries_delete_own" on public.entries;
create policy "entries_delete_own"
on public.entries
for delete
to authenticated
using (user_id = auth.uid());
