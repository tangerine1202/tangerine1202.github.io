import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse } from '../src/parse.mjs';
import { buildModel } from '../src/model.mjs';
import { logChunks } from '../src/pages/log.mjs';
import { year, logParts } from '../src/pages/year.mjs';

const config = {
  today: '2026-09-11', timeZone: 'Asia/Taipei', privateTag: '#private', privateContexts: [], mapEntry: null,
  colors: { Japanese: '#E69F00' }, other: '#8E8E89', uncategorized: '#CFCFCA', laneMinDays: 3,
};
// Every day from April to early September: five months of 30-odd days, and 11 in September.
const days = [];
for (let t = Date.UTC(2026, 3, 1); t <= Date.UTC(2026, 8, 11); t += 864e5) days.push(new Date(t).toISOString().slice(0, 10));
const LOG = days.reverse().map((d) => `### ${d}\n- [[Japanese]] ${d}`).join('\n');
const model = buildModel(parse(LOG, config), config);
const siteWith = (theme) => ({
  model, config, motion: false, scripts: [], url: (p) => p, hasPhoto: () => false,
  theme: { nav: ['log'], logInYear: true, calendarInYear: true, yearMonths: false, ...theme },
});

test('chunks are whole months, newest first, each at least the asked number of days', () => {
  const chunks = logChunks(siteWith({}), model.dates, 20);
  const months = chunks.map((c) => [...c.matchAll(/<h2 class="label">(\w+) 2026<\/h2>/g)].map((m) => m[1]));
  // September has only 11 days, so it takes August along to reach 20; every other month stands alone.
  assert.deepEqual(months, [['September', 'August'], ['July'], ['June'], ['May'], ['April']]);
  assert.equal(chunks.join('').match(/<div class="lday"/g).length, days.length); // every day, once
});

test('the Log shows its newest chunk, and a skeleton naming the files still to come', () => {
  const site = siteWith({ lazyLog: true });
  const html = year(site);
  assert.match(html, /data-span="2026-09-11"/);
  assert.doesNotMatch(html, /data-span="2026-07-31"/); // July waits for the reader
  const [part] = logParts(site);
  assert.deepEqual(part.files.map((f) => f.name), ['days-2026-1.html', 'days-2026-2.html', 'days-2026-3.html', 'days-2026-4.html']);
  assert.match(html, /<div class="log-more" data-chunks="days-2026-1\.html days-2026-2\.html days-2026-3\.html days-2026-4\.html" role="status"/);
  assert.equal((html.match(/class="lday sk-day"/g) || []).length, 3);
  assert.match(part.files[0].html, /<h2 class="label">July 2026<\/h2>/);
});

test('without lazyLog every day is in the page and there is no skeleton', () => {
  const html = year(siteWith({}));
  assert.match(html, /data-span="2026-04-01"/);
  assert.doesNotMatch(html, /log-more/);
});

test('the skeleton spans the year section like the months, and stops pulsing for reduced motion', () => {
  assert.match(fs.readFileSync('src/assets/play.css', 'utf8'), /\.yr-sec > \.log-more[^{]*\{ grid-column: 1 \/ -1; \}/);
  assert.match(fs.readFileSync('src/assets/almanac.css', 'utf8'), /prefers-reduced-motion: reduce\) \{ \.sk \{ animation: none; \} \}/);
});
