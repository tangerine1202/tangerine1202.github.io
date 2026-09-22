// content/vibe/*.md → [{ slug, title, date, image, alt, blurb, links, context, file }]
// One file per project, front matter only: the blurb is the text, so nothing below the fence is read.
// A missing field is a build error, not a silently dropped project — see ../meanwhile-vibe-page.md §4.2.
import fs from 'node:fs';
import path from 'node:path';

const REQUIRED = ['title', 'date', 'image', 'alt', 'blurb'];
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

export function parseVibe(text, file) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?[\s\S]*$/);
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

  const missing = REQUIRED.filter((k) => !meta[k]);
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
    blurb: meta.blurb,
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

