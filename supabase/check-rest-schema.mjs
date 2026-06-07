import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();

const parseEnvFile = async (filePath) => {
  try {
    const raw = await readFile(filePath, 'utf8');
    return Object.fromEntries(
      raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#') && line.includes('='))
        .map((line) => {
          const index = line.indexOf('=');
          const key = line.slice(0, index).trim();
          const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, '');
          return [key, value];
        })
    );
  } catch {
    return {};
  }
};

const localEnv = await parseEnvFile(path.join(ROOT, 'apps/client/.env.local'));
const env = { ...localEnv, ...process.env };

const supabaseUrl = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;

const isPlaceholder = (value) => !value || /your_|<.*>|placeholder/i.test(value);

if (isPlaceholder(supabaseUrl) || isPlaceholder(anonKey)) {
  console.error('Missing Supabase URL or anon/publishable key. Set them in apps/client/.env.local.');
  process.exit(1);
}

const projectRef = (() => {
  try {
    return new URL(supabaseUrl).hostname.split('.')[0];
  } catch {
    return 'unknown';
  }
})();

const headers = {
  apikey: anonKey,
  Authorization: `Bearer ${anonKey}`
};

const readRest = async (table, select) => {
  const url = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=1`;
  const response = await fetch(url, { headers });
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = await response.text();
  }
  return {
    table,
    status: response.status,
    ok: response.ok,
    code: body && typeof body === 'object' ? body.code : undefined,
    message: body && typeof body === 'object' ? body.message : undefined
  };
};

const checks = [
  await readRest('public_rooms', 'room_id,host_nickname,host_avatar_index,current_track_title,current_track_artist,current_track_cover,rtt_ms,is_active,updated_at,has_password,is_public'),
  await readRest('profiles', 'id,display_name,avatar_index,avatar_url,updated_at')
];

const explain = (check) => {
  if (check.ok) {
    return { level: 'ok', detail: `${check.table}: reachable through REST.` };
  }

  if (check.code === 'PGRST205') {
    return { level: 'missing', detail: `${check.table}: missing from remote REST schema. Apply the local migration.` };
  }

  if (check.code === '42703') {
    return {
      level: 'missing',
      detail: `${check.table}: remote table exists but is missing a required column. Apply the local migration.`
    };
  }

  if (check.table === 'profiles' && check.code === '42501') {
    return { level: 'ok', detail: 'profiles: table exists and is protected from anonymous reads, as expected.' };
  }

  return {
    level: 'error',
    detail: `${check.table}: unexpected REST response ${check.status}${check.code ? ` (${check.code})` : ''}${check.message ? ` - ${check.message}` : ''}`
  };
};

const results = checks.map(explain);
const hasFailure = results.some((result) => result.level !== 'ok');

console.log(`Supabase project: ${projectRef}`);
console.log(`Anon key length: ${anonKey.length}`);
for (const result of results) {
  console.log(`[${result.level}] ${result.detail}`);
}

if (hasFailure) {
  process.exit(1);
}
