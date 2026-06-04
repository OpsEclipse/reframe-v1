-- Store generated Reflect sessions and the entries used to create them.

create table if not exists public.reflection_sessions (
  session_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid references public.clients (client_id) on delete set null,
  primary_entry_id text not null,
  related_entry_ids text[] not null default '{}'::text[],
  model text not null,
  response_json jsonb not null,
  created_entry_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reflection_sessions_user_created
on public.reflection_sessions (user_id, created_at desc);

drop trigger if exists set_reflection_sessions_updated_at on public.reflection_sessions;
create trigger set_reflection_sessions_updated_at
before update on public.reflection_sessions
for each row
execute function public.set_updated_at();

alter table public.reflection_sessions enable row level security;

drop policy if exists "reflection_sessions_select_own" on public.reflection_sessions;
create policy "reflection_sessions_select_own"
on public.reflection_sessions
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "reflection_sessions_insert_own" on public.reflection_sessions;
create policy "reflection_sessions_insert_own"
on public.reflection_sessions
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "reflection_sessions_update_own" on public.reflection_sessions;
create policy "reflection_sessions_update_own"
on public.reflection_sessions
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
