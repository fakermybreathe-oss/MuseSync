create schema if not exists private;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text
    constraint profiles_display_name_length
    check (display_name is null or char_length(btrim(display_name)) between 1 and 20),
  avatar_index integer not null default 0
    constraint profiles_avatar_index_range
    check (avatar_index between 0 and 9),
  avatar_url text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.profiles
  add column if not exists display_name text,
  add column if not exists avatar_index integer not null default 0;

alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists created_at timestamptz not null default timezone('utc'::text, now()),
  add column if not exists updated_at timestamptz not null default timezone('utc'::text, now());

update public.profiles
set
  display_name = nullif(left(btrim(display_name), 20), ''),
  avatar_index = case
    when avatar_index between 0 and 9 then avatar_index
    else 0
  end;

update public.profiles
set
  created_at = coalesce(created_at, timezone('utc'::text, now())),
  updated_at = coalesce(updated_at, timezone('utc'::text, now()));

alter table public.profiles
  alter column avatar_index set default 0,
  alter column avatar_index set not null,
  alter column created_at set default timezone('utc'::text, now()),
  alter column created_at set not null,
  alter column updated_at set default timezone('utc'::text, now()),
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_display_name_length'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_display_name_length
      check (display_name is null or char_length(btrim(display_name)) between 1 and 20);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_avatar_index_range'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_avatar_index_range
      check (avatar_index between 0 and 9);
  end if;
end;
$$;

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_index, avatar_url)
  values (
    new.id,
    nullif(left(btrim(new.raw_user_meta_data ->> 'display_name'), 20), ''),
    case
      when coalesce(new.raw_user_meta_data ->> 'avatar_index', '') ~ '^[0-9]$'
        then (new.raw_user_meta_data ->> 'avatar_index')::integer
      else 0
    end,
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function private.handle_new_user();

create table if not exists public.public_rooms (
  room_id text primary key,
  host_nickname text not null default 'Host',
  host_avatar_index integer not null default 0,
  current_track_title text,
  current_track_artist text,
  current_track_cover text,
  rtt_ms integer not null default 0,
  is_active boolean not null default true,
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.public_rooms
  add column if not exists host_nickname text not null default 'Host',
  add column if not exists host_avatar_index integer not null default 0,
  add column if not exists current_track_title text,
  add column if not exists current_track_artist text,
  add column if not exists current_track_cover text,
  add column if not exists rtt_ms integer not null default 0,
  add column if not exists is_active boolean not null default true,
  add column if not exists updated_at timestamptz not null default timezone('utc'::text, now()),
  add column if not exists login_address text,
  add column if not exists has_password boolean not null default false,
  add column if not exists is_public boolean not null default true;

update public.public_rooms
set
  host_nickname = coalesce(host_nickname, 'Host'),
  host_avatar_index = coalesce(host_avatar_index, 0),
  rtt_ms = coalesce(rtt_ms, 0),
  is_active = coalesce(is_active, true),
  updated_at = coalesce(updated_at, timezone('utc'::text, now())),
  has_password = coalesce(has_password, false),
  is_public = coalesce(is_public, true);

alter table public.public_rooms
  alter column host_nickname set default 'Host',
  alter column host_nickname set not null,
  alter column host_avatar_index set default 0,
  alter column host_avatar_index set not null,
  alter column rtt_ms set default 0,
  alter column rtt_ms set not null,
  alter column is_active set default true,
  alter column is_active set not null,
  alter column updated_at set default timezone('utc'::text, now()),
  alter column updated_at set not null,
  alter column has_password set default false,
  alter column has_password set not null,
  alter column is_public set default true,
  alter column is_public set not null;

comment on column public.public_rooms.updated_at is
'Latest server heartbeat/activity timestamp for the room; account login time remains in auth.users.last_sign_in_at.';

alter table public.public_rooms enable row level security;

drop trigger if exists public_rooms_set_updated_at on public.public_rooms;
create trigger public_rooms_set_updated_at
before update on public.public_rooms
for each row
execute function private.set_updated_at();

drop policy if exists "active_rooms_are_readable" on public.public_rooms;
create policy "active_rooms_are_readable"
on public.public_rooms
for select
to anon, authenticated
using (is_active = true);

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.public_rooms from anon, authenticated;

grant select, insert, update on table public.profiles to authenticated;

grant select (
  room_id,
  host_nickname,
  host_avatar_index,
  current_track_title,
  current_track_artist,
  current_track_cover,
  rtt_ms,
  is_active,
  updated_at,
  has_password,
  is_public
) on table public.public_rooms to anon, authenticated;

grant all on table public.public_rooms to service_role;
grant usage on schema private to service_role;

create index if not exists public_rooms_active_updated_at_idx
on public.public_rooms (is_active, updated_at desc);
