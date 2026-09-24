// Page frame and the small pieces every page shares.
// Markup stays theme-neutral (sentence case, no separators); each stylesheet decides casing and punctuation.
import { esc, ymd, iso, shortMonth, weekday, dayOfYear, daysInYear } from './util.mjs';
import { ribbon } from './ribbon.mjs';
import { density, ridgePath } from './ridge.mjs';

const NAV = [['year', 'Year'], ['calendar', 'Calendar'], ['contexts', 'Contexts'], ['log', 'Log']];
const MEDIA = ['media', 'Media']; // only for a theme that says `media: true`
const VIBE = ['project', 'Project']; // the projects from content/vibe/; only for a theme that says `vibe: true`
const ABOUT = ['about', 'About']; // only for a theme that says `about: true`

/**
 * `ribbon`: false = none, or { span: [from, to], focus: contextId }. Drawn only on the
 * pages listed in theme.ribbonOn.
 */
export function layout(site, { title, current, cls = '', body, ribbon: rb = {}, backLabel }) {
  const { url, theme, config } = site;
  const all = [...NAV, ...(theme.media ? [MEDIA] : []), ...(theme.vibe ? [VIBE] : []), ...(theme.about ? [ABOUT] : [])];
  // theme.nav is the list and the order; a section it names that the theme hasn't turned on is skipped.
  const sections = theme.nav ? theme.nav.map((key) => all.find(([k]) => k === key)).filter(Boolean) : all;
  const nav = sections.map(([key, label]) => {
    const on = key === current;
    return `<a href="${url(`/${key}/`)}"${on ? ' aria-current="page"' : ''}>${label}${on ? '<i class="mark"></i>' : ''}</a>`;
  }).join('');
  const withRibbon = rb !== false && (theme.ribbonOn ?? []).includes(current);
  const fonts = theme.fonts
    ? `<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="${theme.fonts}">\n`
    : '';
  const motion = site.motion
    ? `<link rel="stylesheet" href="${url('/motion.css')}">\n${site.scripts.map((s) => `<script>${s}</script>`).join('\n')}\n`
    : '';
  const extraCss = (theme.extraCss ?? []).map((f) => `<link rel="stylesheet" href="${url(`/${f}`)}">\n`).join('');
  // The two greys (other / uncategorized) are on <html> for every theme: focus.js needs to know
  // which contexts have no colour of their own, and an attribute nobody styles changes nothing.
  const grey = ` data-grey="${esc(`${config.other} ${config.uncategorized}`)}"`;
  const now = theme.nowAccent && site.model.now ? site.model.now : null;
  const accent = now ? ` style="--now:${now.color}" data-now="${now.id}"` : '';
  return `<!doctype html>
<html lang="zh-Hant"${grey}${accent}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title ? `${title} — Meanwhile` : 'Meanwhile')}</title>
${fonts}<link rel="stylesheet" href="${url('/style.css')}">
${motion}${extraCss}</head>
<body class="${cls}${withRibbon ? ' has-ribbon' : ''}" data-back-label="${esc(backLabel ?? title ?? 'Home')}">
<header class="top wrap"><a class="brand" href="${url('/')}">Meanwhile</a><nav class="nav" aria-label="Sections">${nav}</nav></header>
<main class="wrap">
${body}
</main>
<footer class="foot wrap"><p>This is not a record of how productive I was.<br>It’s a record that I was here.</p></footer>
${withRibbon ? ribbon(site, rb) : ''}
</body>
</html>
`;
}

export const dayHref = (site, date) => site.url(`/d/${date}/`);
export const ctxHref = (site, c) => site.url(`/c/${c.slug}/`);

export function dot(c, extra = '') {
  return `<span class="dot" style="--c:${c.color}" data-cid="${c.id}"${extra}></span>`;
}

/** Context name as a link; Uncategorized gets no name, only its dot elsewhere. */
export function ctxName(site, c) {
  return c.uncategorized ? '' : `<a class="cn" href="${ctxHref(site, c)}" data-cid="${c.id}" style="--c:${c.color}">${esc(c.label)}</a>`;
}

