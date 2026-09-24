// content/vibe/*.md → [{ slug, title, date, image, alt, blurb, description, page, kind, links, context, file }]
// One file per project. The card's text is the first paragraph below the front matter, as written;
// `blurb` stands in only for a file with no body.
// A missing field is a build error, not a silently dropped project — see ../meanwhile-vibe-page.md §4.2.
import fs from 'node:fs';
import path from 'node:path';

const REQUIRED = ['title', 'date', 'image', 'alt'];
const LINK_TYPES = ['demo', 'repo', 'post'];
const MAX_LINKS = 3;

// `  - { type: repo, url: https://… }` — the one shape the schema has.
const LINK_LINE = /^\s*-\s*\{(.*)\}\s*$/;

function parseLink(inside, file) {
  const kv = {};
  for (const part of inside.split(',')) {
    const at = part.indexOf(':');
    if (at < 0) continue;
    kv[part.slice(0, at).trim()] = part.slice(at + 1).trim();
  }
  if (!LINK_TYPES.includes(kv.type)) {
    throw new Error(`${file}: link type must be one of ${LINK_TYPES.join(' / ')} (got "${kv.type ?? ''}")`);
  }
  if (!kv.url) throw new Error(`${file}: link of type "${kv.type}" has no url`);
  return { type: kv.type, url: kv.url };
}

/**
 * The first paragraph of the body: headings, pictures, their italic captions and rules are skipped,
 * and a paragraph's lines are joined. `null` for a file with nothing below the front matter.
 */
export function firstParagraph(body) {
  const block = body.split(/\r?\n\s*\r?\n/).map((b) => b.trim())
    .find((b) => b && !/^(#|!|---|\*[^*].*\*$)/.test(b));
  return block ? block.replace(/\s*\r?\n\s*/g, ' ') : null;
}

export function parseVibe(text, file) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error(`${file}: missing --- front matter ---`);
  const meta = {};
  const links = [];
  let inLinks = false;

  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const item = line.match(LINK_LINE);
    if (inLinks && item) {
      links.push(parseLink(item[1], file));
      continue;
    }
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) throw new Error(`${file}: front matter line is not "key: value": ${line.trim()}`);
    inLinks = kv[1] === 'links';
    if (inLinks) {
      if (kv[2].trim()) throw new Error(`${file}: write links as "- { type: …, url: … }" lines under "links:"`);
    } else meta[kv[1]] = kv[2].trim();
  }

  const description = firstParagraph(m[2]);
  const missing = REQUIRED.filter((k) => !meta[k]);
  if (!description && !meta.blurb) missing.push('blurb (or a paragraph below the front matter)');
  if (missing.length) throw new Error(`${file}: missing required front matter: ${missing.join(', ')}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) throw new Error(`${file}: "date" must be YYYY-MM-DD (got "${meta.date}")`);
  if (links.length > MAX_LINKS) throw new Error(`${file}: at most ${MAX_LINKS} links (found ${links.length})`);

  return {
    slug: file.replace(/\.md$/, ''),
    file,
    title: meta.title,
    date: meta.date,
    image: meta.image,
    alt: meta.alt,
    blurb: meta.blurb ?? null,
    description,
    page: meta.page ?? null,
    // What kind of project, under its year: every one so far was vibe coded.
    kind: meta.kind || 'vibe coding',
    links,
    context: meta.context ?? null,
  };
}

/** Every project, newest first. A missing folder is not an error: the page says so itself. */
export function loadVibe(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => parseVibe(fs.readFileSync(path.join(dir, f), 'utf8'), f))
    .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
}

