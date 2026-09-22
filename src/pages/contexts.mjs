import { esc, ymd, fmtShort, fmtLong, monthName } from '../util.mjs';
import { layout, dot, ctxHref, entryList, dateBlock, traceSvg, monthAxis } from '../layout.mjs';
import { weeksGrid } from '../weeks.mjs';

function linesOf(model, c) {
  return c.days.flatMap((d) => model.days.get(d).filter((e) => e.context === c.name));
}

const since = (model, date) =>
  date.slice(0, 4) === model.today.slice(0, 4) ? fmtShort(date) : `${fmtShort(date)}, ${date.slice(0, 4)}`;

/** Contexts (Things I've done): every context in order of first appearance. No ranking. */
export function contexts(site) {
  const { model } = site;
  const list = [...model.ctx.values()].sort((a, b) => a.days[0].localeCompare(b.days[0]) || a.rank - b.rank);
  const rows = list.map((c) => `<li><a href="${ctxHref(site, c)}" data-cid="${c.id}">${dot(c)}<span class="nm">${esc(c.label)}</span>`
    + `<span class="meta"><span class="n">${c.days.length} ${c.days.length === 1 ? 'day' : 'days'}</span> <span class="since">since ${since(model, c.days[0])}</span></span></a>`
    + '<p class="hits" hidden></p></li>').join('');

  // Only what is already public goes in here: private lines were dropped at parse time.
  const data = list.map((c) => ({
    name: c.label.toLowerCase(),
    lines: linesOf(model, c).flatMap((e) => [e.text, ...e.sub.map((s) => s.text)]).map((t) => t.toLowerCase()),
  }));
  const json = JSON.stringify(data).replace(/</g, '\\u003c');

  const body = `<h1 class="page-title">Things I’ve done</h1>
<div class="search"><input id="q" type="search" placeholder="Search contexts and what happened in them" autocomplete="off" aria-label="Search"></div>
<ul class="clist">${rows}</ul>
<p id="none" class="quiet-note" hidden>沒有符合的 context。</p>
<script type="application/json" id="search-data">${json}</script>
<script>
(() => {
  const data = JSON.parse(document.getElementById('search-data').textContent);
  const input = document.getElementById('q');
  const rows = [...document.querySelectorAll('.clist > li')];
  const none = document.getElementById('none');
  input.addEventListener('input', () => {
    const raw = input.value.trim();
    const q = raw.toLowerCase();
    let shown = 0;
    rows.forEach((li, i) => {
      const { name, lines } = data[i];
      const hits = li.querySelector('.hits');
      hits.hidden = true;
      let show = !q || name.includes(q);
      if (!show) {
        const n = lines.filter((l) => l.includes(q)).length;
        show = n > 0;
        if (show) { hits.textContent = n + ' 行提到『' + raw + '』'; hits.hidden = false; }
      }
      li.hidden = !show;
      if (show) shown++;
    });
    none.hidden = shown > 0;
  });
})();
</script>`;
  return layout(site, { title: 'Contexts', current: 'contexts', cls: 'p-contexts', body });
}

/** One context: when it appeared, its shape across each year, and every day it was there. */
export function contextPage(site, c) {
  const { model } = site;
  const first = c.days[0];
  const last = c.days.at(-1);
  const years = [...new Set(c.days.map((d) => Number(d.slice(0, 4))))].sort((a, b) => b - a);
  const present = new Set(c.days);
  // Either a 365-day dot grid per year (theme.contextGrid) or a distribution line per year.
  const traces = site.theme.contextGrid
    ? years.map((y, i) => `<div class="cgrid" style="--i:${i}"><span class="ty">${y}</span>`
      + `${weeksGrid(site, y, (d) => (present.has(d) ? c : null))}</div>`).join('')
    : years.map((y, i) => `<div class="trace" style="--i:${i}"><span class="ty">${y}</span><div>`
      + `${traceSvg(c.days.filter((d) => d.startsWith(`${y}-`)), y, c.color, model.today, { ridge: site.theme.yearRidge })}${monthAxis(y)}</div></div>`).join('');

  const months = new Map();
  for (const d of [...c.days].reverse()) {
    const key = d.slice(0, 7);
    if (!months.has(key)) months.set(key, []);
    months.get(key).push(d);
  }
  const list = [...months].map(([key, days]) => {
    const { y, m } = ymd(`${key}-01`);
    const rows = days.map((d) => `<div class="row" data-row="${d}" data-span="${d}">${dateBlock(site, d)}`
      + `${entryList(model.days.get(d).filter((e) => e.context === c.name))}</div>`).join('');
    return `<section class="cm"><h2 class="label">${monthName(m)} ${y}</h2>${rows}</section>`;
  }).join('');

  const body = `<a class="back" data-back href="${site.url('/contexts/')}">← Contexts</a>
<header class="ctx-head">${dot(c)}<h1 class="ctx-title">${esc(c.label)}</h1></header>
<dl class="facts">
<div><dt>First appeared</dt><dd>${fmtLong(first)}</dd></div>
<div><dt>Last seen</dt><dd>${fmtLong(last)}</dd></div>
<div><dt>Appeared on</dt><dd>${c.days.length} ${c.days.length === 1 ? 'day' : 'days'}</dd></div>
</dl>
<div class="traces">${traces}</div>
<div class="cdays">${list}</div>`;
  return layout(site, { title: c.label, current: 'contexts', cls: 'p-context', body, ribbon: { focus: c.id } });
}
