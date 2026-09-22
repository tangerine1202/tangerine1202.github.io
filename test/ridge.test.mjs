import { test } from 'node:test';
import assert from 'node:assert/strict';
import { density, ridgePath } from '../src/ridge.mjs';
import { parse } from '../src/parse.mjs';
import { buildModel } from '../src/model.mjs';
import { year } from '../src/pages/year.mjs';
import { dayOfYear } from '../src/util.mjs';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≈ ${b}`);

test('one day spreads over the seven days around it', () => {
  const d = density(['2026-09-05'], 2026);
  const i = dayOfYear('2026-09-05');
  for (let k = -3; k <= 3; k++) near(d[i + k], 1 / 7);
  near(d[i + 4], 0);
  near(d[i - 4], 0);
});

test('days pile up where they are close together', () => {
  const d = density(['2026-09-05', '2026-09-06'], 2026);
  near(d[dayOfYear('2026-09-05')], 2 / 7);
  near(d[dayOfYear('2026-09-08')], 2 / 7);
  near(d[dayOfYear('2026-09-09')], 1 / 7);
});

test('the window is cut off at the edges of the year, never wrapped', () => {
  const d = density(['2026-01-01', '2026-12-31'], 2026);
  assert.equal(d.length, 365);
  near(d[0], 1 / 7);
  near(d[2], 1 / 7);
  near(d[364], 1 / 7);
  near(d[180], 0);
});

test('a day outside the year is not counted', () => {
  const d = density(['2025-12-31'], 2026);
  near(d[0], 0);
});

test('the path is a closed area on the baseline, one point per day drawn', () => {
  const p = ridgePath(density(['2026-09-05'], 2026), 5);
  assert.ok(p.startsWith('M0,10'), p);
  assert.ok(p.endsWith('L5,10Z'), p);
  assert.equal(p.match(/L/g).length, 6); // 5 days + the one closing the area
});

const config = {
  today: '2026-09-11', timeZone: 'Asia/Taipei', privateTag: '#private', privateContexts: [], mapEntry: null,
  colors: { Japanese: '#E69F00' }, other: '#8E8E89', uncategorized: '#CFCFCA', laneMinDays: 3,
};
const model = buildModel(parse('### 2026-09-10\n- [[Japanese]] a\n### 2026-09-09\n- [[Japanese]] b\n- c', config), config);
const siteWith = (theme) => ({ model, config, theme, motion: false, scripts: [], url: (p) => p, hasPhoto: () => false });

test('only a theme that asks for it draws the ridge', () => {
  assert.match(year(siteWith({ yearRidge: true })), /class="ridge"/);
  assert.doesNotMatch(year(siteWith({})), /class="ridge"/);
});

test('the ridge stops at today, like the rest of the line', () => {
  const html = year(siteWith({ yearRidge: true }));
  assert.match(html, /class="ridge" d="M0,10L0[^"]*L254,10Z"/);
});

test('a lane that draws the ridge draws no ticks: the hills are the line', () => {
  const html = year(siteWith({ yearRidge: true }));
  assert.doesNotMatch(html, /<path d="M\d+ 0h1v10h-1z/);
  assert.match(html, /class="ridge" d="[^"]*" fill="#E69F00"\/>/); // the colour as it is, nothing faded
});

test('with the ticks gone the baseline drops under the hills', () => {
  assert.match(year(siteWith({ yearRidge: true })), /<rect class="base" x="0" y="9.2"/);
  assert.match(year(siteWith({})), /<rect class="base" x="0" y="4.6"/);
});
