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
