import { esc } from '../util.mjs';
import { layout } from '../layout.mjs';
import { photoName } from '../photos.mjs';
import { prose } from './home.mjs';
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
  if (!site.hasPhoto(v.image)) return `<div class="vb-frame ph"><span class="ph-label">Image</span></div>`;
  const src = site.url(`/photos/${encodeURI(photoName(v.image))}`);
  if (/\.mp4$/i.test(v.image)) {
    return `<div class="vb-frame"><video src="${src}" aria-label="${esc(v.alt)}" muted autoplay loop playsinline></video></div>`;
  }
  return `<div class="vb-frame"><img src="${src}" alt="${esc(v.alt)}" loading="lazy" decoding="async"></div>`;
}

function links(site, v) {
  if (!v.links.length) return '';
  const c = v.context && site.model.ctx.get(v.context);
  const items = [...v.links]
    .sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type))
    .map((l) => `<a class="lk" href="${esc(l.url)}" rel="noreferrer"${c ? ` data-cid="${c.id}"` : ''} style="--c:${c ? c.color : 'var(--pencil)'}">${LINKS[l.type]}</a>`);
  return `<p class="vb-links">${items.join('<span class="sep">·</span>')}</p>`;
}

// Each project is a row in the Log's shape: its year out in the margin, with what kind of project it is
// where the Log keeps the weekday; then the title, words and links, and the picture beside them.
function card(site, v) {
  // A project with its own page (content/page/) leads there; otherwise to its first link.
  const title = v.page
    ? `<a href="${site.url(`/project/${encodeURI(v.page)}/`)}">${esc(v.title)}</a>`
    : titleHref(v.links)
      ? `<a href="${esc(titleHref(v.links))}" rel="noreferrer">${esc(v.title)}</a>`
      : esc(v.title);
  // The one place the dot trace is used, inside the one switch that turns it off.
  const trace = site.config.features?.vibeDotTrace ? vibeDotTrace(site, v) : '';
  return `<article class="post vb">
<div class="d"><span class="dd"><span class="dn">${v.date.slice(0, 4)}</span></span><span class="wd">${esc(v.kind)}</span></div>
<div class="vb-main">
<div class="text">
<h2 class="title">${title}</h2>
<div class="prose">${prose(site, v.description ?? v.blurb, v.date)}</div>
${links(site, v)}
${trace}
</div>
<div class="photos">${frame(site, v)}</div>
</div>
</article>`;
}

/** Project: the small things I made, in the order they were made. A record, not a portfolio. */
export function vibe(site, items) {
  const style = site.config.features?.vibeDotTrace ? `<style>${VIBE_DOT_TRACE_CSS}</style>\n` : '';
  const body = items.length
    ? `${style}<h1 class="page-title">Project</h1>\n` + items.map((v) => card(site, v)).join('\n')
    : '<h1 class="page-title">Project</h1>\n<p class="quiet-note">Nothing made yet.</p>';
  return layout(site, { title: 'Project', current: 'project', cls: 'p-vibe', body, ribbon: false });
}
