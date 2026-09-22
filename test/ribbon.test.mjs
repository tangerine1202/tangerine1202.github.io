import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ribbonRange, spanPercent } from '../src/ribbon.mjs';

const model = { years: [2026, 2025] };
const range = ribbonRange(model);

test('the ribbon runs from Jan 1 of the first year through Dec 31 of the last', () => {
  assert.deepEqual(range, { start: '2025-01-01', total: 730 });
});

test('a single day is one column wide at its place on the line', () => {
  const { left, width } = spanPercent(range, '2026-01-01');
  assert.equal(left, 50);
  assert.equal(width, 100 / 730);
});

test('a span covers both of its ends', () => {
  assert.equal(spanPercent(range, '2025-01-01', '2025-12-31').width, 50);
});
