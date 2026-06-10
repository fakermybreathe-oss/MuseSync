import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const clientProductionUrl = new URL(
  '../../apps/client/.env.production',
  import.meta.url
);
const clientExampleUrl = new URL(
  '../../apps/client/.env.example',
  import.meta.url
);
const serverExampleUrl = new URL(
  '../../apps/server/.env.example',
  import.meta.url
);

test('tracked production env does not compile placeholder Supabase credentials', async () => {
  const productionEnv = await readFile(clientProductionUrl, 'utf8');

  assert.doesNotMatch(productionEnv, /^\s*VITE_SUPABASE_URL\s*=/m);
  assert.doesNotMatch(productionEnv, /^\s*VITE_SUPABASE_ANON_KEY\s*=/m);
});

test('service role configuration stays server-only', async () => {
  const [clientExample, serverExample] = await Promise.all([
    readFile(clientExampleUrl, 'utf8'),
    readFile(serverExampleUrl, 'utf8')
  ]);

  assert.doesNotMatch(clientExample, /SERVICE_ROLE/i);
  assert.match(serverExample, /^SUPABASE_SERVICE_ROLE_KEY=/m);
  assert.doesNotMatch(serverExample, /^VITE_.*SERVICE_ROLE/m);
});
