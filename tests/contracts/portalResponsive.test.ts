import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const welcomePortalUrl = new URL(
  '../../apps/client/src/views/WelcomePortal.tsx',
  import.meta.url
);

test('welcome portal switches to a full-width stacked mobile layout', async () => {
  const source = (await readFile(welcomePortalUrl, 'utf8'))
    .replace(/\s+/g, ' ');

  assert.match(source, /@media\s*\(max-width:\s*900px\)/);
  assert.match(
    source,
    /\.welcome-portal-overlay\s*\{[^}]*flex-direction:\s*column/
  );
  assert.match(
    source,
    /\.crystal-portal-card\s*\{[^}]*width:\s*100%[^}]*max-height:\s*none/
  );
  assert.match(
    source,
    /\.public-lobby-section\s*\{[^}]*width:\s*100%/
  );
});
