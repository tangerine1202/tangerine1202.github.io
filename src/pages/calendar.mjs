import { esc, iso, ymd, weekdayIndex, daysInMonth, monthName } from '../util.mjs';
import { layout, legend, dot, dayHref } from '../layout.mjs';

const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function cell(site, date) {
  const { model } = site;
  const { d } = ymd(date);
  if (model.days.has(date)) {
    const cs = model.dayContexts(date);
    return `<a class="cell has" href="${dayHref(site, date)}" data-vt-day="${date}" title="${esc(cs.map((c) => c.label).join(', '))}">`
      + `<span class="plate"></span><span class="n" data-vt-date>${d}</span><span class="dots">${cs.map((c) => dot(c)).join('')}</span></a>`;
  }
  return `<div class="cell${date > model.today ? ' future' : ''}"><span class="n">${d}</span></div>`;
}

function month(site, y, m) {
  const first = iso(y, m, 1);
  const blanks = '<div class="cell blank"></div>'.repeat(weekdayIndex(first));
  const cells = Array.from({ length: daysInMonth(y, m) }, (_, i) => cell(site, iso(y, m, i + 1))).join('');
  return `<section class="month" data-span="${first} ${iso(y, m, daysInMonth(y, m))}" data-back-label="${monthName(m)} ${y}">
<h2>${monthName(m)} <span>${y}</span></h2>
<div class="cal">${WD.map((w) => `<span class="wdh">${w}</span>`).join('')}${blanks}${cells}</div>
</section>`;
}

/** One year's months, newest first, between the first recorded month and today's month. */
export function monthsOfYear(site, year) {
  const { model } = site;
  const now = ymd(model.today);
  const start = model.dates.length ? ymd(model.dates[0]) : now;
  if (year > now.y || year < start.y) return [];
  const months = [];
  for (let m = year === now.y ? now.m : 12; m >= (year === start.y ? start.m : 1); m--) months.push(month(site, year, m));
  return months;
}

export function calendar(site) {
  const { model } = site;
  const now = ymd(model.today);
  const start = model.dates.length ? ymd(model.dates[0]) : now;
  const months = [];
  for (let y = now.y; y >= start.y; y--) months.push(...monthsOfYear(site, y));
  const body = `<h1 class="page-title">Calendar</h1>
${legend(site, model.byRank)}
<div class="months">${months.join('\n')}</div>`;
  return layout(site, {
    title: 'Calendar', current: 'calendar', cls: 'p-calendar', body,
    ribbon: { span: [iso(now.y, now.m, 1), iso(now.y, now.m, daysInMonth(now.y, now.m))] },
  });
}
