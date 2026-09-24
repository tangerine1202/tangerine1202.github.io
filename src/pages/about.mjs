import fs from 'node:fs';
import { esc } from '../util.mjs';
import { layout } from '../layout.mjs';

/**
 * content/about.md → [{ title, items: [{ text, when, details }] }]
 * The one shape it reads: `## Section`, `- item`, and indented `- detail` lines under an item.
 * An item's trailing ` (…)`, after a space, is its dates, set apart at the right.
 */
export function parseAbout(text) {
  const sections = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const h = line.match(/^##\s+(.*)$/);
    const li = line.match(/^(\s*)-\s+(.*)$/);
    if (h) sections.push({ title: h[1].trim(), items: [] });
    else if (li && sections.length) {
      const items = sections.at(-1).items;
      if (li[1] && items.length) items.at(-1).details.push(li[2].trim());
      else {
        const m = li[2].trim().match(/^(.*\S)\s+\(([^()]*)\)$/);
        items.push({ text: m ? m[1] : li[2].trim(), when: m ? m[2] : '', details: [] });
      }
    }
  }
  return sections;
}

export function loadAbout(file) {
  return fs.existsSync(file) ? parseAbout(fs.readFileSync(file, 'utf8')) : [];
}

// `**bold**` and `[words](url)`; a url starting with `/` is a page on this site.
function inline(site, s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, words, href) => href.startsWith('/')
      ? `<a class="ext" href="${site.url(href)}">${words}</a>`
      : `<a class="ext" href="${href}" rel="noreferrer">${words}</a>`);
}

function item(site, it) {
  const when = it.when ? `<span class="ab-when">${esc(it.when)}</span>` : '';
  const details = it.details.map((d) => `<p class="ab-detail">${inline(site, d)}</p>`).join('');
  return `<li><p class="ab-main"><span>${inline(site, it.text)}</span>${when}</p>${details}</li>`;
}

/** About: who I am, as a list — each section's name out in the margin, its items in the column. */
export function about(site, sections) {
  const body = sections.length
    ? '<h1 class="page-title">About</h1>\n' + sections.map((s) => `<section class="ab-sec">
<h2 class="ab-title">${esc(s.title)}</h2>
<ul class="ab-list">${s.items.map((it) => item(site, it)).join('')}</ul>
</section>`).join('\n')
    : '<h1 class="page-title">About</h1>\n<p class="quiet-note">Nothing here yet.</p>';
  return layout(site, { title: 'About', current: 'about', cls: 'p-about', body, ribbon: false });
}
