# intl-newgrad-jobs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A standalone public repo whose README + `listings.json` list entry-level, US-based jobs at known visa-sponsoring companies, auto-refreshed weekly by a GitHub Action.

**Architecture:** A zero-dependency Node.js (ESM) pipeline: a curated `companies.json` registry of H-1B-sponsor employers → scan each company's public ATS JSON API (Greenhouse/Ashby/Lever) → filter by US location, entry-level title, and no-sponsorship-exclusion → render a Markdown table (README.md) and `listings.json`. A weekly GitHub Action runs the pipeline and commits changes.

**Tech Stack:** Node.js ≥20 (ESM `.mjs`), native `fetch`, built-in `node:test` runner + `node:assert`. **No runtime dependencies.**

## Global Constraints

- Node.js **≥20**; all source is ESM `.mjs` with `"type": "module"`.
- **Zero runtime dependencies** — native `fetch`, `node:test`, `node:fs` only. No npm installs in CI.
- Every posting object has exactly these fields: `{ title, company, location, url, description, postedAt, type }`. `type` ∈ `{ 'intern', 'full-time' }`. `postedAt` is `YYYY-MM-DD` or `''`.
- The three ATS providers are exactly: `greenhouse`, `ashby`, `lever`.
- The generated README **must** carry the honesty disclaimer verbatim (see Task 5 `HEADER`): "international-friendly" is a heuristic, not a guarantee.
- Network is injectable everywhere via an `opts.fetchImpl` parameter defaulting to global `fetch`; **tests never hit the live network** (fixtures only).
- Filters are **pure functions** (input → boolean/string, no I/O).

---

### Task 1: Project scaffold + test harness

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `test/smoke.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm test` runs `node --test`; ESM enabled repo-wide.

- [ ] **Step 1: Write the failing test**

Create `test/smoke.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('test harness runs', () => {
  assert.equal(1 + 1, 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `npm error Missing script: "test"` (no package.json yet).

- [ ] **Step 3: Write minimal implementation**

Create `package.json`:
```json
{
  "name": "intl-newgrad-jobs",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "test": "node --test",
    "build": "node src/pipeline.mjs"
  }
}
```

Create `.gitignore`:
```
node_modules/
*.log
.DS_Store
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — 1 test, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add package.json .gitignore test/smoke.test.mjs
git commit -m "chore: scaffold project and test harness"
```

---

### Task 2: Filters (pure functions)

**Files:**
- Create: `src/filters.mjs`
- Test: `test/filters.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `classifyType(title: string) -> 'intern' | 'full-time'`
  - `isEntryLevel(title: string) -> boolean`
  - `isUS(location: string) -> boolean`
  - `excludesSponsorship(text: string) -> boolean`

> **Note (post-execution):** the filter internals evolved when validated against
> live data. `src/filters.mjs` is the canonical implementation; regression tests
> cover each real case. Key deviations from the pseudo-code above:
> - **Strict entry-level:** Level II ("Software Engineer II") is treated as
>   mid-level and **rejected**; only Level I is entry. "Associate" qualifies only
>   when it prefixes an IC role — compound-senior titles ("Associate Manager",
>   "Associate General Counsel") are rejected, with an explicit exception for the
>   canonical new-grad "Associate Product/Program Manager" (APM).
> - **`isUS`** uses a precompiled word-boundary regex over a large non-US list,
>   so "Remote - UK"/"Luxembourg" are rejected while "Milwaukee" is not.

- [ ] **Step 1: Write the failing test**

