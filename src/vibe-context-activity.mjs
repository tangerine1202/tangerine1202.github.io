// Part of the Vibe dot trace, which is removable in one step — see the README, "Removing the Vibe
// dot trace". Nothing else in the site imports this file.
// It reads the finished model and only that: no parsing, no page's data structure, nothing added
// to a shared util.
import { addDays } from './util.mjs';

/**
 * One entry per day of the last `days` days, oldest first, each marked whether the context was
 * there. `null` when the project names no context, when nobody has recorded that context, or
 * when it was quiet for the whole window — all three mean: draw nothing.
 */
export function vibeContextActivity(model, name, days = 90) {
  if (!name) return null;
  const c = model.ctx.get(name);
  if (!c) return null;
  const from = addDays(model.today, -(days - 1));
  const on = new Set(c.days.filter((d) => d >= from && d <= model.today));
  if (!on.size) return null;
  return {
    c,
    from,
    to: model.today,
    count: on.size,
    days: Array.from({ length: days }, (_, i) => {
      const date = addDays(from, i);
      return { date, on: on.has(date) };
    }),
  };
}
