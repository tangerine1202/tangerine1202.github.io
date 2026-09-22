// Parsed days → everything the pages need. Pages never read the raw log.
import { todayIn } from './util.mjs';

export const UNCATEGORIZED = '(uncategorized)';

export function slugify(name) {
  return name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'context';
}

function makeContext(name, index, config, usedSlugs) {
  const uncategorized = name === UNCATEGORIZED;
  const base = slugify(uncategorized ? 'uncategorized' : name);
  let slug = base;
  for (let n = 2; usedSlugs.has(slug); n++) slug = `${base}-${n}`;
  usedSlugs.add(slug);
  return {
    id: `c${index}`,
    name,
    slug,
    label: uncategorized ? 'Uncategorized' : name,
    color: config.colors[name] ?? (uncategorized ? config.uncategorized : config.other),
    configured: name in config.colors,
    uncategorized,
    rank: 0,
    days: [],
    lines: 0,
  };
}

/**
 * The context of the last 14 recorded days, by number of lines; ties go to the lower rank.
 * Uncategorized is skipped: it says nothing about what I was doing. `null` when there is no data.
 */
function mainContext(dates, days, ctx) {
  const lines = new Map();
  for (const date of dates.slice(-14)) {
    for (const e of days.get(date)) {
      const c = ctx.get(e.context);
      if (c.uncategorized) continue;
      lines.set(c, (lines.get(c) ?? 0) + 1);
    }
  }
  let best = null;
  for (const [c, n] of lines) {
    if (!best || n > lines.get(best) || (n === lines.get(best) && c.rank < best.rank)) best = c;
  }
  return best;
}

export function buildModel(parsed, config) {
  const today = config.today ?? todayIn(config.timeZone);

  const days = new Map();
  for (const day of parsed.days) {
    if (!day.entries.length) continue;
    days.set(day.date, day.entries.map((e) => ({ ...e, context: e.context ?? UNCATEGORIZED })));
  }
  const dates = [...days.keys()].sort();

  const ctx = new Map();
  const usedSlugs = new Set();
  for (const date of dates) {
    for (const e of days.get(date)) {
      if (!ctx.has(e.context)) ctx.set(e.context, makeContext(e.context, ctx.size, config, usedSlugs));
      const c = ctx.get(e.context);
      if (c.days.at(-1) !== date) c.days.push(date);
      c.lines += 1;
    }
  }

  const order = Object.keys(config.colors);
  const tier = (c) => (c.uncategorized ? 2 : c.configured ? 0 : 1);
  const byRank = [...ctx.values()].sort((a, b) =>
    tier(a) - tier(b)
    || (tier(a) === 0 ? order.indexOf(a.name) - order.indexOf(b.name) : a.name.localeCompare(b.name)));
  byRank.forEach((c, i) => { c.rank = i; });

  const dayContexts = (date) =>
    [...new Set((days.get(date) ?? []).map((e) => e.context))].map((n) => ctx.get(n)).sort((a, b) => a.rank - b.rank);

  const dayGroups = (date) => {
    const groups = new Map();
    for (const e of days.get(date) ?? []) {
      if (!groups.has(e.context)) groups.set(e.context, { c: ctx.get(e.context), entries: [] });
      groups.get(e.context).entries.push(e);
    }
    return [...groups.values()];
  };

  const dominant = (date) => {
    const groups = dayGroups(date);
    if (!groups.length) return null;
    return groups.reduce((best, g) =>
      g.entries.length > best.entries.length || (g.entries.length === best.entries.length && g.c.rank < best.c.rank) ? g : best).c;
  };

  const years = [...new Set([...dates.map((d) => Number(d.slice(0, 4))), Number(today.slice(0, 4))])].sort((a, b) => b - a);

  const now = mainContext(dates, days, ctx);

  return { today, days, dates, ctx, byRank, dayContexts, dayGroups, dominant, years, now };
}
