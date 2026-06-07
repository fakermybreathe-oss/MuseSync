import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const welcomePortalUrl = new URL(
  '../../apps/client/src/views/WelcomePortal.tsx',
  import.meta.url
);

test('lobby copy reflects that private and password rooms remain visible', async () => {
  const source = await readFile(welcomePortalUrl, 'utf8');

  assert.doesNotMatch(source, /公开此房间到大厅/);
  assert.doesNotMatch(source, /暂无公开的同频舱房/);
  assert.match(source, /将房间标记为公开/);
  assert.match(source, /暂无活跃的同频舱房/);
});
