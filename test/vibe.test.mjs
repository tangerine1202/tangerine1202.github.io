import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseVibe, loadVibe } from '../src/vibe.mjs';
import { parse } from '../src/parse.mjs';
import { buildModel } from '../src/model.mjs';
import { vibe, titleHref } from '../src/pages/vibe.mjs';
import { vibeContextActivity } from '../src/vibe-context-activity.mjs';
import { VIBE_DOT_TRACE_CSS } from '../src/vibe-dot-trace.mjs';

const FULL = `---
title: 發票自動對帳
date: 2026-08-14
image: vibe-invoice-recon.png
alt: 終端機顯示對帳結果表格
blurb: 把銀行 CSV 和發票 PDF 對起來，列出對不上的幾筆。手動對了三個月之後決定不要再手動對了。
links:
  - { type: repo, url: https://github.com/x/y }
  - { type: demo, url: https://demo.example }
context: 記帳
---
`;

const without = (key) => FULL.split('\n').filter((l) => !l.startsWith(`${key}:`)).join('\n');

// ── front matter ─────────────────────────────────────

test('every field of the schema comes through', () => {
  const v = parseVibe(FULL, 'invoice-recon.md');
  assert.equal(v.slug, 'invoice-recon');
  assert.equal(v.title, '發票自動對帳');
  assert.equal(v.date, '2026-08-14');
  assert.equal(v.image, 'vibe-invoice-recon.png');
  assert.equal(v.alt, '終端機顯示對帳結果表格');
  assert.match(v.blurb, /^把銀行 CSV/);
  assert.equal(v.context, '記帳');
  assert.deepEqual(v.links, [
    { type: 'repo', url: 'https://github.com/x/y' },
    { type: 'demo', url: 'https://demo.example' },
  ]);
});

test('context and links are optional', () => {
  const v = parseVibe(without('context').replace(/links:\n(  - .*\n)+/, ''), 'a.md');
  assert.equal(v.context, null);
  assert.deepEqual(v.links, []);
});

// ── validation: loud, and it says which file and which field ──

for (const key of ['title', 'date', 'image', 'alt', 'blurb']) {
  test(`a missing "${key}" fails the build, naming the file and the field`, () => {
    assert.throws(() => parseVibe(without(key), 'invoice-recon.md'), new RegExp(`invoice-recon\\.md.*${key}`));
  });
}

test('a fourth link fails the build', () => {
  const four = FULL.replace('context: 記帳\n', '  - { type: post, url: https://a }\n  - { type: repo, url: https://b }\n');
  assert.throws(() => parseVibe(four, 'a.md'), /at most 3 links \(found 4\)/);
});

test('a link type outside demo / repo / post fails the build', () => {
  assert.throws(() => parseVibe(FULL.replace('type: repo', 'type: video'), 'a.md'), /a\.md.*demo \/ repo \/ post.*video/);
});

test('a date that is not YYYY-MM-DD fails the build', () => {
  assert.throws(() => parseVibe(FULL.replace('2026-08-14', '2026/08/14'), 'a.md'), /"date" must be YYYY-MM-DD/);
});

test('no front matter at all fails the build', () => {
  assert.throws(() => parseVibe('just prose\n', 'a.md'), /a\.md: missing --- front matter/);
});

// ── order and sections ───────────────────────────────

test('a folder of projects loads newest first', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-'));
  for (const d of ['2026-06-01', '2026-09-14', '2026-08-02']) {
    fs.writeFileSync(path.join(dir, `${d}.md`), FULL.replace('2026-08-14', d));
  }
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'not a project');
  assert.deepEqual(loadVibe(dir).map((v) => v.date), ['2026-09-14', '2026-08-02', '2026-06-01']);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a folder that is not there is not an error', () => {
  assert.deepEqual(loadVibe('content/no-such-folder'), []);
});

// ── the page ─────────────────────────────────────────

