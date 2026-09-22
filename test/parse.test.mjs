import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, plain } from '../src/parse.mjs';

const config = { privateTag: '#private', privateContexts: ['Secret'], mapEntry: null };
const one = (log) => parse(log, config).days[0].entries;

test('a leading link becomes the context', () => {
  assert.deepEqual(one('### 2026-09-10\n- [[Job Preparation]] resume v3 完成')[0],
    { context: 'Job Preparation', text: 'resume v3 完成', sub: [] });
});

test('colon and checkbox after the leading link are removed', () => {
  const [a, b] = one('### 2026-09-10\n- [[Japanese]]: N2\n- [x] [[Japanese]] N3');
  assert.equal(a.text, 'N2');
  assert.equal(b.context, 'Japanese');
});

test('a line without a leading link has no context', () => {
  assert.equal(one('### 2026-09-10\n- 開始閱讀 體驗設計')[0].context, null);
});

test('links inside the sentence become plain text', () => {
  assert.equal(one('### 2026-09-10\n- [[Japanese]] read [[Note|筆記]] and [[Other]]')[0].text, 'read 筆記 and Other');
});

test('markdown links keep only their text and bare URLs disappear', () => {
  assert.equal(plain('Found [video](https://youtu.be/x) see https://a.b/c **now**'), 'Found video see now');
});

test('indented items belong to the line above, with their depth', () => {
  const [e] = one('### 2026-07-29\n- [[T-RO Revision]] built\n\t- fix init\n\t\t- recap\n\t- zero reward');
  assert.deepEqual(e.sub, [{ text: 'fix init', depth: 1 }, { text: 'recap', depth: 2 }, { text: 'zero reward', depth: 1 }]);
});

test('#private drops the line and its children', () => {
  const entries = one('### 2026-09-10\n- keep\n- hide #private\n  - child of hidden\n- also keep');
  assert.deepEqual(entries.map((e) => e.text), ['keep', 'also keep']);
});

test('private contexts are dropped', () => {
  assert.equal(one('### 2026-09-10\n- [[Secret]] x\n  - y\n- z').length, 1);
});

test('repeated date headings merge into one day', () => {
  const { days } = parse('### 2026-09-10\n- a\n### 2026-09-10\n- b', config);
  assert.equal(days.length, 1);
  assert.equal(days[0].entries.length, 2);
});

test('an unclosed [[ warns and never reaches the page', () => {
  const { days, warnings } = parse('### 2026-09-10\n- see [[Template', config);
  assert.equal(days[0].entries[0].text, 'see Template');
  assert.equal(warnings.length, 1);
});

test('mapEntry sees the raw text and can change the context', () => {
  const mapEntry = (e) => (e.text.includes('[[📖') ? { ...e, context: 'Reading' } : e);
  const { days } = parse('### 2026-09-10\n- Begin reading [[📖 A Book]]', { ...config, mapEntry });
  assert.deepEqual([days[0].entries[0].context, days[0].entries[0].text], ['Reading', 'Begin reading A Book']);
});
