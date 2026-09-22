import { esc, ymd, shortMonth } from '../util.mjs';
import { layout } from '../layout.mjs';
import { vibeDotTrace, VIBE_DOT_TRACE_CSS } from '../vibe-dot-trace.mjs';

// The three kinds of link a project can carry, in the order a title prefers them.
const LINKS = { demo: '示範', post: '文章', repo: '原始碼' };
const ORDER = Object.keys(LINKS);

/** The one link a title leads to: the demo if there is one, then the post, then the code. */
export function titleHref(links) {
  for (const type of ORDER) {
    const hit = links.find((l) => l.type === type);
    if (hit) return hit.url;
  }
  return null;
}

/** The picture: always 16:10, so a tall screenshot and a wide one sit in the same shape. */
function frame(site, v) {
  const href = (name) => site.url(`/photos/${encodeURI(name)}`);
  if (!site.hasPhoto(v.image)) return `<div class="vb-frame ph"><span class="ph-label">Image</span></div>`;
  if (/\.mp4$/i.test(v.image)) {
    return `<div class="vb-frame"><video src="${href(v.image)}" aria-label="${esc(v.alt)}" muted autoplay loop playsinline></video></div>`;
  }
  const img = `<img src="${href(v.image)}" alt="${esc(v.alt)}" loading="lazy" decoding="async">`;
  // A compressed sibling is used when it is there; the build never makes one, so nothing here
  // depends on an image library.
  const webp = v.image.replace(/\.(png|jpe?g)$/i, '.webp');
  const inner = webp !== v.image && site.hasPhoto(webp)
    ? `<picture><source srcset="${href(webp)}" type="image/webp">${img}</picture>`
    : img;
  return `<div class="vb-frame">${inner}</div>`;
}

function links(site, v) {
  if (!v.links.length) return '';
  const c = v.context && site.model.ctx.get(v.context);
  const items = [...v.links]
    .sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type))
    .map((l) => `<a class="lk" href="${esc(l.url)}" rel="noreferrer"${c ? ` data-cid="${c.id}"` : ''} style="--c:${c ? c.color : 'var(--pencil)'}">${LINKS[l.type]}</a>`);
  return `<p class="vb-links">${items.join('<span class="sep">·</span>')}</p>`;
}

function card(site, v) {
  const { y, m } = ymd(v.date);
  const href = titleHref(v.links);
  const title = href
    ? `<a href="${esc(href)}" rel="noreferrer">${esc(v.title)}</a>`
    : esc(v.title);
  // The one place the dot trace is used, inside the one switch that turns it off.
  const trace = site.config.features?.vibeDotTrace ? vibeDotTrace(site, v) : '';
  // The year sits out in the margin where the Media page keeps its own, with the month beside it:
  // a project is remembered by the month it happened in, not by the day.
  return `<article class="vb">
<div class="d"><span class="dd"><span class="mo">${shortMonth(m)}</span> <span class="dn">${y}</span></span></div>
<div class="vb-body">
${frame(site, v)}
<h3 class="vb-title">${title}</h3>
<p class="vb-blurb">${esc(v.blurb)}</p>
${links(site, v)}
${trace}
</div>
</article>`;
}

/** Vibe: the small things AI helped me make, in the order they were made. A record, not a portfolio. */
export function vibe(site, items) {
  const style = site.config.features?.vibeDotTrace ? `<style>${VIBE_DOT_TRACE_CSS}</style>\n` : '';
  const body = items.length
    ? `${style}<h1 class="page-title">Vibe</h1>\n` + items.map((v) => card(site, v)).join('\n')
    : '<h1 class="page-title">Vibe</h1>\n<p class="quiet-note">Nothing made yet.</p>';
  return layout(site, { title: 'Vibe', current: 'vibe', cls: 'p-vibe', body, ribbon: false });
}
