-- Automatically bootstrap a default client record for every new Supabase auth user.

create or replace function public.handle_new_auth_user_client()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  derived_display_name text;
  provider_name text;
begin
  derived_display_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'User'
  );

  provider_name := coalesce(new.raw_app_meta_data ->> 'provider', 'email');

  insert into public.clients (
    user_id,
    name,
    display_name,
    is_active,
    last_seen_at,
    metadata
  )
  values (
    new.id,
    'primary',
    derived_display_name,
    true,
    now(),
    jsonb_build_object('created_from_auth_provider', provider_name)
  )
  on conflict (user_id, name) do update
    set
      display_name = excluded.display_name,
      metadata = public.clients.metadata || excluded.metadata,
      is_active = true,
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_client on auth.users;
create trigger on_auth_user_created_client
after insert on auth.users
for each row
execute function public.handle_new_auth_user_client();

-- Backfill for users created before this trigger existed.
insert into public.clients (
  user_id,
  name,
  display_name,
  is_active,
  last_seen_at,
  metadata
)
select
  au.id,
  'primary',
  coalesce(
    nullif(au.raw_user_meta_data ->> 'full_name', ''),
    nullif(au.raw_user_meta_data ->> 'name', ''),
    nullif(split_part(coalesce(au.email, ''), '@', 1), ''),
    'User'
  ) as display_name,
  true,
  now(),
  jsonb_build_object('created_from_auth_provider', coalesce(au.raw_app_meta_data ->> 'provider', 'email'))
from auth.users au
left join public.clients existing
  on existing.user_id = au.id
 and existing.name = 'primary'
where existing.client_id is null
on conflict (user_id, name) do nothing;
