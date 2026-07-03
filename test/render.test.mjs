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