const cfg = {
  today: '2026-09-11', timeZone: 'Asia/Taipei', privateTag: '#private', privateContexts: [], mapEntry: null,
  colors: { Japanese: '#E69F00' }, other: '#8E8E89', uncategorized: '#CFCFCA', laneMinDays: 3,
};
const LOG = `### 2026-09-10
- [[Japanese]] a
### 2026-06-01
- [[Japanese]] b
`;
const model = buildModel(parse(LOG, cfg), cfg);
const jp = model.ctx.get('Japanese');
const siteWith = (over = {}) => ({
  model, config: { ...cfg, ...over.config },
  theme: { vibe: true, media: true, nav: ['vibe', 'media', 'log'], ...over.theme }, motion: false, scripts: [],
  url: (p) => p, hasPhoto: (f) => f === 'vibe-a.png' || f === 'vibe-a.webp' || f === 'vibe-clip.mp4',
});
const site = siteWith();

const project = (over = {}) => ({
  slug: 'a', file: 'a.md', title: '拾得物登錄小工具', date: '2026-09-14',
  image: 'vibe-a.png', alt: '登錄畫面', blurb: '把登錄流程自動化。手動做了三個月之後決定不要再手動做了。',
  links: [], context: null, ...over,
});

test('the page is one list of projects, in the order they come, with no section headings', () => {
  const html = vibe(site, [project(), project({ slug: 'b', date: '2026-06-02' })]);
  assert.equal(html.match(/<article class="vb">/g).length, 2);
  assert.doesNotMatch(html, /<h2/);
  assert.ok(html.indexOf('>Sep<') < html.indexOf('>Jun<'));
});

test('the year sits out in the margin where the day would be, with its month beside it', () => {
  const html = vibe(site, [project()]);
  assert.match(html, /<div class="d"><span class="dd"><span class="mo">Sep<\/span> <span class="dn">2026<\/span><\/span><\/div>/);
  assert.doesNotMatch(html, /<span class="dn">14<\/span>/);
  // The margin is the row's first column, the same one the Log and the Media page use.
  assert.match(fs.readFileSync('src/assets/almanac.css', 'utf8'), /\.vb \{[^}]*grid-template-columns: var\(--margin\)/);
});

test('a picture is a 16:10 frame with its alt text', () => {
  const html = vibe(site, [project()]);
  assert.match(html, /<div class="vb-frame">/);
  assert.match(html, /alt="登錄畫面"/);
  // The 16:10 is the frame's, in the stylesheet, so every card keeps it — and the picture sits
  // whole inside it, never cropped.
  const css = fs.readFileSync('src/assets/almanac.css', 'utf8');
  assert.match(css, /\.vb-frame \{[^}]*aspect-ratio: 16 \/ 10/);
  assert.match(css, /\.vb-frame img, \.vb-frame video \{[^}]*object-fit: contain/);
  // Home's photos fit the same way.
  assert.match(css, /\n\.frame img \{[^}]*object-fit: contain/);
});

test('a webp beside the png is used, and a missing file still lays out', () => {
  assert.match(vibe(site, [project()]), /<source srcset="\/photos\/vibe-a\.webp" type="image\/webp">/);
  assert.match(vibe(site, [project({ image: 'vibe-missing.png' })]), /<div class="vb-frame ph">/);
});

test('an mp4 plays itself, quietly and on loop — no GIFs', () => {
  const html = vibe(site, [project({ image: 'vibe-clip.mp4' })]);
  assert.match(html, /<video src="\/photos\/vibe-clip\.mp4" aria-label="登錄畫面" muted autoplay loop playsinline>/);
});

test('the title leads to the demo, then the post, then the code', () => {
  assert.equal(titleHref([{ type: 'repo', url: 'r' }, { type: 'post', url: 'p' }, { type: 'demo', url: 'd' }]), 'd');
  assert.equal(titleHref([{ type: 'repo', url: 'r' }, { type: 'post', url: 'p' }]), 'p');
  assert.equal(titleHref([{ type: 'repo', url: 'r' }]), 'r');
  assert.equal(titleHref([]), null);
});

test('a project with no links has a title nobody can click', () => {
  assert.match(vibe(site, [project()]), /<h3 class="vb-title">拾得物登錄小工具<\/h3>/);
});

