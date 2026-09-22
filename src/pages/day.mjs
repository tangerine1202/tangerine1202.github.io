import { esc, ymd, monthName, weekday, fmtShort } from '../util.mjs';
import { layout, dot, ctxHref, ctxName, entryList, dayHref } from '../layout.mjs';

export function day(site, date) {
  const { model } = site;
  const { y, m, d } = ymd(date);
  const i = model.dates.indexOf(date);
  const prev = model.dates[i - 1];
  const next = model.dates[i + 1];

  const groups = model.dayGroups(date).map(({ c, entries }, k) =>
    `<section class="grp${c.uncategorized ? ' bare' : ''}" data-group="${c.id}"${c.uncategorized ? '' : ` data-ctx-path="${esc(ctxHref(site, c))}"`} style="--i:${k}">`
    + `<h2>${dot(c)}${ctxName(site, c)}</h2>${entryList(entries)}</section>`).join('');

  // With path-aware back links, the Day page gets one too; it points at Log until it knows better.
  // Where the day came from, when the visit gives nothing better (back.js rewrites this).
  const back = site.theme.pathBack ? `<a class="back" data-back href="${site.url('/log/')}">← Log</a>\n` : '';
  const body = `${back}<article class="sheet" data-date="${date}" data-span="${date}">
<span class="plate"></span>
<p class="sy label">${y}</p>
<h1 class="date"><span class="mo">${monthName(m)}</span> <span class="dn">${d}</span></h1>
<p class="wd label">${weekday(date)}</p>
<div class="groups">${groups}</div>
<nav class="pn" aria-label="Other days">
${prev ? `<a rel="prev" href="${dayHref(site, prev)}"><span class="arr">← </span><span class="pl">Before, </span>${fmtShort(prev)}</a>` : '<span></span>'}
${next ? `<a rel="next" href="${dayHref(site, next)}"><span class="pl">After, </span>${fmtShort(next)}<span class="arr"> →</span></a>` : '<span></span>'}
</nav>
</article>`;
  return layout(site, {
    title: `${monthName(m)} ${d}, ${y}`, backLabel: fmtShort(date), current: null, cls: 'p-day', body, ribbon: { span: [date] },
  });
}
