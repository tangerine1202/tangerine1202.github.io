import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { parse } from '../src/parse.mjs';
import { buildModel } from '../src/model.mjs';
import { ctxName } from '../src/layout.mjs';
import { weeksGrid } from '../src/weeks.mjs';
import { year } from '../src/pages/year.mjs';
import { home } from '../src/pages/home.mjs';
import { contexts, contextPage } from '../src/pages/contexts.mjs';
import { day } from '../src/pages/day.mjs';

const config = {
  today: '2026-09-11', timeZone: 'Asia/Taipei', privateTag: '#private', privateContexts: [], mapEntry: null,
  colors: { Japanese: '#E69F00', 'Job Preparation': '#56B4E9' }, other: '#8E8E89', uncategorized: '#CFCFCA', laneMinDays: 3,
};
const LOG = `### 2026-09-10
- [[Japanese]] a
- [[Job Preparation]] b
- [[Job Preparation]] c
### 2026-09-09
- [[Japanese]] d
- [[Job Preparation]] e
- 沒有 context
`;
const model = buildModel(parse(LOG, config), config);
const siteWith = (theme) => ({ model, config, theme, motion: false, scripts: [], url: (p) => p, hasPhoto: () => false });
// Play is the Almanac plus the play layer; these are the same two objects build.mjs composes.
const ALMANAC = {
  nav: ['year', 'log'], ribbonOn: ['log'], calendarInYear: true,
  yearGrid: false, yearLegend: false, contextGrid: true, pathBack: true,
};
const play = siteWith({
  ...ALMANAC, extraCss: ['play.css'], yearRidge: true, linkTrace: true, nowAccent: true, play: true,
  yearMonths: false, logInYear: true, nav: ['log', 'media'], media: true,
});
const plain = siteWith({});

// ── model.now ────────────────────────────────────────

const now = (log) => buildModel(parse(log, config), config).now;

test('the accent follows the context with the most lines in the last two weeks', () => {
  assert.equal(now(LOG).name, 'Job Preparation');
});

test('a tie goes to the context that ranks first', () => {
  assert.equal(now('### 2026-09-10\n- [[Japanese]] a\n- [[Job Preparation]] b\n').name, 'Japanese');
});

test('Uncategorized never becomes the accent, and an empty log has none', () => {
  assert.equal(now('### 2026-09-10\n- 沒有 context\n'), null);
  assert.equal(now(''), null);
});

test('only the last fourteen recorded days count', () => {
  const days = Array.from({ length: 15 }, (_, i) => `### 2026-09-${String(i + 1).padStart(2, '0')}\n- [[${i ? 'Japanese' : 'Job Preparation'}]] x\n`);
  assert.equal(now(days.join('')).name, 'Japanese');
});

// ── the variant's own output ─────────────────────────

test('play links play.css after the stylesheets; the plain theme has no such link', () => {
  assert.match(year(play), /href="\/play\.css"/);
  assert.doesNotMatch(year(plain), /play\.css/);
});

test('the accent colour is on <html>, and only when the theme asks for it', () => {
  assert.match(year(play), /<html lang="zh-Hant"[^>]* style="--now:#56B4E9" data-now="c1"/);
  assert.doesNotMatch(year(plain), /--now/);
});

