// content/log.json: the data the site's log is built from, one flat list of entries.
//   { entries: [{ id, date, context, text, sub: [{ text, depth }], source, imported }] }
// Each entry names its source. A source that is imported from a markdown log (the daily log is one,
// as "daily-log") is replaced whole on every import, so its entries are read-only here: they are
// edited in the log itself. Everything else (source "manual", or any name) is added, edited and
// removed here, and no import ever touches it.
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { parse, plain } from './parse.mjs';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SOURCE = /^[a-z0-9][a-z0-9-]*$/;

export function load(file) {
  if (!fs.existsSync(file)) return { entries: [] };
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(data.entries)) throw new Error(`${file}: expected { "entries": [...] }`);
  return data;
}

/** Written whole and then moved into place, so a reader (the build) never sees half a file. */
export function save(file, data) {
  const tmp = `${file}.tmp`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(tmp, `${JSON.stringify({ entries: sorted(data.entries) }, null, 1)}\n`);
  fs.renameSync(tmp, file);
}

// By date, and within a day in the order the entries were written or added (a stable sort).
const sorted = (entries) => [...entries].sort((a, b) => a.date.localeCompare(b.date));

/**
 * A markdown log (the daily log's format) as the entries of one source, replacing that source's
 * entries and leaving every other source alone. `config` is the site's, so its rules apply as they
 * always have: #private lines and private contexts are left out, and mapEntry runs.
 */
export function importLog(data, source, text, config) {
  if (!SOURCE.test(source)) throw new Error(`source must be lowercase letters, digits and dashes (got "${source}")`);
  const parsed = parse(text, config);
  const fresh = [];
  for (const day of parsed.days) {
    day.entries.forEach((e, n) => fresh.push({
      id: `${source}:${day.date}:${n + 1}`, date: day.date, context: e.context, text: e.text, sub: e.sub, source, imported: true,
    }));
  }
  const kept = data.entries.filter((e) => e.source !== source);
  const before = data.entries.length - kept.length;
  return { data: { entries: [...kept, ...fresh] }, before, after: fresh.length, warnings: parsed.warnings };
}

/** An entry as the user gives it, checked; `id` and the rest come from here, not from the request. */
function clean(input) {
  const date = String(input.date ?? '').trim();
  const text = String(input.text ?? '').trim();
  const context = String(input.context ?? '').trim() || null;
  const source = String(input.source ?? 'manual').trim() || 'manual';
  if (!DATE.test(date) || Number.isNaN(Date.parse(date))) throw new Error(`date must be YYYY-MM-DD (got "${date}")`);
  if (!text) throw new Error('text is empty');
  if (!SOURCE.test(source)) throw new Error(`source must be lowercase letters, digits and dashes (got "${source}")`);
  return { date, context, text, source };
}

function editable(data, id) {
  const e = data.entries.find((x) => x.id === id);
  if (!e) throw new Error(`no entry "${id}"`);
  if (e.imported) throw new Error(`"${id}" comes from the ${e.source} import; edit it there`);
  if (importedSources(data).has(e.source)) throw new Error(`"${e.source}" is an imported source; edit it there`);
  return e;
}

const importedSources = (data) => new Set(data.entries.filter((e) => e.imported).map((e) => e.source));

export function addEntry(data, input) {
  const e = clean(input);
  if (importedSources(data).has(e.source)) throw new Error(`"${e.source}" is an imported source; add to it there`);
  const entry = { id: randomUUID().slice(0, 8), ...e, sub: [] };
  return { data: { entries: [...data.entries, entry] }, entry };
}

export function updateEntry(data, id, input) {
  const old = editable(data, id);
  const e = clean({ ...old, ...input });
  if (e.source !== old.source && importedSources(data).has(e.source)) throw new Error(`"${e.source}" is an imported source`);
  const entry = { ...old, ...e };
  return { data: { entries: data.entries.map((x) => (x.id === id ? entry : x)) }, entry };
}

export function removeEntry(data, id) {
  editable(data, id);
  return { data: { entries: data.entries.filter((x) => x.id !== id) } };
}

/** The shape the model is built from, the same one parse() gives: days in date order, each with its entries. */
export function toParsed(data, config) {
  const byDate = new Map();
  for (const e of sorted(data.entries)) {
    if (e.context && config.privateContexts?.includes(e.context)) continue;
    if (!byDate.has(e.date)) byDate.set(e.date, { date: e.date, entries: [] });
    // Imported text is already plain; what was typed here gets the same treatment ([[links]] → words).
    byDate.get(e.date).entries.push({ context: e.context ?? null, text: e.imported ? e.text : plain(e.text), sub: e.sub ?? [] });
  }
  return { days: [...byDate.values()], warnings: [] };
}
