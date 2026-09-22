// Year Ridge: how densely one context ran, day by day. A moving window over a year of dates,
// drawn as the area under the ticks of a distribution line. Pure functions, no DOM, no HTML.
import { dayOfYear, daysInYear } from './util.mjs';

/**
 * One value per day of the year: recorded days within ±(window-1)/2 days, divided by the window.
 * 0 = nothing around that day, 1 = every day in the window was recorded.
 */
export function density(days, year, window = 7) {
  const total = daysInYear(year);
  const half = Math.floor(window / 2);
  const out = new Float32Array(total);
  for (const d of days) {
    if (!d.startsWith(`${year}-`)) continue;
    const i = dayOfYear(d);
    for (let k = Math.max(0, i - half); k <= Math.min(total - 1, i + half); k++) out[k] += 1 / window;
  }
  return out;
}

/**
 * The density as a closed area in the same 0..total × 0..h box as traceSvg: a baseline at the
 * bottom, one point per day up to `until` (today), back down and closed.
 */
export function ridgePath(dens, until, h = 10, peak = 9) {
  let d = `M0,${h}`;
  for (let i = 0; i < until && i < dens.length; i++) d += `L${i},${(h - dens[i] * peak).toFixed(2)}`;
  return `${d}L${until},${h}Z`;
}
