import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// transitions.js is a browser script; run it without a document to get its pure functions.
const code = fs.readFileSync(new URL('../src/assets/transitions.js', import.meta.url), 'utf8').replace("'__BASE__'", '"/"');
const sandbox = {};
vm.runInNewContext(code, sandbox);
const { pageOf, classify } = sandbox.MeanwhileVT;
const kind = (from, to, via) => classify(pageOf(from), pageOf(to), via);

const cases = [
  ['/', '/year/', 'zoom-in'],
  ['/year/', '/calendar/', 'zoom-in'],
  ['/log/', '/calendar/', 'zoom-out'],
  ['/calendar/', '/d/2026-09-10/', 'morph'],
  ['/d/2026-09-10/', '/log/', 'morph'],
  ['/d/2026-09-10/', '/d/2026-09-11/', 'day-next'],
  ['/d/2026-09-10/', '/d/2026-09-09/', 'day-prev'],
  ['/', '/c/job-preparation/', 'thread'],
  ['/c/job-preparation/', '/', 'thread'],
  ['/contexts/', '/c/reading/', 'thread'],
  ['/c/reading/', '/d/2026-09-10/', 'morph'],
  ['/', '/d/2026-09-10/', 'zoom-in'],
];

for (const [from, to, expected] of cases) {
  test(`${from} → ${to} is ${expected}`, () => assert.equal(kind(from, to), expected));
}

test('a context link on a Day page threads instead of morphing', () => {
  assert.equal(kind('/d/2026-09-10/', '/c/job-preparation/', 'thread'), 'thread');
});

test('Day → Day ignores the click hint', () => {
  assert.equal(kind('/d/2026-09-10/', '/d/2026-09-11/', 'thread'), 'day-next');
});
