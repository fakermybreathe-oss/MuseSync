drop policy if exists "Allow public write access" on public.public_rooms;
drop policy if exists "Allow anonymous read access" on public.public_rooms;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;
