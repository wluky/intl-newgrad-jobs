import { writeFile } from 'node:fs/promises';
import { loadRegistry, enabledEntries } from './registry.mjs';
import { fetchGreenhouse } from './sources/greenhouse.mjs';
import { fetchAshby } from './sources/ashby.mjs';
import { fetchLever } from './sources/lever.mjs';
import { isUS, isEntryLevel, excludesSponsorship } from './filters.mjs';
import { renderMarkdown, renderJson } from './render.mjs';

const FETCHERS = { greenhouse: fetchGreenhouse, ashby: fetchAshby, lever: fetchLever };

export function keepPosting(p) {
  return isUS(p.location) && isEntryLevel(p.title) && !excludesSponsorship(p.description);
}

export async function collect(entries, opts = {}) {
  const all = [];
  for (const e of entries) {
    const fetcher = FETCHERS[e.provider];
    try {
      const postings = await fetcher(e.slug, e.name, opts);
      all.push(...postings.filter(keepPosting));
    } catch (err) {
      console.error(`[warn] ${e.name} (${e.provider}:${e.slug}) failed: ${err.message}`);
    }
  }
  return all;
}

export async function run({ registryPath = 'companies.json', now = new Date(), opts = {} } = {}) {
  const registry = await loadRegistry(registryPath);
  const listings = await collect(enabledEntries(registry), opts);
  const generatedAt = now.toISOString().slice(0, 10);
  await writeFile('README.md', renderMarkdown(listings, { generatedAt }));
  await writeFile('listings.json', renderJson(listings, { generatedAt }));
  return listings;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run()
    .then((l) => console.log(`Wrote ${l.length} listings`))
    .catch((e) => { console.error(e); process.exit(1); });
}
