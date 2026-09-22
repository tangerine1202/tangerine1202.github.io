import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/parse.mjs';
import { buildModel, slugify, UNCATEGORIZED } from '../src/model.mjs';
import { autoLayout, parsePost } from '../src/pages/home.mjs';

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
