import fs from 'node:fs';
import path from 'node:path';
import { esc, fmtShort } from '../util.mjs';
import { layout, ctxHref, traceSvg } from '../layout.mjs';
import { photoName } from '../photos.mjs';

/** A photo's shape from its real size; within about 15% of square counts as square. */
export function shapeOf({ w, h }) {
  const r = w / h;
  return r > 1.15 ? 'landscape' : r < 0.87 ? 'portrait' : 'square';
}

// ── Fitting one photo to its text ─────────────────────
// A photo is as tall as the text beside it, within PHOTO_H, so a short post gets a small picture and
// nothing leaves a band of empty space. The text's height is estimated here, not measured: on a
// desktop its column is a known width (at most 32em of 19px prose), so lines can be counted.
// The numbers are the stylesheet's: keep them in step with .post .title, .prose p and --max.
const CONTENT = 1040; // --max
const GAP = 64; // .l-side's gap
const TEXT_W = [480, 608]; // the text column may narrow to 480px to make room; 608px is 32em of prose
const PHOTO_H = [360, 600];
const PROSE = { size: 19, line: 19 * 1.78, after: 19 };
const TITLE = { size: 60, line: 60 * 1.08, after: 28, em: 0.46 }; // em: a Latin letter's average width in the display serif
const KICKER = 14 * 1.4 + 14;

/** How wide a run of text is, in em: a CJK character is a full em, Latin about half, a space a quarter. */
export function ems(s, latin = 0.5) {
  let n = 0;
  for (const ch of s) n += ch === ' ' ? 0.25 : /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/u.test(ch) ? 1 : latin;
  return n;
}

// The words a paragraph shows: a link's words, not its target.
const shown = (p) => p.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => b ?? a).replace(/\[([^\]]+)\]\([^)\s]+\)/g, '$1');

/** The text column's height in px at `width`: kicker, title and paragraphs, with the margins between them. */
export function textHeight(p, width) {
  const lines = (em, size) => Math.max(1, Math.ceil((em * size) / width));
  const title = lines(ems(p.title, TITLE.em), TITLE.size) * TITLE.line + TITLE.after;
  const prose = p.paras.reduce((sum, para) => sum + lines(ems(shown(para)), PROSE.size) * PROSE.line + PROSE.after, 0);
  return (p.kicker ? KICKER : 0) + title + prose;
}

/**
 * Where one photo goes and how big it is: beside the text at the text's height, the text narrowing
 * a little if the photo needs it. A photo too wide to stand beside the text at a useful height
 * (a panorama) goes under it instead, no taller than the text would have made it.
 */
export function fit(p, { w, h }) {
  const clampH = (x) => Math.min(PHOTO_H[1], Math.max(PHOTO_H[0], x));
  let tw = TEXT_W[1];
  let ph = clampH(textHeight(p, tw));
  for (let i = 0; i < 3; i++) {
    tw = Math.min(TEXT_W[1], Math.max(TEXT_W[0], CONTENT - GAP - ph * (w / h)));
    ph = clampH(textHeight(p, tw));
  }
  const room = CONTENT - GAP - tw;
  const side = (height) => ({ layout: 'side', textW: Math.round(tw), photoW: Math.round(height * (w / h)), photoH: Math.round(height) });
  if (ph * (w / h) <= room) return side(ph);
  const squeezed = room / (w / h);
  if (squeezed >= 0.7 * textHeight(p, tw)) return side(squeezed);
  return { layout: 'wide', textW: null, photoW: null, photoH: Math.round(ph) };
}

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
  return { ...meta, paras, layout: meta.layout || autoLayout(meta.photos), layoutSet: Boolean(meta.layout), file };
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
  // A real photo's frame is the photo's own shape, so nothing around it is left empty; `--ar` also
  // lets the stylesheet keep a tall one within the screen. A placeholder keeps the shape it was given.
  const size = real && site.photoSize?.(ph.src);
  const ar = size ? `${size.w} / ${size.h}` : null;
  const inner = real
    ? `<img src="${site.url(`/photos/${encodeURI(photoName(ph.src))}`)}" alt="${esc(ph.caption)}"${size ? ` width="${size.w}" height="${size.h}"` : ''} loading="lazy">`
    : '<span class="ph-label">Photo</span>';
  const caption = ph.caption ? `<figcaption>${esc(ph.caption)}</figcaption>` : '';
  return `<figure class="photo ${esc(ph.shape)}"${ar ? ` style="--ar: ${ar}"` : ''}>`
    + `<div class="frame${real ? '' : ' ph'}"${ar ? ` style="aspect-ratio: ${ar}"` : ''}>${inner}</div>${caption}</figure>`;
}

function post(site, p) {
  // The layout follows each photo's real shape, not the one written in the post, unless the post names a layout.
  const shaped = p.photos.map((ph) => {
    const size = ph.src && site.hasPhoto(ph.src) && site.photoSize?.(ph.src);
    return size ? { ...ph, shape: shapeOf(size), size } : ph;
  });
  // One real photo is fitted to the text (see fit); placeholders and pairs keep the layout of their shapes.
  const one = !p.layoutSet && shaped.length === 1 && shaped[0].size ? fit(p, shaped[0].size) : null;
  const layout = p.layoutSet ? p.layout : one ? one.layout : autoLayout(shaped);
  const vars = one ? ` style="${one.textW ? `--tw: ${one.textW}px; --pw: ${one.photoW}px; ` : ''}--h: ${one.photoH}px"` : '';
  const photos = shaped.length ? `<div class="photos">${shaped.map((ph) => figure(site, ph)).join('')}</div>` : '';
  return `<article class="post l-${esc(layout)}${one ? ' fit' : ''}"${vars} data-back-label="${esc(p.title)}">
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
