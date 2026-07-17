-- Match the entry archive query and remove indexes duplicated by unique constraints.

drop index if exists public.idx_clients_user_id;
drop index if exists public.idx_entries_user_id;
drop index if exists public.idx_entries_user_entry;

create index if not exists idx_entries_user_created_at_desc
on public.entries (user_id, created_at desc);
