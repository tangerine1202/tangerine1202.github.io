// The ribbon (Almanac theme): every recorded day as a column of its dots, from Jan 1 of the first
// year to Dec 31 of this year. A bracket marks the days the current page is showing.
import { esc, iso, fmtLong, daysInYear, daysBetween } from './util.mjs';

export function ribbonRange(model) {
  const start = iso(model.years.at(-1), 1, 1);
  const total = model.years.reduce((n, y) => n + daysInYear(y), 0);
  return { start, total };
}

/** Left offset and width (in % of the ribbon) for the days from..to, inclusive. */
export function spanPercent(range, from, to = from) {
  const a = daysBetween(range.start, from);
  const b = daysBetween(range.start, to) + 1;
  return { left: (a / range.total) * 100, width: ((b - a) / range.total) * 100 };
}

const pct = (n) => `${n.toFixed(3)}%`;

export function ribbon(site, { span = null, focus = null } = {}) {
  const { model } = site;
  const range = ribbonRange(model);
  const col = (d) => daysBetween(range.start, d) + 1;

  const cols = model.dates.map((d) => {
    const dots = model.dayContexts(d)
      .map((c) => `<b style="--c:${c.color}" data-cid="${c.id}"${c.id === focus ? ' class="on"' : ''}></b>`).join('');
    return `<a class="rc" href="${site.url(`/d/${d}/`)}" tabindex="-1" style="grid-column:${col(d)}" title="${esc(fmtLong(d))}">${dots}</a>`;
  }).join('');

  const years = [...model.years].reverse()
    .map((y) => `<span class="rb-y" style="left:${pct(spanPercent(range, iso(y, 1, 1)).left)}">${y}</span>`).join('');
  const past = spanPercent(range, range.start, model.today);
  const win = span
    ? (({ left, width }) => `<i class="rb-window" style="left:${pct(left)};width:${pct(width)}"></i>`)(spanPercent(range, ...span))
    : '<i class="rb-window" hidden></i>';

  return `<div class="ribbon${focus ? ' focus' : ''}" aria-hidden="true" data-start="${range.start}" data-total="${range.total}">`
    + `<div class="rb-in">${years}<div class="rb-track"><i class="rb-past" style="width:${pct(past.width)}"></i>`
    + `<div class="rb-cols" style="--n:${range.total}">${cols}</div>${win}</div></div></div>`;
}
