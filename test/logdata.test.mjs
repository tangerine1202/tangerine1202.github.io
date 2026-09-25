import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { load, save, importLog, addEntry, updateEntry, removeEntry, toParsed } from '../src/logdata.mjs';
import { parse } from '../src/parse.mjs';
import { buildModel } from '../src/model.mjs';
import { year } from '../src/pages/year.mjs';

const config = {
  today: '2026-09-11', timeZone: 'Asia/Taipei', privateTag: '#private', privateContexts: ['Secret'], mapEntry: null,
  colors: { Japanese: '#E69F00' }, other: '#8E8E89', uncategorized: '#CFCFCA', laneMinDays: 3,
};
const LOG = `### 2026-09-10
- [[Japanese]] 讀日文
  - 一頁
- 沒有 context
- [[Secret]] 不給人看
### 2026-09-09
- [[Japanese]] 聽 podcast #private
`;

test('an import replaces its own source and leaves every other one alone', () => {
  let data = addEntry({ entries: [] }, { date: '2026-09-01', text: '手動加的', context: 'Japanese' }).data;
  data = addEntry(data, { date: '2026-09-02', text: '從日曆來的', source: 'calendar' }).data;
  const first = importLog(data, 'daily-log', LOG, config);
  assert.equal(first.before, 0);
  assert.equal(first.after, 2); // the #private line and the private context stay out, as they always have
  const again = importLog(first.data, 'daily-log', '### 2026-09-10\n- [[Japanese]] 只剩一行\n', config);
  assert.equal(again.before, 2);
  assert.equal(again.after, 1);
  assert.deepEqual(again.data.entries.map((e) => e.source).sort(), ['calendar', 'daily-log', 'manual']);
  const imported = again.data.entries.find((e) => e.source === 'daily-log');
  assert.deepEqual([imported.id, imported.imported, imported.text], ['daily-log:2026-09-10:1', true, '只剩一行']);
});

test('imported entries are read-only here; what is added here can be edited and removed', () => {
  const data = importLog({ entries: [] }, 'daily-log', LOG, config).data;
  assert.throws(() => updateEntry(data, 'daily-log:2026-09-10:1', { text: 'x' }), /comes from the daily-log import; edit it there/);
  assert.throws(() => removeEntry(data, 'daily-log:2026-09-10:1'), /edit it there/);
  assert.throws(() => addEntry(data, { date: '2026-09-11', text: 'x', source: 'daily-log' }), /imported source/);
  const { data: withMine, entry } = addEntry(data, { date: '2026-09-11', text: '我的', context: '' });
  assert.equal(entry.source, 'manual');
  assert.equal(entry.context, null);
  const edited = updateEntry(withMine, entry.id, { text: '改過', context: 'Japanese' });
  assert.deepEqual([edited.entry.text, edited.entry.context, edited.entry.date], ['改過', 'Japanese', '2026-09-11']);
  assert.equal(removeEntry(edited.data, entry.id).data.entries.length, data.entries.length);
  assert.throws(() => removeEntry(data, 'nope'), /no entry "nope"/);
});

test('what is typed is checked: a real date, some words, and a source name', () => {
  const empty = { entries: [] };
  assert.throws(() => addEntry(empty, { date: '2026/09/11', text: 'x' }), /date must be YYYY-MM-DD/);
  assert.throws(() => addEntry(empty, { date: '2026-09-11', text: '  ' }), /text is empty/);
  assert.throws(() => addEntry(empty, { date: '2026-09-11', text: 'x', source: 'My Source' }), /source must be lowercase/);
  assert.throws(() => importLog(empty, '../x', LOG, config), /source must be lowercase/);
});

test('the data becomes the parsed shape the model takes: the same as parsing the log', () => {
  const data = importLog({ entries: [] }, 'daily-log', LOG, config).data;
  const strip = (p) => JSON.stringify(p.days.filter((d) => d.entries.length));
  assert.equal(strip(toParsed(data, config)), strip(parse(LOG, config)));
  // Typed text gets the same treatment as the log's, and a private context stays out whatever its source.
  const mine = addEntry(addEntry(data, { date: '2026-09-11', text: '讀 [[Notes/Book|一本書]]' }).data, { date: '2026-09-11', text: 'x', context: 'Secret' }).data;
  const day = toParsed(mine, config).days.find((d) => d.date === '2026-09-11');
  assert.deepEqual(day.entries.map((e) => e.text), ['讀 一本書']);
});

test('saved whole, in date order, and read back the same', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'logdata-')), 'log.json');
  assert.deepEqual(load(file), { entries: [] }); // no file yet is an empty log, not an error
  const data = addEntry(addEntry({ entries: [] }, { date: '2026-09-12', text: 'b' }).data, { date: '2026-09-01', text: 'a' }).data;
  save(file, data);
  assert.deepEqual(load(file).entries.map((e) => e.text), ['a', 'b']);
  assert.ok(!fs.existsSync(`${file}.tmp`));
  fs.rmSync(path.dirname(file), { recursive: true, force: true });
});

test('with logDays off, the Log is its lanes only', () => {
  const model = buildModel(toParsed(importLog({ entries: [] }, 'daily-log', LOG, config).data, config), config);
  const site = (theme) => ({ model, config, motion: false, scripts: [], url: (p) => p, hasPhoto: () => false,
    theme: { nav: ['log'], logInYear: true, calendarInYear: true, yearMonths: false, ...theme } });
  assert.match(year(site({})), /<div class="lday"/);
  const html = year(site({ logDays: false }));
  assert.doesNotMatch(html, /<div class="lday"|log-more/);
  assert.match(html, /<div class="lanes"/);
});
