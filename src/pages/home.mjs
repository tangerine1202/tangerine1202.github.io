import fs from 'node:fs';
import path from 'node:path';
import { esc, fmtShort } from '../util.mjs';
import { layout, ctxHref, traceSvg } from '../layout.mjs';

/** Layout follows the photos, unless the post says otherwise. */
export function autoLayout(photos) {
  if (!photos.length) return 'quiet';
  if (photos.length > 1) return 'pair';
  return { portrait: 'side', square: 'center' }[photos[0].shape] ?? 'wide';
}

export function parsePost(text, file) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error(`${file}: missing --- front matter ---`);
  const meta = { photos: [] };
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    if (kv[1] === 'photo') {
      // `photo: caption | shape | src`, and a comma starts the next one — so captions carry no commas.
      // An empty value is still a photo: a placeholder, waiting for the file.
      for (const one of kv[2].split(',')) {
        const [caption = '', shape = 'landscape', src = ''] = one.split('|').map((x) => x.trim());
        meta.photos.push({ caption, shape, src });
      }
    } else meta[kv[1]] = kv[2].trim();
  }
  if (!meta.date || !meta.title) throw new Error(`${file}: "date" and "title" are required`);
  const paras = m[2].trim().split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  return { ...meta, paras, layout: meta.layout || autoLayout(meta.photos), file };
}

export function loadPosts(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => parsePost(fs.readFileSync(path.join(dir, f), 'utf8'), f))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Prose Peek: a word in a sentence is also a string of dates. The line under the link is that
 * context's year — the year the post was written about, or the context's last year if it was quiet then.
 */
function peek(site, c, date) {
  const posted = Number(date.slice(0, 4));
  const inYear = (y) => c.days.filter((d) => d.startsWith(`${y}-`));
  const year = inYear(posted).length ? posted : Number(c.days.at(-1).slice(0, 4));
  const days = inYear(year);
  const n = `${days.length} ${days.length === 1 ? 'day' : 'days'}`;
  return `<span class="lk-trace" aria-hidden="true">${traceSvg(days, year, c.color, site.model.today, { ridge: true, ticks: false })}`
    + `<span class="lk-n">${n} · ${fmtShort(days[0])} – ${fmtShort(days.at(-1))}</span></span>`;
}

// `[[Context]]` or `[[Context|words]]`, and `[words](https://…)` for anything off the site.
const LINK = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]|\[([^\]]+)\]\(([^)\s]+)\)/g;

/** A context in a sentence: its colour, its page, and the days behind the word. */
function ctxLink(site, name, words, date) {
  const c = site.model.ctx.get(name.trim());
  const text = esc(words.trim());
  if (!c) return text; // a context nobody has recorded is just a word
  const inside = site.theme.linkTrace ? text + peek(site, c, date) : text;
  return `<a class="lk" href="${ctxHref(site, c)}" data-cid="${c.id}" style="--c:${c.color}">${inside}</a>`;
}

function prose(site, p, date) {
  const out = [];
  let last = 0;
  for (const m of p.matchAll(LINK)) {
    out.push(esc(p.slice(last, m.index)));
    out.push(m[1] !== undefined
      ? ctxLink(site, m[1], m[2] ?? m[1], date)
      : `<a class="ext" href="${esc(m[4])}" rel="noreferrer">${esc(m[3])}</a>`);
    last = m.index + m[0].length;
  }
  out.push(esc(p.slice(last)));
  return `<p>${out.join('')}</p>`;
}

function figure(site, ph) {
  const real = ph.src && site.hasPhoto(ph.src);
  const inner = real
    ? `<img src="${site.url(`/photos/${encodeURI(ph.src)}`)}" alt="${esc(ph.caption)}" loading="lazy">`
    : '<span class="ph-label">Photo</span>';
  const caption = ph.caption ? `<figcaption>${esc(ph.caption)}</figcaption>` : '';
  return `<figure class="photo ${esc(ph.shape)}"><div class="frame${real ? '' : ' ph'}">${inner}</div>${caption}</figure>`;
}

function post(site, p) {
  const photos = p.photos.length ? `<div class="photos">${p.photos.map((ph) => figure(site, ph)).join('')}</div>` : '';
  return `<article class="post l-${esc(p.layout)}" data-back-label="${esc(p.title)}">
<div class="text">
${p.kicker ? `<p class="kicker">${esc(p.kicker)}</p>` : ''}
<h2 class="title">${esc(p.title)}</h2>
<div class="prose">${p.paras.map((para) => prose(site, para, p.date)).join('')}</div>
</div>
${photos}
</article>`;
}

export function home(site, posts) {
  const body = posts.length
    ? posts.map((p) => post(site, p)).join('\n')
    : '<p class="quiet-note">Nothing written yet.</p>';
  // Home is the only place with sentences; no data interface, so no ribbon.
  return layout(site, { current: 'home', cls: 'p-home', body, ribbon: false });
}
