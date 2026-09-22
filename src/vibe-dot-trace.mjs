// The Vibe dot trace: the last 90 days of a project's context, one dot per day.
// Experimental, and removable in one step — see the README, "Removing the Vibe dot trace".
// Its styles live here, in the string below, so nothing about it is left in almanac.css or in
// any shared token. Only src/pages/vibe.mjs imports this file.
import { esc } from './util.mjs';
import { ctxHref } from './layout.mjs';
import { vibeContextActivity } from './vibe-context-activity.mjs';

const DAYS = 90;

/**
 * The whole line links to the context's own page: on this site that page *is* the log filtered to
 * one context — every day it appeared, in the log's own shape. `''` when there is nothing to draw,
 * so a project without a context ends at its links.
 */
export function vibeDotTrace(site, v) {
  const a = vibeContextActivity(site.model, v.context, DAYS);
  if (!a) return '';
  const label = `${a.c.label} · ${a.count} ${a.count === 1 ? 'day' : 'days'} in the last ${DAYS}`;
  const dots = a.days.map((d) => `<i${d.on ? ' class="on"' : ''}></i>`).join('');
  return `<a class="vibe-dot-trace" href="${ctxHref(site, a.c)}" data-cid="${a.c.id}" style="--c:${a.c.color}" aria-label="${esc(label)}">${dots}</a>`;
}

export const VIBE_DOT_TRACE_CSS = `
.vibe-dot-trace {
  display: grid; grid-template-columns: repeat(${DAYS}, minmax(0, 1fr)); align-items: center;
  gap: 1px; height: 8px; width: 100%; margin-top: 16px;
}
.vibe-dot-trace i {
  display: block; width: min(6px, 100%); aspect-ratio: 1; margin-inline: auto;
  border-radius: 50%; background: var(--empty);
}
.vibe-dot-trace i.on { background: var(--c); }
/* Looking at the line grows the days that are in it — the same move the play layer makes when a
   context comes into focus, so the two read as one idea. */
.vibe-dot-trace:hover i.on { transform: scale(1.5); }
@media (prefers-reduced-motion: no-preference) {
  .vibe-dot-trace i { transition: transform .22s var(--ease, cubic-bezier(.22, .8, .24, 1)); }
}
`.trim();
