import { ymd, monthName } from '../util.mjs';
import { layout, legend, ctxName, entryList, dateBlock } from '../layout.mjs';

/**
 * Days as month sections, newest first: the log's own shape. The Log page is all of them;
 * a Year section (theme.logInYear) asks for one year at a time. `newest` is the month at the
 * top, which is what the ribbon's bracket covers before any script runs.
 */
export function logMonths(site, dates) {
  const sections = monthSections(site, dates);
  return { html: sections.map((s) => s.html).join('\n'), newest: sections[0]?.days ?? [] };
}

/**
 * The same month sections, gathered into chunks of at least `size` days, whole months only, newest
 * first: the Log shows the first and fetches the rest as the reader scrolls (more.js).
 */
export function logChunks(site, dates, size = 30) {
  const chunks = [];
  let open = null;
  for (const s of monthSections(site, dates)) {
    if (!open || open.days >= size) chunks.push((open = { html: [], days: 0 }));
    open.html.push(s.html);
    open.days += s.days.length;
  }
  return chunks.map((c) => c.html.join('\n'));
}

function monthSections(site, dates) {
  const { model } = site;
  const months = new Map();
  for (const d of [...dates].reverse()) {
    const key = d.slice(0, 7);
    if (!months.has(key)) months.set(key, []);
    months.get(key).push(d);
  }
  return [...months].map(([key, days]) => {
    const { y, m } = ymd(`${key}-01`);
    const rows = days.map((d) => {
      const groups = model.dayGroups(d).map(({ c, entries }) =>
        `<div class="lg-grp${c.uncategorized ? ' bare' : ''}" data-group="${c.id}" style="--c:${c.color}">${c.uncategorized ? '' : `<h3>${ctxName(site, c)}</h3>`}${entryList(entries)}</div>`).join('');
      return `<div class="lday" data-span="${d}">${dateBlock(site, d)}<div class="lgroups">${groups}</div></div>`;
    }).join('');
    return { days, html: `<section class="lmonth"><h2 class="label">${monthName(m)} ${y}</h2>${rows}</section>` };
  });
}

export function log(site) {
  const { model } = site;
  const { html, newest } = logMonths(site, model.dates);
  const body = `<h1 class="page-title">Log</h1>
${legend(site, model.byRank)}
${html}`;
  const ribbon = newest.length ? { span: [newest.at(-1), newest[0]] } : {};
  return layout(site, { title: 'Log', current: 'log', cls: 'p-log', body, ribbon });
}
