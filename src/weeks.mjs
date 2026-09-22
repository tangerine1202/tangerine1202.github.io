// A year as dots: 7 rows (Mon–Sun) × ~53 weeks. `pick(date)` returns the context that colours a
// recorded day, or null to leave it empty. Year page: the day's dominant context. Context page: that context.
import { esc, iso, addDays, weekdayIndex, dayOfYear, fmtLong, shortMonth } from './util.mjs';
import { dayHref } from './layout.mjs';

export function weeksGrid(site, year, pick) {
  const { model } = site;
  const jan1 = iso(year, 1, 1);
  const offset = weekdayIndex(jan1);
  const start = addDays(jan1, -offset);
  const weeks = Math.ceil((dayOfYear(iso(year, 12, 31)) + offset + 1) / 7);
  const cells = [];
  for (let w = 0; w < weeks; w++) {
    for (let r = 0; r < 7; r++) {
      const date = addDays(start, w * 7 + r);
      const c = model.days.has(date) ? pick(date) : null;
      if (!date.startsWith(`${year}-`)) cells.push('<span class="cell out"></span>');
      else if (date > model.today) cells.push(`<span class="cell future" style="--w:${w}"></span>`);
      else if (c) {
        const all = model.dayContexts(date);
        const names = all.map((x) => x.label).join(', ');
        // data-cid is the colour shown; data-cids is every context of that day, so focusing one
        // can pick out days where it was not the dominant one.
        const cids = all.map((x) => x.id).join(' ');
        cells.push(`<a class="cell has plate" href="${dayHref(site, date)}" data-vt-day="${date}" data-cid="${c.id}" data-cids="${cids}" style="--c:${c.color};--w:${w}" title="${esc(`${fmtLong(date)}: ${names}`)}" aria-label="${esc(fmtLong(date))}"></a>`);
      } else cells.push(`<span class="cell" style="--w:${w}"></span>`);
    }
  }
  const months = Array.from({ length: 12 }, (_, i) => {
    const w = Math.floor((dayOfYear(iso(year, i + 1, 1)) + offset) / 7);
    return `<span style="--w:${w}">${shortMonth(i + 1)}</span>`;
  }).join('');
  return `<div class="weeks-wrap"><div class="weeks-months" aria-hidden="true">${months}</div><div class="weeks">${cells.join('')}</div></div>`;
}
