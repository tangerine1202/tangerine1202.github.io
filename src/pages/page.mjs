// content/page/*.md → a page of its own, at /project/<name>/: a write-up behind a project.
// The shape it reads, as Obsidian writes it: a `# Title`, paragraphs, and pictures as `![[file]]` or
// `![alt](file)`, each with an optional `*caption*` on the line after it.
import fs from 'node:fs';
import path from 'node:path';
import { esc } from '../util.mjs';
import { layout } from '../layout.mjs';
import { photoName } from '../photos.mjs';
import { prose } from './home.mjs';

const EMBED = /^!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]$|^!\[([^\]]*)\]\(([^)\s]+)\)$/;
const CAPTION = /^\*([^*].*)\*$/;

export function parsePage(text, file) {
  const slug = file.replace(/\.md$/, '');
  let title = null;
  const blocks = [];
  for (const raw of text.split(/\r?\n\s*\r?\n/)) {
    const lines = raw.trim().split(/\r?\n/).map((l) => l.trim());
    if (!lines[0]) continue;
    const h = lines[0].match(/^#\s+(.*)$/);
    if (h && !title) {
      title = h[1].trim();
      lines.shift();
      if (!lines.length) continue;
    }
    const img = lines[0].match(EMBED);
    if (img) {
      const src = img[1] ?? img[3];
      const cap = lines[1]?.match(CAPTION);
      blocks.push({ type: 'img', src: src.trim(), alt: img[2] ?? '', caption: cap ? cap[1] : '' });
      continue;
    }
    blocks.push({ type: 'p', text: lines.join(' ') });
  }
  if (!title) throw new Error(`${file}: a page starts with a "# Title" line`);
  return { slug, file, title, blocks };
}

export function loadPages(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => parsePage(fs.readFileSync(path.join(dir, f), 'utf8'), f));
}

// A picture at its own shape, so a wide screenshot and a tall one each fill their frame.
function figure(site, b) {
  if (!site.hasPhoto(b.src)) return `<figure class="pg-fig"><div class="frame ph"><span class="ph-label">Image</span></div></figure>`;
  const size = site.photoSize?.(b.src);
  const img = `<img src="${site.url(`/photos/${encodeURI(photoName(b.src))}`)}" alt="${esc(b.alt || b.caption)}"`
    + `${size ? ` width="${size.w}" height="${size.h}"` : ''} loading="lazy" decoding="async">`;
  const caption = b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : '';
  return `<figure class="pg-fig"><div class="frame"${size ? ` style="aspect-ratio: ${size.w} / ${size.h}"` : ''}>${img}</div>${caption}</figure>`;
}

/** A write-up page, in the Project tab: one reading column, centred. */
export function page(site, pg) {
  const body = `<a class="back pg-back" data-back href="${site.url('/project/')}">← Project</a>
<h1 class="page-title pg-title">${esc(pg.title)}</h1>
<article class="pg">
${pg.blocks.map((b) => (b.type === 'img' ? figure(site, b) : `<div class="prose">${prose(site, b.text, site.model.today)}</div>`)).join('\n')}
</article>`;
  return layout(site, { title: pg.title, current: 'project', cls: 'p-page', body, ribbon: false });
}