Create `test/filters.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyType, isEntryLevel, isUS, excludesSponsorship } from '../src/filters.mjs';

test('classifyType detects internships', () => {
  assert.equal(classifyType('Software Engineering Intern'), 'intern');
  assert.equal(classifyType('Data Co-op'), 'intern');
  assert.equal(classifyType('Associate Software Engineer'), 'full-time');
});

test('isEntryLevel accepts entry signals and internships', () => {
  assert.equal(isEntryLevel('New Grad Software Engineer'), true);
  assert.equal(isEntryLevel('Junior Data Analyst'), true);
  assert.equal(isEntryLevel('Associate Product Manager'), true);
  assert.equal(isEntryLevel('Software Engineer I'), true);
  assert.equal(isEntryLevel('Marketing Intern'), true);
});

test('isEntryLevel rejects senior and ambiguous titles', () => {
  assert.equal(isEntryLevel('Senior Software Engineer'), false);
  assert.equal(isEntryLevel('Staff Engineer'), false);
  assert.equal(isEntryLevel('Engineering Manager'), false);
  assert.equal(isEntryLevel('Software Engineer III'), false);
  assert.equal(isEntryLevel('Software Engineer'), false); // no positive signal
});

test('isUS passes US/empty/remote, rejects known non-US', () => {
  assert.equal(isUS(''), true);
  assert.equal(isUS('New York, NY'), true);
  assert.equal(isUS('Remote - US'), true);
  assert.equal(isUS('San Francisco, California'), true);
  assert.equal(isUS('London, United Kingdom'), false);
  assert.equal(isUS('Bangalore, India'), false);
  assert.equal(isUS('Remote, EMEA'), false);
});

test('excludesSponsorship flags exclusion language only', () => {
  assert.equal(excludesSponsorship('We are unable to sponsor visas for this role.'), true);
  assert.equal(excludesSponsorship('Must be authorized to work without sponsorship.'), true);
  assert.equal(excludesSponsorship('U.S. citizenship is required.'), true);
  assert.equal(excludesSponsorship('We welcome candidates on OPT and will sponsor H-1B.'), false);
  assert.equal(excludesSponsorship('Great place to work!'), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/filters.test.mjs`
Expected: FAIL — cannot find module `../src/filters.mjs`.

- [ ] **Step 3: Write minimal implementation**

Create `src/filters.mjs`:
```js
// Pure title/location/text classification. No I/O.

const INTERN_RE = /\b(intern|internship|co-?op)\b/i;
// "manager"/"mgr" intentionally excluded — it would wrongly reject entry roles
// like "Associate Product Manager". Bare "Product Manager" / "Engineering
// Manager" are still dropped for lacking any positive entry signal.
const SENIOR_RE = /\b(senior|sr\.?|staff|principal|\blead\b|director|head\s+of|vp|vice\s+president|architect|iii|iv|\bv\b)\b/i;
const ENTRY_RE = /\b(new\s*grad|new\s*graduate|entry[-\s]?level|junior|jr\.?|associate|graduate|early\s*career|apprentice|trainee|campus|university\s*grad|\bi\b|\bii\b)\b/i;

export function classifyType(title = '') {
  return INTERN_RE.test(title) ? 'intern' : 'full-time';
}

export function isEntryLevel(title = '') {
  if (INTERN_RE.test(title)) return true;   // internships always qualify
  if (SENIOR_RE.test(title)) return false;  // explicit seniority disqualifies
  return ENTRY_RE.test(title);              // otherwise require a positive entry signal
}

const NON_US = [
  'united kingdom', 'london', 'manchester', 'ireland', 'dublin',
  'canada', 'toronto', 'vancouver', 'montreal', 'ontario',
  'india', 'bangalore', 'bengaluru', 'hyderabad', 'pune', 'gurgaon', 'chennai',
  'germany', 'berlin', 'munich', 'france', 'paris', 'spain', 'madrid', 'barcelona',
  'netherlands', 'amsterdam', 'poland', 'warsaw', 'krakow', 'ukraine', 'romania',
  'australia', 'sydney', 'melbourne', 'singapore', 'japan', 'tokyo', 'china',
  'brazil', 'mexico', 'argentina', 'colombia', 'philippines', 'israel', 'tel aviv',
  'emea', 'apac', 'latam', 'united arab emirates', 'dubai',
];

export function isUS(location = '') {
  const l = location.toLowerCase().trim();
  if (l === '') return true;                    // don't penalize missing data
  return !NON_US.some((k) => l.includes(k));    // reject known non-US, pass the rest
}

const EXCLUSION_PHRASES = [
  'no sponsorship', 'no visa sponsorship', 'without sponsorship',
  'unable to sponsor', 'not able to sponsor', 'will not sponsor',
  'do not sponsor', 'does not sponsor', 'cannot sponsor', 'can not sponsor',
  'not provide sponsorship', 'not offer sponsorship',
  'sponsorship is not available', 'sponsorship will not be',
  'must be a u.s. citizen', 'must be a us citizen',
  'u.s. citizenship is required', 'us citizenship is required',
  'citizenship is required', 'requires u.s. citizenship', 'requires us citizenship',
  'active security clearance', 'security clearance is required',
  'ability to obtain a security clearance',
];

export function excludesSponsorship(text = '') {
  const t = text.toLowerCase();
  return EXCLUSION_PHRASES.some((p) => t.includes(p));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/filters.test.mjs`
