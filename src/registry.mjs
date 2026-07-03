import { readFile } from 'node:fs/promises';

const PROVIDERS = new Set(['greenhouse', 'ashby', 'lever']);

export function validateEntry(entry, i = 0) {
  for (const f of ['name', 'provider', 'slug']) {
    if (!entry?.[f] || typeof entry[f] !== 'string') {
      throw new Error(`companies[${i}] missing string field "${f}"`);
    }
  }
  if (!PROVIDERS.has(entry.provider)) {
    throw new Error(`companies[${i}] invalid provider "${entry.provider}"`);
  }
  return { enabled: true, h1b_sponsor: true, ...entry };
}

export async function loadRegistry(path = 'companies.json') {
  const raw = JSON.parse(await readFile(path, 'utf8'));
  if (!Array.isArray(raw)) throw new Error('companies.json must be a JSON array');
  return raw.map((e, i) => validateEntry(e, i));
}

export function enabledEntries(registry) {
  return registry.filter((e) => e.enabled !== false);
}
