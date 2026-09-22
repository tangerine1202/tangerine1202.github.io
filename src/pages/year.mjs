import { esc } from '../util.mjs';
import { layout, legend, dot, ctxHref, traceSvg, monthAxis } from '../layout.mjs';
import { weeksGrid } from '../weeks.mjs';
import { monthsOfYear } from './calendar.mjs';
import { logMonths } from './log.mjs';

/** Configured contexts → others with enough days → Other (N) → Uncategorized. */
function lanesFor(site, year) {
  const { model, config } = site;
  const inYear = new Map();
  for (const date of model.dates) {
    if (!date.startsWith(`${year}-`)) continue;
    for (const c of model.dayContexts(date)) {
      if (!inYear.has(c)) inYear.set(c, []);
      inYear.get(c).push(date);
    }
  }
  const lanes = [];
  const other = { days: new Set(), count: 0 };
  let uncategorized = null;
  for (const c of model.byRank) {
    const days = inYear.get(c);
    if (!days) continue;
    if (c.uncategorized) uncategorized = { c, days };
    else if (c.configured || days.length >= config.laneMinDays) lanes.push({ c, days });
    else {
      days.forEach((d) => other.days.add(d));
      other.count += 1;
    }
  }
  if (other.count) lanes.push({ label: `Other (${other.count})`, color: config.other, days: [...other.days].sort() });
  if (uncategorized) lanes.push(uncategorized);
  return { lanes, contexts: [...inYear.keys()].sort((a, b) => a.rank - b.rank) };
}

function lane(site, l, i, year) {
  const color = l.c ? l.c.color : l.color;
  const label = l.c
    ? `<a class="lab" href="${ctxHref(site, l.c)}" data-focus="${l.c.id}">${dot(l.c)}<span class="nm">${esc(l.c.label)}</span></a>`
    : `<span class="lab"><span class="dot" style="--c:${color}"></span><span class="nm">${esc(l.label)}</span></span>`;
  // With the ridge on, the hills are the line: no ticks over them.
  const trace = traceSvg(l.days, year, color, site.model.today, { ridge: site.theme.yearRidge, ticks: !site.theme.yearRidge });
  return `<div class="lane" style="--i:${i}"${l.c ? ` data-cid="${l.c.id}"` : ''}>${label}${trace}</div>`;
}

export function year(site) {
  const { model, theme } = site;
  const sections = model.years.map((y) => {
    const { lanes, contexts } = lanesFor(site, y);
    // The whole-year bracket belongs to the lanes alone: with the log underneath, the day rows
    // carry their own spans, and a span around all of them would hold the bracket open all year.
    const span = ` data-span="${y}-01-01 ${y}-12-31"`;
    // The lane names already carry each colour and link to the context, so a theme may drop the legend.
    const top = lanes.length
      ? `<div class="lanes"${span}><div class="lane axis-row"><span></span>${monthAxis(y)}</div>${lanes.map((l, i) => lane(site, l, i, y)).join('')}</div>`
        + (theme.yearLegend === false ? '' : legend(site, contexts))
      : '<p class="quiet-note">Nothing recorded this year yet.</p>';
    const grid = theme.yearGrid === false ? '' : `<p class="label">365 days</p>\n${weeksGrid(site, y, (d) => model.dominant(d))}`;
    const months = theme.calendarInYear && theme.yearMonths !== false ? `<div class="months">${monthsOfYear(site, y).join('\n')}</div>` : '';
    // The log is not a page of its own here: each year keeps its own days, under its own lanes.
    // No tag over them — the month names are tag enough.
    const days = theme.logInYear ? logMonths(site, model.dates.filter((d) => d.startsWith(`${y}-`))).html : '';
    return `<section class="yr-sec"${theme.logInYear ? '' : span} data-back-label="${y}">
<h1 class="yr">${y}</h1>
<p class="label">My life, by context</p>
${top}
${grid}
${months}
${days}
</section>`;
  });
  const first = model.years[0];
  return layout(site, {
    // With every day under it, this page is the log: it says so, and it answers at /log/.
    // The styling stays the Year's (`p-year`), because that is still its shape.
    title: theme.logInYear ? 'Log' : 'Year', current: theme.logInYear ? 'log' : 'year',
    cls: 'p-year', body: sections.join('\n'),
    ribbon: { span: [`${first}-01-01`, `${first}-12-31`] },
  });
}
