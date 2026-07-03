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
  assert.equal(isEntryLevel('Engineering Manager II'), false); // "Manager II" is not entry-level
  assert.equal(isEntryLevel('Software Engineer III'), false);
  assert.equal(isEntryLevel('Software Engineer'), false); // no positive signal
});

test('isEntryLevel accepts I/II grade IC roles', () => {
  assert.equal(isEntryLevel('Data Engineer II'), true);
  assert.equal(isEntryLevel('Software Engineer I'), true);
});

test('isUS passes US/empty/remote, rejects known non-US', () => {
  assert.equal(isUS(''), true);
  assert.equal(isUS('New York, NY'), true);
  assert.equal(isUS('Remote - US'), true);
  assert.equal(isUS('Remote - USA'), true);
  assert.equal(isUS('San Francisco, California'), true);
  assert.equal(isUS('Milwaukee, WI'), true);          // "uk" substring must NOT reject
  assert.equal(isUS('London, United Kingdom'), false);
  assert.equal(isUS('Remote - UK'), false);
  assert.equal(isUS('Hybrid - Luxembourg'), false);
  assert.equal(isUS('Remote - Cyprus'), false);
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
