import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notFound } from '../src/pages/notfound.mjs';

const site = { model: {}, config: {}, theme: { nav: ['log'] }, motion: false, scripts: [], url: (p) => `/base${p}` };

test('says so, links home, and marks no section as current', () => {
  const html = notFound(site);
  assert.match(html, /<title>Not found — Meanwhile<\/title>/);
  assert.match(html, /<a class="ext" href="\/base\/">Back to the start<\/a>/);
  assert.doesNotMatch(html, /aria-current/);
});
