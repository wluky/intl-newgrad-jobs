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