test('Play keeps the Almanac\'s page decisions, with the Year as the only dated page', () => {
  const y = year(play);
  assert.deepEqual([...y.match(/<nav class="nav"[^]*?<\/nav>/)[0].matchAll(/href="([^"]+)"/g)].map((m) => m[1]), ['/log/', '/media/']);
  assert.doesNotMatch(y, /class="weeks"|class="legend"/); // no 365 grid, no legend on Year
  assert.doesNotMatch(y, /class="month"/); // and no calendar months either
  assert.match(contextPage(play, model.ctx.get('Japanese')), /class="cgrid"/);
  assert.match(y, /class="ribbon/); // the ribbon came along with the log
});

test('the Year carries the log under it, newest day first, with no tag of its own', () => {
  const y = year(play);
  assert.doesNotMatch(y, /<p class="label">Log<\/p>/); // the month names are tag enough
  assert.match(y, /<div class="lanes"[^]*?<\/div>\n+<section class="lmonth"><h2 class="label">September 2026<\/h2>/);
  assert.deepEqual([...y.matchAll(/class="lday" data-span="([\d-]+)"/g)].map((m) => m[1]), ['2026-09-10', '2026-09-09']);
  assert.match(y, /class="lg-grp" data-group="c0" style="--c:#E69F00"/);
});

test('that page is the Log: it says so, and it answers at /log/', () => {
  const y = year(play);
  assert.match(y, /<nav class="nav" aria-label="Sections"><a href="\/log\/" aria-current="page">Log<i class="mark"><\/i><\/a><a href="\/media\/">Media<\/a><\/nav>/);
  assert.match(y, /<title>Log — Meanwhile<\/title>/);
  assert.match(y, /<body class="p-year has-ribbon"/); // the year's own styling, under the log's name
  assert.match(year(plain), /<a href="\/year\/" aria-current="page">Year/); // the flagless theme still says Year
});

test('the whole-year bracket belongs to the lanes, so each day row can speak for itself', () => {
  const y = year(play);
  assert.match(y, /<div class="lanes" data-span="2026-01-01 2026-12-31">/);
  assert.doesNotMatch(y, /<section class="yr-sec" data-span/);
});

test('the ribbon is a focus target as well: every day carries its contexts', () => {
  assert.match(year(play), /<b style="--c:#E69F00" data-cid="c0"><\/b>/);
});

test('the header is the Almanac\'s, unchanged', () => {
  assert.match(year(play), /<header class="top wrap"><a class="brand" href="\/">Meanwhile<\/a><nav class="nav"/);
});

// ── focus hooks (every theme: they change nothing on their own) ──

test('every theme tells focus.js which colours mean "no colour"', () => {
  assert.match(year(plain), /<html lang="zh-Hant" data-grey="#8E8E89 #CFCFCA"/);
});

test('a context name carries its id and its colour', () => {
  assert.equal(ctxName(plain, model.ctx.get('Japanese')), '<a class="cn" href="/c/japanese/" data-cid="c0" style="--c:#E69F00">Japanese</a>');
});

test('a grid cell lists every context of that day, not just the one it shows', () => {
  const grid = weeksGrid(plain, 2026, (d) => model.dominant(d));
  assert.match(grid, /data-cid="c1" data-cids="c0 c1"/);
});

test('a Contexts row and a prose link carry their context id', () => {
  assert.match(contexts(plain), /<a href="\/c\/japanese\/" data-cid="c0">/);
  const posts = [{ title: 'T', date: '2026-09-10', photos: [], paras: ['讀 [[Japanese]] 和 [[Nope]]'], layout: 'quiet', file: 'x.md' }];
  const html = home(plain, posts);
  assert.match(html, /<a class="lk" href="\/c\/japanese\/" data-cid="c0" style="--c:#E69F00">Japanese<\/a>/);
  assert.match(html, /Nope/);
  assert.doesNotMatch(html, /href="\/c\/nope\//);
});

test('a Day group heading is a focus source through the name inside it', () => {
  assert.match(day(plain, '2026-09-10'), /<h2><span class="dot"[^>]*data-cid="c0"[^>]*><\/span><a class="cn"[^>]*data-cid="c0"/);
});

// ── focus.js pure functions ──────────────────────────

const code = fs.readFileSync(new URL('../src/assets/focus.js', import.meta.url), 'utf8');
const sandbox = {};
vm.runInNewContext(code, sandbox);
const { bloomDelays, colorOf } = sandbox.MeanwhileFocus;

test('the bloom follows the dates, oldest first, in the original order', () => {
  // The script runs in its own realm, so compare the values, not the Array.
  assert.deepEqual([...bloomDelays(['2026-09-10', '2026-09-05', '2026-09-07'])], [20, 0, 10]);
});

test('the bloom never takes longer than its ceiling', () => {
  const dates = Array.from({ length: 60 }, (_, i) => `2026-01-${String(i + 1).padStart(2, '0')}`);
  assert.equal(bloomDelays(dates).at(-1), 400);
  assert.equal([...bloomDelays(dates, 10, 120)].filter((d) => d === 120).length, 48);
});

test('a grey context turns ink in focus; a coloured one keeps its colour', () => {
  const greys = ['#8E8E89', '#CFCFCA'];
  assert.equal(colorOf('#8E8E89', greys, '#1E1E1C'), '#1E1E1C');
  assert.equal(colorOf(' #cfcfca ', greys, '#1E1E1C'), '#1E1E1C');
  assert.equal(colorOf('#E69F00', greys, '#1E1E1C'), '#E69F00');
  assert.equal(colorOf('', greys, '#1E1E1C'), '#1E1E1C');
});

// ── Prose Peek ───────────────────────────────────────

const POSTS = [{
  title: 'T', date: '2026-09-10', photos: [],
  paras: ['讀 [[Japanese]]、找 [[Job Preparation|工作]] 和 [[Nope]]'], layout: 'quiet', file: 'x.md',
}];

test('a Home link grows a peek of that context, with its days and its span', () => {
  const html = home(play, POSTS);
  assert.match(html, /<a class="lk" href="\/c\/japanese\/"[^>]*>Japanese<span class="lk-trace" aria-hidden="true"><svg/);
  assert.match(html, /<span class="lk-n">2 days · Sep 9 – Sep 10<\/span>/);
  assert.match(html, /<span class="lk-n">2 days · Sep 9 – Sep 10<\/span>/); // Job Preparation, same two days
  assert.equal((html.match(/class="lk-trace"/g) || []).length, 2);
});

test('the peek is the ridge alone, the way a lane is', () => {
  const html = home(play, POSTS);
  assert.match(html, /<span class="lk-trace"[^>]*><svg[^>]*>(?:(?!<\/svg>).)*class="ridge"/s);
  assert.match(html, /class="ridge" d="[^"]*" fill="#E69F00"\/><\/svg>/);
  assert.doesNotMatch(html, /<path d="M\d+ 0h1v10h-1z/); // no ticks anywhere on the page
});

test('a link in the prose can go out to the web, with no peek on it', () => {
  const html = home(play, [{ ...POSTS[0], paras: ['參考 [Diana Lu](https://diana.lu) 的履歷設計'] }]);
  assert.match(html, /參考 <a class="ext" href="https:\/\/diana\.lu" rel="noreferrer">Diana Lu<\/a> 的履歷設計/);
});

test('a theme without linkTrace keeps the prose plain', () => {
  const html = home(plain, POSTS);
  assert.doesNotMatch(html, /lk-trace/);
  assert.match(html, /<a class="lk" href="\/c\/japanese\/"[^>]*>Japanese<\/a>/);
});

test('a context nobody has recorded stays plain text, peek or no peek', () => {
  for (const site of [play, plain]) {
    const html = home(site, POSTS);
    assert.match(html, /Nope/);
    assert.doesNotMatch(html, /href="\/c\/nope\//);
  }
});

test('the peek falls back to the context\'s last year when the post\'s year is empty', () => {
  const html = home(play, [{ ...POSTS[0], date: '2030-01-01' }]);
  assert.match(html, /<span class="lk-n">2 days · Sep 9 – Sep 10<\/span>/);
});

