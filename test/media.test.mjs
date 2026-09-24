import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMedia, KINDS } from '../src/media.mjs';
import { media } from '../src/pages/media.mjs';

const TEXT = `# Media Log

> description: >- What I read and watched.

### 2026

- 📖 The Non-Designer's Design Book / Robin Williams
- 📖 0915 體驗設計 / 玉樹真一郎
- 🎬 0727 跟蹤 / Stephen Nolan
- 🎵 0720 chilldspot
- 🇯🇵 Japanese Grammar Guide / Tae Kim
- 🐙 0101 something new

### 2024

- 📖 原子習慣 / 詹姆斯·克萊爾

7/1 - 9/27 @ OSX, Tokyo, Japan

- 📖 三體 / 劉慈欣

### Early

- 🎬 聲之形

## ⭐ Highlight

- 🎮 NieR: Automata

---

### Pause

- 📖 Every Page is Page One
`;

const parsed = parseMedia(TEXT);
const items = (title) => parsed.sections.find((s) => s.title === title).entries.filter((e) => e.type === 'item');

test('the description comes from the quoted front line', () => {
  assert.equal(parsed.description, 'What I read and watched.');
});

test('year sections keep their order and count', () => {
  assert.deepEqual(parsed.sections.map((s) => s.title), ['2026', '2024', 'Early', 'Highlight', 'Pause']);
});

test('an item has a kind, a title and an author', () => {
  assert.deepEqual(items('2026')[1], { type: 'item', kind: 'book', emoji: '📖', date: '2026-09-15', title: '體驗設計', by: '玉樹真一郎' });
});

test('a MMDD date takes the year of its section; no date stays null', () => {
  assert.equal(items('2026')[0].date, null);
  assert.equal(items('2026')[2].date, '2026-07-27');
});

test('a title without a slash has no author', () => {
  assert.deepEqual([items('2026')[3].title, items('2026')[3].by], ['chilldspot', null]);
});

test('an unknown emoji still counts, as "other", and keeps its emoji', () => {
  assert.deepEqual([items('2026')[5].kind, items('2026')[5].emoji], ['other', '🐙']);
});

test('a plain line inside a section is a note, kept in place', () => {
  const entries = parsed.sections[1].entries;
  assert.deepEqual(entries.map((e) => e.type), ['item', 'note', 'item']);
  assert.equal(entries[1].text, '7/1 - 9/27 @ OSX, Tokyo, Japan');
});

test('Highlight and Pause are sections of their own kind', () => {
  assert.equal(parsed.sections[3].kind, 'highlight');
  assert.equal(parsed.sections[4].kind, 'pause');
  assert.equal(parsed.sections[0].kind, 'year');
});

test('counts per kind cover the log sections only, not Highlight or Pause', () => {
  assert.deepEqual(parsed.counts, { book: 4, film: 2, music: 1, japanese: 1, other: 1 });
});

test('every known kind has a label', () => {
  for (const k of Object.values(KINDS)) assert.ok(k.label);
});

const site = {
  model: { today: '2026-09-17' }, config: {}, theme: { media: true }, motion: false, scripts: [], url: (p) => p, hasPhoto: () => false,
  media: parsed,
};

test('the Media page is a Log page in shape: year rows, with no emoji under the year', () => {
  const html = media(site);
  assert.match(html, /<h1 class="page-title">Media<\/h1>/);
  assert.match(html, /<div class="lday mday m-year" data-kind-row><div class="d"><span class="dd"><span class="dn">2026<\/span><\/span>/);
  assert.doesNotMatch(html, /class="dots"/);
});

test('lines keep the order they were written in, with the day last, out at the right', () => {
  const html = media(site);
  const lines = [...html.matchAll(/<li class="ml" data-kind="(\w+)"><span class="mk"[^>]*>[^<]*<\/span><span class="mt">([^<]*)[^]*?<span class="md">([^<]*)<\/span><\/li>/g)]
    .map((m) => `${m[1]} ${m[3]}|${m[2].trim()}`);
  assert.deepEqual(lines.slice(0, 4), ['book |The Non-Designer&#39;s Design Book', 'book Sep 15|體驗設計', 'film Jul 27|跟蹤', 'music Jul 20|chilldspot']);
  assert.match(html, /<span class="mt">體驗設計 <span class="mb">玉樹真一郎<\/span><\/span>/);
});

test('the legend counts each kind and is the filter', () => {
  assert.match(media(site), /<div class="legend mlegend"[^>]*><button type="button" data-kind="book" aria-pressed="false"><span class="mk">📖<\/span><span class="nm">Books<\/span><span class="n">4<\/span><\/button>/);
});

test('a note stays where it was, between the lines', () => {
  const html = media(site);
  assert.match(html, /原子習慣[^]*?<li class="mnote">7\/1 - 9\/27 @ OSX, Tokyo, Japan<\/li><li class="ml"[^>]*>[^]*?三體/);
});

test('rows run years, then Highlight, then Pause', () => {
  const html = media(site);
  assert.deepEqual([...html.matchAll(/class="lday mday m-(\w+)"/g)].map((m) => m[1]), ['year', 'year', 'year', 'highlight', 'pause']);
  assert.match(html, /m-highlight[^]*?<span class="dn">Highlight<\/span>[^]*?NieR: Automata/);
});

test('the Media page escapes markup in titles', () => {
  const html = media({ ...site, media: parseMedia('### 2026\n- 📖 a <b> / c') });
  assert.match(html, /a &lt;b&gt;/);
});

test('Media is in the nav only for a theme that asks for it', () => {
  assert.match(media(site), /href="\/media\/" aria-current="page"/);
  assert.doesNotMatch(media({ ...site, theme: {} }), /href="\/media\/"/);
});