Expected: PASS — 5 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add src/filters.mjs test/filters.test.mjs
git commit -m "feat: add title/location/sponsorship filters"
```

---

### Task 3: ATS source adapters (Greenhouse, Ashby, Lever)

**Files:**
- Create: `src/sources/_http.mjs`
- Create: `src/sources/greenhouse.mjs`
- Create: `src/sources/ashby.mjs`
- Create: `src/sources/lever.mjs`
- Create: `test/fixtures/greenhouse.json`
- Create: `test/fixtures/ashby.json`
- Create: `test/fixtures/lever.json`
- Test: `test/sources.test.mjs`

**Interfaces:**
- Consumes: `classifyType` from `src/filters.mjs`.
- Produces (each returns normalized postings `{title, company, location, url, description, postedAt, type}`):
  - `getJson(url, opts) -> Promise<any>` and `stripHtml(html) -> string` (from `_http.mjs`)
  - `parseGreenhouse(raw, company) -> posting[]`, `fetchGreenhouse(slug, company, opts) -> Promise<posting[]>`
  - `parseAshby(raw, company) -> posting[]`, `fetchAshby(slug, company, opts) -> Promise<posting[]>`
  - `parseLever(raw, company) -> posting[]`, `fetchLever(slug, company, opts) -> Promise<posting[]>`
  - `opts` shape: `{ fetchImpl?: typeof fetch, timeoutMs?: number }`

- [ ] **Step 1: Write the failing test**

Create `test/fixtures/greenhouse.json`:
```json
{
  "jobs": [
    {
      "title": "New Grad Software Engineer",
      "absolute_url": "https://boards.greenhouse.io/acme/jobs/1",
      "location": { "name": "New York, NY" },
      "content": "&lt;p&gt;Join us. We sponsor visas.&lt;/p&gt;",
      "updated_at": "2026-06-30T12:00:00-04:00"
    }
  ]
}
```

Create `test/fixtures/ashby.json`:
```json
{
  "jobs": [
    {
      "title": "Data Analyst",
      "jobUrl": "https://jobs.ashbyhq.com/beta/2",
      "location": "Remote - US",
      "descriptionPlain": "Entry level analyst role.",
      "publishedAt": "2026-06-28T00:00:00Z",
      "employmentType": "Intern"
    }
  ]
}
```

Create `test/fixtures/lever.json`:
```json
[
  {
    "text": "Associate Product Manager",
    "hostedUrl": "https://jobs.lever.co/gamma/3",
    "categories": { "location": "San Francisco, CA" },
    "descriptionPlain": "APM role. No sponsorship available.",
    "createdAt": 1782777600000
  }
]
```

Create `test/sources.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripHtml } from '../src/sources/_http.mjs';
import { parseGreenhouse } from '../src/sources/greenhouse.mjs';
import { parseAshby } from '../src/sources/ashby.mjs';
import { parseLever } from '../src/sources/lever.mjs';

const load = async (f) => JSON.parse(await readFile(new URL(`./fixtures/${f}`, import.meta.url)));

test('stripHtml removes tags and decodes entities', () => {
  assert.equal(stripHtml('&lt;p&gt;a&amp;b&lt;/p&gt;'), 'a&b');
});

test('parseGreenhouse normalizes and classifies', async () => {
  const [p] = parseGreenhouse(await load('greenhouse.json'), 'Acme');
  assert.deepEqual(p, {
    title: 'New Grad Software Engineer',
    company: 'Acme',
    location: 'New York, NY',
    url: 'https://boards.greenhouse.io/acme/jobs/1',
    description: 'Join us. We sponsor visas.',
    postedAt: '2026-06-30',
    type: 'full-time',
  });
});

test('parseAshby uses employmentType for intern classification', async () => {
  const [p] = parseAshby(await load('ashby.json'), 'Beta');
  assert.equal(p.type, 'intern');
  assert.equal(p.location, 'Remote - US');
  assert.equal(p.postedAt, '2026-06-28');
});

