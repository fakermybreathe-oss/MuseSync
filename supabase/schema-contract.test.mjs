import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationsUrl = new URL('./migrations/', import.meta.url);
const migrationFiles = (await readdir(migrationsUrl))
  .filter((name) => name.endsWith('.sql'))
  .sort();

const migration = (await Promise.all(
  migrationFiles.map((name) => readFile(new URL(name, migrationsUrl), 'utf8'))
))
  .join('\n')
  .replace(/\s+/g, ' ')
  .toLowerCase();

test('profiles enforces the ten-avatar and nickname contracts', () => {
  assert.match(
    migration,
    /check\s*\(\s*avatar_index\s+between\s+0\s+and\s+9\s*\)/
  );
  assert.match(
    migration,
    /char_length\s*\(\s*btrim\s*\(\s*display_name\s*\)\s*\)\s+between\s+1\s+and\s+20/
  );
});

test('profiles RLS allows authenticated users to manage only their own row', () => {
  assert.match(migration, /alter table public\.profiles enable row level security/);
  assert.match(migration, /create policy "profiles_select_own".*for select.*auth\.uid\(\).*=\s*id/);
  assert.match(migration, /create policy "profiles_insert_own".*for insert.*auth\.uid\(\).*=\s*id/);
  assert.match(migration, /create policy "profiles_update_own".*for update.*auth\.uid\(\).*=\s*id/);
});

test('new-user profile trigger is isolated from the exposed API surface', () => {
  assert.match(
    migration,
    /create or replace function private\.handle_new_user\(\).*security definer.*set search_path\s*=\s*''/
  );
  assert.match(
    migration,
    /revoke all on function private\.handle_new_user\(\) from public/
  );
});

test('browser room grants exclude login_address while service role can write', () => {
  const browserGrant = migration.match(
    /grant select\s*\((.*?)\)\s*on table public\.public_rooms to anon, authenticated/
  );

  assert.ok(browserGrant);
  assert.doesNotMatch(browserGrant[1], /login_address/);
  assert.match(migration, /grant all on table public\.public_rooms to service_role/);
});

test('room sync removes legacy public write policies and fixes trigger search path', () => {
  assert.match(
    migration,
    /drop policy if exists "allow public write access" on public\.public_rooms/
  );
  assert.match(
    migration,
    /drop policy if exists "allow anonymous read access" on public\.public_rooms/
  );
  assert.match(
    migration,
    /create or replace function private\.set_updated_at\(\).*set search_path\s*=\s*''/
  );
});