test('links are one line of words, and they are underlined in the context colour', () => {
  const html = vibe(site, [project({ context: 'Japanese', links: [{ type: 'repo', url: 'https://r' }, { type: 'demo', url: 'https://d' }] })]);
  assert.match(html, /<p class="vb-links"><a class="lk" href="https:\/\/d"[^>]*>示範<\/a><span class="sep">·<\/span><a class="lk" href="https:\/\/r"[^>]*>原始碼<\/a><\/p>/);
  assert.match(html, new RegExp(`style="--c:${jp.color}"`));
});

test('with no projects the page says so in one line, and nothing else', () => {
  const html = vibe(site, []);
  assert.match(html, /<p class="quiet-note">/);
  assert.doesNotMatch(html, /vb-month/);
});

test('the nav lists the sections in the order the theme names them', () => {
  const links = [...vibe(site, []).matchAll(/<a href="\/(\w+)\/"/g)].map((m) => m[1]);
  assert.deepEqual(links, ['vibe', 'media', 'log']);
});

test('a section the theme has not turned on is left out, however the nav names it', () => {
  const noMedia = siteWith({ theme: { vibe: true, media: false, nav: ['vibe', 'media', 'log'] } });
  const links = [...vibe(noMedia, []).matchAll(/<a href="\/(\w+)\/"/g)].map((m) => m[1]);
  assert.deepEqual(links, ['vibe', 'log']);
});

// ── dot trace (removable — see the README; this whole section goes with it) ───────────

// The switch lives only in here, so deleting this section leaves no trace of it in the fixtures.
const withTrace = siteWith({ config: { features: { vibeDotTrace: true } } });

test('the trace covers the last 90 days, today included', () => {
  const a = vibeContextActivity(model, 'Japanese');
  assert.equal(a.days.length, 90);
  assert.equal(a.days[0].date, '2026-06-14');
  assert.equal(a.days.at(-1).date, '2026-09-11');
  assert.equal(a.count, 1); // 2026-06-01 is older than the window
  assert.equal(a.days.filter((d) => d.on).length, 1);
  assert.equal(a.days.find((d) => d.date === '2026-09-10').on, true);
});

test('the day the window opens on counts, the one before it does not', () => {
  const at90 = buildModel(parse('### 2026-06-14\n- [[Japanese]] a\n', cfg), cfg);
  assert.equal(vibeContextActivity(at90, 'Japanese').count, 1);
  const at91 = buildModel(parse('### 2026-06-13\n- [[Japanese]] a\n', cfg), cfg);
  assert.equal(vibeContextActivity(at91, 'Japanese'), null);
});

test('no context, an unknown one, or a quiet one draws nothing at all', () => {
  assert.equal(vibeContextActivity(model, null), null);
  assert.equal(vibeContextActivity(model, '記帳'), null);
  assert.equal(vibeContextActivity(model, 'Japanese', 1), null); // nothing today
});

test('hovering the line grows the days that are in it', () => {
  assert.match(VIBE_DOT_TRACE_CSS, /\.vibe-dot-trace:hover i\.on \{ transform: scale\([\d.]+\); \}/);
  assert.doesNotMatch(VIBE_DOT_TRACE_CSS, /box-shadow/);
});

test('the trace is the whole context, and it leads to that context', () => {
  const html = vibe(withTrace, [project({ context: 'Japanese' })]);
  assert.match(html, /<a class="vibe-dot-trace" href="\/c\/japanese\/"/);
  assert.equal((html.match(/<i(?: class="on")?><\/i>/g) || []).length, 90);
});

test('a project with no context ends at its links', () => {
  assert.doesNotMatch(vibe(withTrace, [project()]), /<a class="vibe-dot-trace"/);
});

test('with the switch off there is no trace and no style for one', () => {
  const off = siteWith({ config: { features: { vibeDotTrace: false } } });
  const html = vibe(off, [project({ context: 'Japanese' })]);
  assert.match(vibe(withTrace, [project({ context: 'Japanese' })]), /vibe-dot-trace/); // it is there when it is on
  assert.doesNotMatch(html, /vibe-dot-trace/); // not the markup, and not the style either
  assert.doesNotMatch(html, /<style>/);
  // Nothing of it is left in the shared stylesheet either.
  assert.doesNotMatch(fs.readFileSync('src/assets/almanac.css', 'utf8'), /dot-trace/);
});
