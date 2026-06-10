import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sourceUrl = (path: string) => new URL(
  `../../apps/client/src/${path}`,
  import.meta.url
);

test('auth and welcome surfaces use optical refraction instead of frosted blur', async () => {
  const [globalStyles, welcomePortal, avatarSelector, opticalSurface] = await Promise.all([
    readFile(sourceUrl('index.css'), 'utf8'),
    readFile(sourceUrl('views/WelcomePortal.tsx'), 'utf8'),
    readFile(sourceUrl('components/AvatarSelector.tsx'), 'utf8'),
    readFile(sourceUrl('components/OpticalGlassSurface.tsx'), 'utf8')
  ]);

  const reviewedSurfaceSource = [
    globalStyles.slice(0, globalStyles.indexOf('/* 排版层级 */')),
    welcomePortal,
    avatarSelector
  ].join('\n');

  assert.doesNotMatch(
    reviewedSurfaceSource,
    /(?:-webkit-)?backdrop-filter\s*:\s*blur\(/i
  );
  assert.match(welcomePortal, /<OpticalGlassSurface/);
  assert.match(opticalSurface, /ResizeObserver/);
  assert.match(opticalSurface, /<OpticsFilter/);
  assert.match(globalStyles, /--optic-edge-depth/);
});

test('optical surfaces and portal controls use spring physics', async () => {
  const [welcomePortal, opticalSurface, elasticControls] = await Promise.all([
    readFile(sourceUrl('views/WelcomePortal.tsx'), 'utf8'),
    readFile(sourceUrl('components/OpticalGlassSurface.tsx'), 'utf8'),
    readFile(sourceUrl('components/ElasticGlassControls.tsx'), 'utf8')
  ]);

  assert.match(opticalSurface, /new Spring\(/);
  assert.match(opticalSurface, /requestAnimationFrame/);
  assert.match(opticalSurface, /prefers-reduced-motion/);
  assert.match(elasticControls, /new Spring\(/);
  assert.match(elasticControls, /requestAnimationFrame/);
  assert.match(welcomePortal, /<ElasticGlassInput/);
  assert.match(welcomePortal, /<ElasticGlassButton/);
});

test('large optical panels render as one uniform lens without chromatic edge noise', async () => {
  const [globalStyles, welcomePortal, opticsFilter] = await Promise.all([
    readFile(sourceUrl('index.css'), 'utf8'),
    readFile(sourceUrl('views/WelcomePortal.tsx'), 'utf8'),
    readFile(sourceUrl('components/OpticsFilter.tsx'), 'utf8')
  ]);

  assert.doesNotMatch(opticsFilter, /redDisplacement|greenDisplacement|blueDisplacement/);
  assert.doesNotMatch(globalStyles, /\.optical-glass-surface::after/);
  assert.doesNotMatch(globalStyles, /\.optical-glass-surface\s*>\s*:not\(svg\)/);
  assert.doesNotMatch(
    welcomePortal,
    /\.crystal-portal-card\s*\{[^}]*radial-gradient/s
  );
});

test('auth and welcome content share one optical coordinate system per panel', async () => {
  const [authPage, welcomePortal, avatarSelector] = await Promise.all([
    readFile(sourceUrl('views/AuthPage.tsx'), 'utf8'),
    readFile(sourceUrl('views/WelcomePortal.tsx'), 'utf8'),
    readFile(sourceUrl('components/AvatarSelector.tsx'), 'utf8')
  ]);

  assert.doesNotMatch(authPage, /<OpticsFilter\b/);
  assert.equal((welcomePortal.match(/<OpticalGlassSurface\b/g) ?? []).length, 1);
  assert.doesNotMatch(welcomePortal, /<OpticsFilter\b/);
  assert.doesNotMatch(avatarSelector, /<OpticalGlassSurface\b/);
});

test('auth and welcome panels use the same readable glass tint', async () => {
  const [globalStyles, welcomePortal] = await Promise.all([
    readFile(sourceUrl('index.css'), 'utf8'),
    readFile(sourceUrl('views/WelcomePortal.tsx'), 'utf8')
  ]);

  assert.match(
    globalStyles,
    /--ms-glass-panel-fill:\s*rgba\([^;]+,\s*0\.(?:4[0-9]|[5-9][0-9])\)/
  );
  assert.match(
    globalStyles,
    /\.liquid-glass-panel\s*\{[^}]*background:\s*var\(--ms-glass-panel-fill\)/s
  );
  assert.match(
    welcomePortal,
    /\.crystal-portal-card\s*\{[^}]*background:\s*var\(--ms-glass-panel-fill\)/s
  );
});

test('optics maps use the measured panel coordinate system', async () => {
  const [opticsFilter, welcomePortal] = await Promise.all([
    readFile(sourceUrl('components/OpticsFilter.tsx'), 'utf8'),
    readFile(sourceUrl('views/WelcomePortal.tsx'), 'utf8')
  ]);

  assert.match(opticsFilter, /filterUnits="objectBoundingBox"/);
  assert.match(opticsFilter, /primitiveUnits="userSpaceOnUse"/);
  assert.match(
    opticsFilter,
    /<filter[^>]*x="0%"[^>]*y="0%"[^>]*width="100%"[^>]*height="100%"/s
  );
  assert.match(welcomePortal, /<div className="portal-card-scroll">/);
  assert.match(
    welcomePortal,
    /\.crystal-portal-card\s*\{[^}]*padding:\s*0/s
  );
  assert.match(
    welcomePortal,
    /\.portal-card-scroll\s*\{[^}]*padding:\s*24px 28px/s
  );
});
