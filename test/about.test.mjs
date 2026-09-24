import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAbout, about } from '../src/pages/about.mjs';

const TEXT = `## Work
- NTU, Research Assistant (Oct 2025 – Apr 2026)
- No dates here

## Papers
- A Paper
\t- **C.-W. Huang**, X. Y
\t- ECCV 2024 · [arxiv](https://arxiv.org/abs/1)
- [Meanwhile](/project/)
`;

test('sections, items, details, and dates set apart', () => {
  const [work, papers] = parseAbout(TEXT);
  assert.equal(work.title, 'Work');
  assert.deepEqual(work.items[0], { text: 'NTU, Research Assistant', when: 'Oct 2025 – Apr 2026', details: [] });
  assert.equal(work.items[1].when, '');
  assert.deepEqual(papers.items[0].details, ['**C.-W. Huang**, X. Y', 'ECCV 2024 · [arxiv](https://arxiv.org/abs/1)']);
});

const site = { model: {}, config: {}, theme: { about: true, nav: ['about'] }, motion: false, scripts: [], url: (p) => `/base${p}` };

test('bold, outside links, and links to a page on this site', () => {
  const html = about(site, parseAbout(TEXT));
  assert.match(html, /<strong>C\.-W\. Huang<\/strong>/);
  assert.match(html, /<a class="ext" href="https:\/\/arxiv\.org\/abs\/1" rel="noreferrer">arxiv<\/a>/);
  assert.match(html, /<a class="ext" href="\/base\/project\/">Meanwhile<\/a>/);
  assert.match(html, /<span class="ab-when">Oct 2025 – Apr 2026<\/span>/);
  assert.match(html, /<a href="\/base\/about\/" aria-current="page">/);
});

test('with no file the page says so in one line', () => {
  assert.match(about(site, []), /<p class="quiet-note">/);
});
