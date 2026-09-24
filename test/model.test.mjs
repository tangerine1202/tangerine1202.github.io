import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/parse.mjs';
import { buildModel, slugify, UNCATEGORIZED } from '../src/model.mjs';
import { autoLayout, parsePost, shapeOf, home, ems, textHeight, fit } from '../src/pages/home.mjs';

const config = {
  today: '2026-09-11', timeZone: 'Asia/Taipei', privateTag: '#private', privateContexts: [], mapEntry: null,
  colors: { Japanese: '#E69F00', 'Job Preparation': '#56B4E9' }, other: '#8E8E89', uncategorized: '#CFCFCA',
};
const LOG = `### 2026-09-10
- [[Job Preparation]] a
- [[Job Preparation]] b
- [[Zeta]] z
- 閱讀
### 2026-09-09
- [[Alpha]] a
- [[Japanese]] j
`;
const model = buildModel(parse(LOG, config), config);

test('slugs keep Chinese, drop emoji and punctuation', () => {
  assert.equal(slugify('航警替代役'), '航警替代役');
  assert.equal(slugify('T-RO Revision'), 't-ro-revision');
  assert.equal(slugify('🩺 追蹤：異常'), '追蹤-異常');
});

test('ids follow first appearance, oldest first', () => {
  assert.deepEqual([...model.ctx.values()].map((c) => c.id + ':' + c.name).slice(0, 2), ['c0:Alpha', 'c1:Japanese']);
});

test('rank: configured order, then others alphabetically, then Uncategorized', () => {
  assert.deepEqual(model.byRank.map((c) => c.label), ['Japanese', 'Job Preparation', 'Alpha', 'Zeta', 'Uncategorized']);
});

test('one dot per context per day', () => {
  assert.deepEqual(model.dayContexts('2026-09-10').map((c) => c.name), ['Job Preparation', 'Zeta', UNCATEGORIZED]);
});

test('dominant is the context with the most lines', () => {
  assert.equal(model.dominant('2026-09-10').name, 'Job Preparation');
});

test('colours come from the config, grey otherwise', () => {
  assert.equal(model.ctx.get('Japanese').color, '#E69F00');
  assert.equal(model.ctx.get('Zeta').color, '#8E8E89');
  assert.equal(model.ctx.get(UNCATEGORIZED).color, '#CFCFCA');
});

test('Home layout follows the photos', () => {
  assert.deepEqual(
    [[], [{ shape: 'portrait' }], [{ shape: 'square' }], [{ shape: 'landscape' }], [{}, {}]].map(autoLayout),
    ['quiet', 'side', 'center', 'wide', 'pair']);
});

const POST = (meta) => parsePost(`---\ndate: 2026-07-31\ntitle: T\n${meta}\n---\n文字\n`, 'x.md');

test('one photo line can carry several photos, separated by commas', () => {
  const p = POST('photo: 拾得物系統 | landscape, peg-insertion | landscape');
  assert.deepEqual(p.photos.map((ph) => [ph.caption, ph.shape]), [['拾得物系統', 'landscape'], ['peg-insertion', 'landscape']]);
  assert.equal(p.layout, 'pair');
});

test('a photo line with nothing on it still asks for a placeholder', () => {
  assert.deepEqual(POST('photo:').photos, [{ caption: '', shape: 'landscape', src: '' }]);
});

test('a photo is square within about 15%, otherwise landscape or portrait', () => {
  assert.deepEqual([{ w: 1600, h: 1255 }, { w: 973, h: 1500 }, { w: 1000, h: 1000 }, { w: 1100, h: 1000 }].map(shapeOf),
    ['landscape', 'portrait', 'square', 'square']);
});

test('the layout and the frame follow the real photo, not the shape written in the post', () => {
  const site = {
    model: { ctx: new Map() }, config: {}, theme: {}, motion: false, scripts: [], url: (p) => p,
    hasPhoto: (f) => f === 'tall.png', photoSize: () => ({ w: 791, h: 1200 }),
  };
  // Written as landscape (a 21:9 frame, wide), but the file is portrait: it goes beside the text.
  const html = home(site, [POST('photo: 書 | landscape | tall.png')]);
  assert.match(html, /<article class="post l-side fit" style="--tw: \d+px; --pw: \d+px; --h: \d+px"/);
  assert.match(html, /<figure class="photo portrait" style="--ar: 791 \/ 1200"><div class="frame" style="aspect-ratio: 791 \/ 1200"><img src="\/photos\/tall\.jpg"[^>]* width="791" height="1200"/);
  // A layout the post names still wins, and a placeholder keeps the shape it was given.
  assert.match(home(site, [POST('layout: wide\nphoto: 書 | landscape | tall.png')]), /l-wide/);
  assert.match(home(site, [POST('photo: 書 | portrait')]), /<figure class="photo portrait"><div class="frame ph">/);
});

// ── one photo fitted to its text ─────────────────────

test('text is measured in em: CJK a full em, Latin half, a space a quarter', () => {
  assert.equal(ems('讀了'), 2);
  assert.equal(ems('ab c'), 1.75);
});

test('more text is taller text, and a narrower column is taller too', () => {
  const short = POST('photo:');
  const long = parsePost(`---\ndate: 2026-07-31\ntitle: T\n---\n${'文字'.repeat(200)}\n`, 'x.md');
  assert.ok(textHeight(long, 608) > textHeight(short, 608));
  assert.ok(textHeight(long, 480) > textHeight(long, 608));
});

test('a short post gets a short photo beside it; a long one a taller photo, up to the limit', () => {
  const words = (n) => parsePost(`---\ndate: 2026-07-31\ntitle: T\n---\n${'字'.repeat(n)}\n`, 'x.md');
  const cover = { w: 973, h: 1500 };
  assert.deepEqual(fit(words(40), cover), { layout: 'side', textW: 608, photoW: 234, photoH: 360 });
  const mid = fit(words(400), cover);
  assert.equal(mid.layout, 'side');
  assert.ok(mid.photoH > 360 && mid.photoH < 600, `photoH ${mid.photoH}`);
  assert.equal(fit(words(3000), cover).photoH, 600);
});

test('a landscape photo narrows the text to stand beside it; a panorama goes under it', () => {
  const p = parsePost(`---\ndate: 2026-07-31\ntitle: T\n---\n${'字'.repeat(120)}\n`, 'x.md');
  const beside = fit(p, { w: 1600, h: 1255 });
  assert.equal(beside.layout, 'side');
  assert.ok(beside.textW < 608 && beside.textW >= 480, `textW ${beside.textW}`);
  assert.ok(beside.textW + 64 + beside.photoH * (1600 / 1255) <= 1041, 'fits the content width');
  assert.equal(fit(p, { w: 3000, h: 800 }).layout, 'wide');
});
