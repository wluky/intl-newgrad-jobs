import { loadRegistry, enabledEntries } from '../src/registry.mjs';
import { fetchGreenhouse } from '../src/sources/greenhouse.mjs';
import { fetchAshby } from '../src/sources/ashby.mjs';
import { fetchLever } from '../src/sources/lever.mjs';

const FETCHERS = { greenhouse: fetchGreenhouse, ashby: fetchAshby, lever: fetchLever };

const reg = enabledEntries(await loadRegistry('companies.json'));
for (const e of reg) {
  try {
    const jobs = await FETCHERS[e.provider](e.slug, e.name);
    console.log(`OK   ${e.name} (${e.provider}:${e.slug}) → ${jobs.length} postings`);
  } catch (err) {
    console.log(`FAIL ${e.name} (${e.provider}:${e.slug}) → ${err.message}`);
  }
}
