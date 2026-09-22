import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/parse.mjs';
import { buildModel } from '../src/model.mjs';
import { year } from '../src/pages/year.mjs';
import { contexts, contextPage } from '../src/pages/contexts.mjs';
import { log } from '../src/pages/log.mjs';
import { day } from '../src/pages/day.mjs';

const config = {
  today: '2026-09-11', timeZone: 'Asia/Taipei', privateTag: '#private', privateContexts: [], mapEntry: null,
  colors: { Japanese: '#E69F00' }, other: '#8E8E89', uncategorized: '#CFCFCA', laneMinDays: 3,
};
const model = buildModel(parse('### 2026-09-10\n- [[Japanese]] a\n### 2026-09-09\n- [[Japanese]] b\n- c', config), config);
const siteWith = (theme) => ({ model, config, theme, motion: false, scripts: [], url: (p) => p, hasPhoto: () => false });

const almanac = siteWith({
  nav: ['year', 'log'], ribbonOn: ['log'], calendarInYear: true, yearGrid: false, yearLegend: false, contextGrid: true, pathBack: true,
});
const plain = siteWith({});

test('Almanac Year ends with the calendar months', () => {
  assert.match(year(almanac), /class="month"/);
});

test('Almanac Year has no 365-day grid and no legend', () => {
  assert.doesNotMatch(year(almanac), /class="weeks"|class="legend"/);
});

test('Almanac nav lists only Year and Log', () => {
  const nav = year(almanac).match(/<nav class="nav"[^]*?<\/nav>/)[0];
  assert.deepEqual([...nav.matchAll(/href="([^"]+)"/g)].map((m) => m[1]), ['/year/', '/log/']);
});

test('the Contexts page still renders when it is not in the nav', () => {
  assert.match(contexts(almanac), /Things I’ve done/);
});

test('Year lanes draw the rest of the year as a future line', () => {
  assert.match(year(almanac), /<line class="future" x1="254" y1="5" x2="365"/);
});

test('each Log group carries its context colour', () => {
  assert.match(log(almanac), /class="lg-grp" data-group="c0" style="--c:#E69F00"/);
});

test('a Context page grid colours only the days of that context', () => {
  const html = contextPage(almanac, model.ctx.get('Japanese'));
  assert.equal(html.match(/class="cell has plate"/g).length, 2);
});

test('the ribbon is drawn on Log only', () => {
  assert.deepEqual([/class="ribbon/.test(log(almanac)), /class="ribbon/.test(year(almanac))], [true, false]);
});

test('each page labels itself for the next page\'s back link', () => {
  assert.match(year(almanac), /<section class="month"[^>]*data-back-label="September 2026"/);
});

test('Almanac Day pages carry a back link; the default theme\'s do not', () => {
  assert.deepEqual([/data-back/.test(day(almanac, '2026-09-10')), /class="back"/.test(day(plain, '2026-09-10'))], [true, false]);
});

test('the default theme keeps its Year grid, legend and Calendar link', () => {
  const html = year(plain);
  assert.deepEqual([/class="weeks"/, /class="legend"/, /href="\/calendar\/"/].map((re) => re.test(html)), [true, true, true]);
});
