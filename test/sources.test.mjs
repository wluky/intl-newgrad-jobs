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