/** The colours used on a page, so dots are never the only way to tell contexts apart. */
export function legend(site, contexts) {
  const items = [];
  let other = false;
  for (const c of contexts) {
    if (c.configured || c.uncategorized) {
      items.push(`<a href="${ctxHref(site, c)}" data-focus="${c.id}">${dot(c)}<span class="nm">${esc(c.label)}</span></a>`);
    } else other = true;
  }
  if (other) {
    const at = items.length - (contexts.some((c) => c.uncategorized) ? 1 : 0);
    items.splice(at, 0, `<span><span class="dot" style="--c:${site.config.other}"></span>Other</span>`);
  }
  return `<div class="legend">${items.join('')}</div>`;
}

export function entryList(entries) {
  const items = entries
    .filter((e) => e.text || e.sub.length)
    .map((e) => {
      const sub = e.sub.length
        ? `<ul class="sub">${e.sub.map((s) => `<li style="--d:${s.depth}">${esc(s.text)}</li>`).join('')}</ul>`
        : '';
      return `<li>${esc(e.text)}${sub}</li>`;
    });
  return `<ul class="ents">${items.join('')}</ul>`;
}

/** Date + weekday + that day's dots, linking to the Day. A Cell → Page source. */
export function dateBlock(site, date) {
  const { m, d } = ymd(date);
  const dots = site.model.dayContexts(date).map((c) => dot(c)).join('');
  return `<a class="d" href="${dayHref(site, date)}" data-vt-day="${date}"><span class="plate"></span>`
    + `<span class="dd"><span class="mo">${shortMonth(m)}</span> <span class="dn" data-vt-date>${d}</span></span>`
    + `<span class="wd">${weekday(date)}</span><span class="dots">${dots}</span></a>`;
}

/**
 * A year of one context as ticks: one 1-unit line per day. Shared by Year and Context pages.
 * `ridge`: also draw the 7-day density, so dense stretches read as hills.
 * `ticks`: false leaves the ridge alone in the box — it is then the line itself, in full colour,
 * standing on a baseline that drops to the bottom of the box for it to stand on.
 */
export function traceSvg(days, year, color, today, { ridge = false, ticks = true } = {}) {
  const total = daysInYear(year);
  const ty = Number(today.slice(0, 4));
  const until = year < ty ? total : year > ty ? 0 : dayOfYear(today) + 1;
  const tickPath = days.map((d) => `M${dayOfYear(d)} 0h1v10h-1z`).join('');
  // Ticks hang from the top, so their line sits mid-box; hills stand on the floor.
  const [baseY, lineY] = ticks ? [4.6, 5] : [9.2, 9.6];
  // The future part is a separate line so a theme can draw it (dashed) or hide it.
  // non-scaling-stroke keeps the dashes even though the SVG is stretched horizontally.
  return `<svg viewBox="0 0 ${total} 10" preserveAspectRatio="none" aria-hidden="true">`
    + (until ? `<rect class="base" x="0" y="${baseY}" width="${until}" height=".8"/>` : '')
    + (until < total ? `<line class="future" x1="${until}" y1="${lineY}" x2="${total}" y2="${lineY}" vector-effect="non-scaling-stroke"/>` : '')
    // Before the ticks, so the ticks stay readable on top of it.
    + (ridge && until ? `<path class="ridge" d="${ridgePath(density(days, year), until)}" fill="${color}"${ticks ? ' fill-opacity=".28"' : ''}/>` : '')
    + (ticks ? `<path d="${tickPath}" fill="${color}"/>` : '') + '</svg>';
}

export function monthAxis(year) {
  const labels = Array.from({ length: 12 }, (_, i) => {
    const left = (dayOfYear(iso(year, i + 1, 1)) / daysInYear(year)) * 100;
    return `<span${i % 2 ? ' class="odd"' : ''} style="left:${left.toFixed(2)}%">${shortMonth(i + 1)}</span>`;
  });
  return `<div class="axis" aria-hidden="true">${labels.join('')}</div>`;
}
