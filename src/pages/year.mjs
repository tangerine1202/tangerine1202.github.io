import { esc } from '../util.mjs';
import { layout, legend, dot, ctxHref, traceSvg, monthAxis } from '../layout.mjs';
import { weeksGrid } from '../weeks.mjs';
import { monthsOfYear } from './calendar.mjs';
import { logMonths, logChunks } from './log.mjs';

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

/**
 * The Log's days, a year at a time, split for loading as the reader scrolls: the newest year shows
 * its first chunk in the page, and every other chunk is a file beside it (log/days-<year>-<n>.html)
 * that more.js fetches when the skeleton at the end of the days comes near the screen.
 */
export function logParts(site) {
  return site.model.years.map((y, i) => {
    const chunks = logChunks(site, site.model.dates.filter((d) => d.startsWith(`${y}-`)), 20);
    const inline = i === 0 ? chunks.shift() ?? '' : '';
    return { year: y, inline, files: chunks.map((html, n) => ({ name: `days-${y}-${n + 1}.html`, html })) };
  });
}

// Grey rows in the shape of a day, where the next days will be; more.js removes it after the last.
function skeleton(files) {
  const row = '<div class="lday sk-day" aria-hidden="true"><div class="d"><i class="sk sk-n"></i><i class="sk sk-w"></i></div>'
    + '<div class="lgroups"><i class="sk sk-h"></i><i class="sk sk-l"></i><i class="sk sk-l short"></i></div></div>';
  return `<div class="log-more" data-chunks="${files.map((f) => f.name).join(' ')}" role="status" aria-label="Loading older days">${row.repeat(3)}</div>`
    + '<noscript><p class="quiet-note">Older days need JavaScript to load.</p></noscript>';
}

export function year(site) {
  const { model, theme } = site;
  const parts = site.theme.lazyLog ? logParts(site) : [];
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
    const part = theme.logInYear && site.theme.lazyLog ? parts.find((p) => p.year === y) : null;
    const days = theme.logDays === false ? ''
      : part ? part.inline + (part.files.length ? skeleton(part.files) : '')
      : theme.logInYear ? logMonths(site, model.dates.filter((d) => d.startsWith(`${y}-`))).html : '';
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