test('parseLever converts epoch createdAt to date', async () => {
  const [p] = parseLever(await load('lever.json'), 'Gamma');
  assert.equal(p.title, 'Associate Product Manager');
  assert.equal(p.location, 'San Francisco, CA');
  assert.equal(p.postedAt, '2026-06-30');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/sources.test.mjs`
Expected: FAIL — cannot find module `../src/sources/_http.mjs`.

- [ ] **Step 3: Write minimal implementation**

Create `src/sources/_http.mjs`:
```js
export async function getJson(url, { fetchImpl = fetch, timeoutMs = 15000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal, headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export function stripHtml(html = '') {
  return html
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/<[^>]+>/g, ' ')   // strip tags AFTER decoding entities
    .replace(/\s+/g, ' ')
    .trim();
}
```

Note: entities are decoded before tags are stripped, so Greenhouse's
entity-encoded markup (`&lt;p&gt;…&lt;/p&gt;`) becomes real tags and is then
removed in a single pass.

Create `src/sources/greenhouse.mjs`:
```js
import { getJson, stripHtml } from './_http.mjs';
import { classifyType } from '../filters.mjs';

export function parseGreenhouse(raw, company) {
  const jobs = raw?.jobs ?? [];
  return jobs.map((j) => ({
    title: j.title ?? '',
    company,
    location: j.location?.name ?? '',
    url: j.absolute_url ?? '',
    description: stripHtml(j.content ?? ''), // decodes entities + strips tags in one pass
    postedAt: (j.updated_at ?? '').slice(0, 10),
    type: classifyType(j.title ?? ''),
  }));
}

export async function fetchGreenhouse(slug, company, opts = {}) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;
  return parseGreenhouse(await getJson(url, opts), company);
}
```

Create `src/sources/ashby.mjs`:
```js
import { getJson, stripHtml } from './_http.mjs';
import { classifyType } from '../filters.mjs';

export function parseAshby(raw, company) {
  const jobs = raw?.jobs ?? [];
  return jobs.map((j) => ({
    title: j.title ?? '',
    company,
    location: j.location ?? j.locationName ?? '',
    url: j.jobUrl ?? j.applyUrl ?? '',
    description: j.descriptionPlain ?? stripHtml(j.descriptionHtml ?? ''),
    postedAt: (j.publishedAt ?? j.updatedAt ?? '').slice(0, 10),
    type: /intern/i.test(j.employmentType ?? '') ? 'intern' : classifyType(j.title ?? ''),
  }));
}

export async function fetchAshby(slug, company, opts = {}) {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=false`;
  return parseAshby(await getJson(url, opts), company);
}
```

Create `src/sources/lever.mjs`:
```js
import { getJson, stripHtml } from './_http.mjs';
import { classifyType } from '../filters.mjs';

export function parseLever(raw, company) {
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map((j) => ({
    title: j.text ?? '',
    company,
    location: j.categories?.location ?? '',
    url: j.hostedUrl ?? '',
    description: j.descriptionPlain ?? stripHtml(j.description ?? ''),
    postedAt: j.createdAt ? new Date(j.createdAt).toISOString().slice(0, 10) : '',
    type: classifyType(j.text ?? ''),
  }));
}

export async function fetchLever(slug, company, opts = {}) {
  const url = `https://api.lever.co/v0/postings/${slug}?mode=json`;
  return parseLever(await getJson(url, opts), company);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/sources.test.mjs`
Expected: PASS — 4 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add src/sources test/fixtures test/sources.test.mjs
git commit -m "feat: add Greenhouse/Ashby/Lever source adapters"
```

---

### Task 4: Registry loader + seed data + verify script

**Files:**
- Create: `src/registry.mjs`
- Create: `companies.json`
- Create: `scripts/verify-registry.mjs`
- Test: `test/registry.test.mjs`

**Interfaces:**
- Consumes: nothing (reads a JSON file path).
- Produces:
  - `validateEntry(entry, i) -> {name, provider, slug, h1b_sponsor, enabled}` (throws on invalid)
  - `loadRegistry(path='companies.json') -> Promise<entry[]>`
  - `enabledEntries(registry) -> entry[]`

- [ ] **Step 1: Write the failing test**

Create `test/registry.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateEntry, enabledEntries, loadRegistry } from '../src/registry.mjs';

test('validateEntry defaults enabled and h1b_sponsor to true', () => {
  const e = validateEntry({ name: 'Acme', provider: 'greenhouse', slug: 'acme' });
  assert.equal(e.enabled, true);
  assert.equal(e.h1b_sponsor, true);
});

test('validateEntry rejects bad provider and missing fields', () => {
  assert.throws(() => validateEntry({ name: 'A', provider: 'workday', slug: 's' }, 0), /invalid provider/);
  assert.throws(() => validateEntry({ provider: 'lever', slug: 's' }, 1), /missing string field "name"/);
});

test('enabledEntries drops disabled', () => {
  const out = enabledEntries([
    { name: 'A', provider: 'lever', slug: 'a', enabled: true },
    { name: 'B', provider: 'lever', slug: 'b', enabled: false },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].name, 'A');
});

test('loadRegistry parses the shipped companies.json', async () => {
  const reg = await loadRegistry(new URL('../companies.json', import.meta.url).pathname);
  assert.ok(Array.isArray(reg) && reg.length > 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/registry.test.mjs`
Expected: FAIL — cannot find module `../src/registry.mjs`.

- [ ] **Step 3: Write minimal implementation**

Create `src/registry.mjs`:
```js
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
```

Create `companies.json` (starter seed — every entry is a known H-1B sponsor
with an ATS handle **verified live in Step 4b** to return a non-empty board):
```json
[
  { "name": "Databricks", "provider": "greenhouse", "slug": "databricks" },
  { "name": "Stripe", "provider": "greenhouse", "slug": "stripe" },
  { "name": "Coinbase", "provider": "greenhouse", "slug": "coinbase" },
  { "name": "Airtable", "provider": "greenhouse", "slug": "airtable" },
  { "name": "Samsara", "provider": "greenhouse", "slug": "samsara" },
  { "name": "Discord", "provider": "greenhouse", "slug": "discord" },
  { "name": "Instacart", "provider": "greenhouse", "slug": "instacart" },
  { "name": "Affirm", "provider": "greenhouse", "slug": "affirm" },
  { "name": "Vercel", "provider": "greenhouse", "slug": "vercel" },
  { "name": "Robinhood", "provider": "greenhouse", "slug": "robinhood" },
  { "name": "GitLab", "provider": "greenhouse", "slug": "gitlab" },
  { "name": "Anthropic", "provider": "greenhouse", "slug": "anthropic" },
  { "name": "Pinterest", "provider": "greenhouse", "slug": "pinterest" },
  { "name": "Dropbox", "provider": "greenhouse", "slug": "dropbox" },
  { "name": "Reddit", "provider": "greenhouse", "slug": "reddit" },
  { "name": "Ramp", "provider": "ashby", "slug": "ramp" },
  { "name": "Notion", "provider": "ashby", "slug": "notion" },
  { "name": "Linear", "provider": "ashby", "slug": "linear" },
  { "name": "OpenAI", "provider": "ashby", "slug": "openai" }
]
```

Create `scripts/verify-registry.mjs` (maintenance helper — prints per-company posting counts):
```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/registry.test.mjs`
Expected: PASS — 4 tests, 0 failures.

- [ ] **Step 4b: Verify registry slugs against live ATS APIs**

Run: `node scripts/verify-registry.mjs`
Expected: each line prints `OK ... → N postings`. For any `FAIL` line, correct that company's `provider`/`slug` in `companies.json` (check the company's real careers page to find its ATS + handle), or remove the entry. Re-run until every remaining entry is `OK`. This is the one manual data step; it is expected and normal.

- [ ] **Step 5: Commit**

```bash
git add src/registry.mjs companies.json scripts/verify-registry.mjs test/registry.test.mjs
git commit -m "feat: add sponsor registry loader, seed data, and verify script"
```

---

### Task 5: Renderer (README table + listings.json)

**Files:**
- Create: `src/render.mjs`
- Test: `test/render.test.mjs`

**Interfaces:**
- Consumes: posting objects `{title, company, location, url, postedAt, type}`.
- Produces:
  - `renderMarkdown(listings, { generatedAt }) -> string`
  - `renderJson(listings, { generatedAt }) -> string`

- [ ] **Step 1: Write the failing test**

Create `test/render.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown, renderJson } from '../src/render.mjs';

const listings = [
  { title: 'New Grad SWE', company: 'Acme', location: 'NYC', url: 'https://x/1', postedAt: '2026-06-20', type: 'full-time' },
  { title: 'SWE Intern', company: 'Beta', location: 'Remote - US', url: 'https://x/2', postedAt: '2026-06-30', type: 'intern' },
];

test('renderMarkdown sorts newest first and includes disclaimer + header row', () => {
  const md = renderMarkdown(listings, { generatedAt: '2026-07-03' });
  assert.match(md, /heuristic/i);                       // honesty disclaimer present
  assert.match(md, /Last updated: 2026-07-03 · 2 open roles/);
  assert.match(md, /\| Company \| Role \| Type \| Location \| Posted \| Link \|/);
  assert.ok(md.indexOf('Beta') < md.indexOf('Acme'));    // 06-30 before 06-20
  assert.match(md, /\[Apply\]\(https:\/\/x\/2\)/);
  assert.match(md, /\| Intern \|/);
});

test('renderJson emits generatedAt, count, and listings', () => {
  const parsed = JSON.parse(renderJson(listings, { generatedAt: '2026-07-03' }));
  assert.equal(parsed.generatedAt, '2026-07-03');
  assert.equal(parsed.count, 2);
  assert.equal(parsed.listings.length, 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/render.test.mjs`
Expected: FAIL — cannot find module `../src/render.mjs`.

- [ ] **Step 3: Write minimal implementation**

Create `src/render.mjs`:
```js
const HEADER = `# 🌍 International-Friendly US Entry-Level Jobs

Entry-level and internship roles in the United States at companies with a
history of sponsoring work visas — curated for international students
graduating in the US.

> ⚠️ **"International-friendly" is a heuristic, not a guarantee.** A role is
> listed when (1) the employer has historically sponsored H-1B visas and
> (2) the job posting does not explicitly rule out sponsorship. This does
> **not** promise that any specific role will sponsor you. **Always confirm
> visa sponsorship directly with the employer before applying or accepting.**

To add or fix a company, edit [\`companies.json\`](companies.json) — not this
file (the table below is auto-generated weekly).`;

function esc(s = '') {
  return String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

export function renderMarkdown(listings, { generatedAt }) {
  const rows = [...listings]
    .sort((a, b) => (b.postedAt || '').localeCompare(a.postedAt || ''))
    .map((j) =>
      `| ${esc(j.company)} | ${esc(j.title)} | ${j.type === 'intern' ? 'Intern' : 'Full-time'} | ${esc(j.location) || '—'} | ${j.postedAt || '—'} | [Apply](${j.url}) |`
    );
  return [
    HEADER,
    '',
    `_Last updated: ${generatedAt} · ${listings.length} open roles_`,
    '',
    '| Company | Role | Type | Location | Posted | Link |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
}

export function renderJson(listings, { generatedAt }) {
  return JSON.stringify({ generatedAt, count: listings.length, listings }, null, 2) + '\n';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/render.test.mjs`
Expected: PASS — 2 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add src/render.mjs test/render.test.mjs
git commit -m "feat: add README + JSON renderer with honesty disclaimer"
```

---

### Task 6: Pipeline orchestration

**Files:**
- Create: `src/pipeline.mjs`
- Test: `test/pipeline.test.mjs`

**Interfaces:**
- Consumes: `loadRegistry`, `enabledEntries` (registry); `fetchGreenhouse/Ashby/Lever` (sources); `isUS`, `isEntryLevel`, `excludesSponsorship` (filters); `renderMarkdown`, `renderJson` (render).
- Produces:
  - `keepPosting(p) -> boolean`
  - `collect(entries, opts) -> Promise<posting[]>`
  - `run({ registryPath, now, opts }) -> Promise<posting[]>` (writes `README.md` + `listings.json` in cwd)

- [ ] **Step 1: Write the failing test**

Create `test/pipeline.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keepPosting, collect } from '../src/pipeline.mjs';

test('keepPosting requires US + entry-level + no sponsorship exclusion', () => {
  const base = { title: 'New Grad SWE', location: 'NYC', description: 'We sponsor.' };
  assert.equal(keepPosting(base), true);
  assert.equal(keepPosting({ ...base, location: 'London, United Kingdom' }), false);
  assert.equal(keepPosting({ ...base, title: 'Senior SWE' }), false);
  assert.equal(keepPosting({ ...base, description: 'No sponsorship available.' }), false);
});

test('collect fetches per provider and applies filters', async () => {
  // fake fetch routes by URL to canned ATS payloads
  const fetchImpl = async (url) => {
    let body;
    if (url.includes('greenhouse')) {
      body = { jobs: [
        { title: 'New Grad Engineer', absolute_url: 'https://g/1', location: { name: 'Austin, TX' }, content: 'we sponsor', updated_at: '2026-06-25T00:00:00Z' },
        { title: 'Senior Engineer', absolute_url: 'https://g/2', location: { name: 'Austin, TX' }, content: 'x', updated_at: '2026-06-25T00:00:00Z' },
      ] };
    } else {
      body = [ { text: 'Junior Analyst', hostedUrl: 'https://l/1', categories: { location: 'Remote - US' }, descriptionPlain: 'ok', createdAt: 1782777600000 } ];
    }
    return { ok: true, json: async () => body };
  };
  const entries = [
    { name: 'G', provider: 'greenhouse', slug: 'g' },
    { name: 'L', provider: 'lever', slug: 'l' },
  ];
  const out = await collect(entries, { fetchImpl });
  const titles = out.map((p) => p.title).sort();
  assert.deepEqual(titles, ['Junior Analyst', 'New Grad Engineer']); // senior dropped
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/pipeline.test.mjs`
Expected: FAIL — cannot find module `../src/pipeline.mjs`.

- [ ] **Step 3: Write minimal implementation**

Create `src/pipeline.mjs`:
```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/pipeline.test.mjs`
Expected: PASS — 2 tests, 0 failures.

- [ ] **Step 5: Run the full suite + a real end-to-end build**

Run: `npm test`
Expected: PASS — all test files, 0 failures.

Run: `node src/pipeline.mjs`
Expected: prints `Wrote N listings`; `README.md` now contains the disclaimer + a populated table; `listings.json` contains the same data. (Requires Task 4b's registry verification to have produced working slugs.)

- [ ] **Step 6: Commit**

```bash
git add src/pipeline.mjs test/pipeline.test.mjs README.md listings.json
git commit -m "feat: add pipeline orchestration and generate first listings"
```

---

### Task 7: Weekly GitHub Action

**Files:**
- Create: `.github/workflows/refresh.yml`

**Interfaces:**
- Consumes: `src/pipeline.mjs` (via `node src/pipeline.mjs`).
- Produces: a scheduled workflow that regenerates and commits `README.md` + `listings.json`.

- [ ] **Step 1: Write the workflow**

Create `.github/workflows/refresh.yml`:
```yaml
name: Refresh listings

on:
  schedule:
    - cron: '0 6 * * 1'   # Mondays 06:00 UTC (weekly)
  workflow_dispatch: {}

permissions:
  contents: write

jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Run test suite
        run: npm test

      - name: Regenerate listings
        run: node src/pipeline.mjs

      - name: Commit changes if any
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add README.md listings.json
          if git diff --staged --quiet; then
            echo "No changes to commit."
          else
            git commit -m "chore: weekly listings refresh"
            git push
          fi
```

- [ ] **Step 2: Validate the workflow YAML locally**

Run: `node -e "import('node:fs').then(fs=>{const s=fs.readFileSync('.github/workflows/refresh.yml','utf8'); if(!s.includes('cron:')||!s.includes('node src/pipeline.mjs')) throw new Error('workflow malformed'); console.log('workflow ok')})"`
Expected: prints `workflow ok`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/refresh.yml
git commit -m "ci: add weekly listings refresh workflow"
```

- [ ] **Step 4: Push and confirm the Action runs**

After creating the GitHub repo and pushing, open the repo's **Actions** tab, run **Refresh listings** via **workflow_dispatch**, and confirm it completes green and commits an updated `README.md`/`listings.json` (or reports "No changes to commit."). Ensure repo Settings → Actions → Workflow permissions is set to **Read and write**.

---

## Notes for the implementer

- **Registry maintenance is the ongoing work.** Growing `companies.json` toward 30–50 verified sponsors (Task 4) is what makes the board useful. Use `node scripts/verify-registry.mjs` whenever adding companies. Find a company's ATS by visiting its careers page and noting whether the apply URLs point to `greenhouse.io`, `ashbyhq.com`, or `lever.co`, then use the handle in that URL as the `slug`.
- **The disclaimer is a hard requirement**, not decoration — do not remove or soften the "heuristic, not a guarantee" language in `src/render.mjs`.
- The generated `README.md` overwrites itself each run by design; project/contribution prose lives in the `HEADER` template inside `src/render.mjs`.
