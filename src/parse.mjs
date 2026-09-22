// daily-log.md → { days: [{ date, entries: [{ context, text, sub }] }], warnings }

const DATE_HEADING = /^#{1,6}\s+(\d{4}-\d{2}-\d{2})\b/;
const HEADING = /^#{1,6}\s/;
const ITEM = /^([ \t]*)[-*+]\s+(.*)$/;
const LEAD_LINK = /^\[\[([^\]|]+)(?:\|[^\]]*)?\]\]\s*:?\s*/;

const indentWidth = (s) => [...s].reduce((n, ch) => n + (ch === '\t' ? 4 : 1), 0);

/** Obsidian markup → the plain text shown on the site. */
export function plain(s, warn) {
  let out = s
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\[([^\]]+)\]\([^)\s]*\)/g, '$1');
  if (out.includes('[[')) {
    warn?.('unclosed [[ (shown as text)');
    out = out.replaceAll('[[', '');
  }
  return out
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\*\*|`|📖/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toEntry(raw, config, warn) {
  const s = raw.replace(/^\[[ xX]\]\s+/, '').replace(/^(?:[-*]\s+)+/, '');
  const lead = s.match(LEAD_LINK);
  let e = { context: lead ? lead[1].trim() : null, text: lead ? s.slice(lead[0].length) : s, sub: [] };
  if (config.mapEntry) {
    e = config.mapEntry(e);
    if (!e) return null;
  }
  if (e.context && config.privateContexts.includes(e.context)) return null;
  return { context: e.context, text: plain(e.text, warn), sub: e.sub ?? [] };
}

export function parse(text, config) {
  const byDate = new Map();
  const warnings = [];
  let day = null;
  let entry = null;
  let skipDeeperThan = null; // indent of a dropped line; its children are dropped too
  let indents = [];

  text.split(/\r?\n/).forEach((line, i) => {
    const warn = (msg) => warnings.push(`line ${i + 1}: ${msg}`);
    if (!line.trim()) return;

    const heading = line.match(DATE_HEADING);
    if (heading) {
      const date = heading[1];
      if (!byDate.has(date)) byDate.set(date, { date, entries: [] });
      day = byDate.get(date);
      entry = null;
      skipDeeperThan = null;
      return;
    }
    if (HEADING.test(line)) {
      day = null;
      return;
    }
    if (!day) return;

    const item = line.match(ITEM);
    if (!item) {
      warn(`not a list item under ${day.date}: ${line.trim()}`);
      return;
    }
    const width = indentWidth(item[1]);
    if (skipDeeperThan !== null) {
      if (width > skipDeeperThan) return;
      skipDeeperThan = null;
    }
    const raw = item[2];
    const isPrivate = raw.includes(config.privateTag);

    if (width < 2) {
      entry = isPrivate ? null : toEntry(raw, config, warn);
      if (!entry) {
        skipDeeperThan = width;
        return;
      }
      indents = [width];
      day.entries.push(entry);
      return;
    }

    if (isPrivate) {
      skipDeeperThan = width;
      return;
    }
    if (!entry) {
      warn('indented item without a parent line');
      return;
    }
    while (indents.length > 1 && indents.at(-1) >= width) indents.pop();
    indents.push(width);
    const subText = plain(raw, warn);
    if (subText) entry.sub.push({ text: subText, depth: indents.length - 1 });
  });

  const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  return { days, warnings };
}
