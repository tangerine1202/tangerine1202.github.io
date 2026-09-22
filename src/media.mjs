// media-log.md → { description, sections: [{ title, kind, entries }], counts }
// A section is a year (`### 2026`), `### Early`, `## ⭐ Highlight` or `### Pause`.
// An entry is an item (`- 📖 0915 Title / Author`) or a note (any other line, kept where it was).

export const KINDS = {
  '📖': { id: 'book', label: 'Books' },
  '🎬': { id: 'film', label: 'Films' },
  '🎵': { id: 'music', label: 'Music' },
  '🎮': { id: 'game', label: 'Games' },
  '🇯🇵': { id: 'japanese', label: 'Japanese' },
  '🎓': { id: 'course', label: 'Courses' },
};
const OTHER = { id: 'other', label: 'Other' };

const HEADING = /^#{2,6}\s+(.*)$/;
const ITEM = /^[-*+]\s+(\S+)\s+(.*)$/u;
const DATE = /^(\d{2})(\d{2})\s+/;

function sectionOf(title) {
  const clean = title.replace(/^[^\p{L}\p{N}]+/u, '').trim(); // "⭐ Highlight" → "Highlight"
  const kind = /^highlight$/i.test(clean) ? 'highlight' : /^pause$/i.test(clean) ? 'pause' : 'year';
  return { title: clean, kind, entries: [] };
}

function toItem(emoji, rest, year) {
  const k = KINDS[emoji] ?? OTHER;
  let date = null;
  const d = rest.match(DATE);
  if (d && year) {
    date = `${year}-${d[1]}-${d[2]}`;
    rest = rest.slice(d[0].length);
  }
  const slash = rest.indexOf(' / ');
  const title = (slash < 0 ? rest : rest.slice(0, slash)).trim();
  const by = slash < 0 ? null : rest.slice(slash + 3).trim();
  return { type: 'item', kind: k.id, emoji, date, title, by };
}

export function parseMedia(text) {
  const sections = [];
  let description = '';
  let section = null;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line === '---' || line.startsWith('# ')) continue;
    const desc = line.match(/^>\s*description:\s*(?:>-\s*)?(.*)$/);
    if (desc) { description = desc[1].trim(); continue; }

    const heading = line.match(HEADING);
    if (heading) {
      section = sectionOf(heading[1]);
      sections.push(section);
      continue;
    }
    if (!section) continue;

    const item = line.match(ITEM);
    const year = /^\d{4}$/.test(section.title) ? section.title : null;
    if (item && (KINDS[item[1]] || /^\p{Extended_Pictographic}/u.test(item[1]))) {
      section.entries.push(toItem(item[1], item[2], year));
    } else {
      section.entries.push({ type: 'note', text: line.replace(/^[-*+]\s+/, '') });
    }
  }

  // Counts for the filters: the log itself, not the shortlist or what's on hold.
  const counts = {};
  for (const s of sections) {
    if (s.kind !== 'year') continue;
    for (const e of s.entries) if (e.type === 'item') counts[e.kind] = (counts[e.kind] ?? 0) + 1;
  }
  return { description, sections, counts };
}

export const kindLabel = (id) => Object.values(KINDS).find((k) => k.id === id)?.label ?? OTHER.label;
