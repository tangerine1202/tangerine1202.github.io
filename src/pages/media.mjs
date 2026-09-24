import { esc, fmtShort } from '../util.mjs';
import { layout } from '../layout.mjs';
import { KINDS, kindLabel } from '../media.mjs';

const ORDER = [...Object.values(KINDS).map((k) => k.id), 'other'];
const emojiOf = (kind) => Object.keys(KINDS).find((e) => KINDS[e].id === kind) ?? '·';

/** One line of the record, as it was written: the kind, the work, and the day out at the right. */
function line(e) {
  if (e.type === 'note') return `<li class="mnote">${esc(e.text)}</li>`;
  const by = e.by ? ` <span class="mb">${esc(e.by)}</span>` : '';
  return `<li class="ml" data-kind="${e.kind}"><span class="mk" title="${kindLabel(e.kind)}">${e.emoji}</span>`
    + `<span class="mt">${esc(e.title)}${by}</span><span class="md">${e.date ? fmtShort(e.date) : ''}</span></li>`;
}

/** A section laid out like a Log day: the year where the numeral goes, and nothing under it. */
function row(s) {
  return `<div class="lday mday m-${s.kind}" data-kind-row><div class="d"><span class="dd"><span class="dn">${esc(s.title)}</span></span></div>`
    + `<div class="lgroups"><ul class="ents mlines">${s.entries.map(line).join('')}</ul></div></div>`;
}

/** Media (Play): what I read, watched, played — by year, in the Log's clothes, in the order it was written. */
export function media(site) {
  const { description, sections, counts } = site.media;
  const legend = ORDER.filter((k) => counts[k])
    .map((k) => `<button type="button" data-kind="${k}" aria-pressed="false"><span class="mk">${emojiOf(k)}</span>`
      + `<span class="nm">${kindLabel(k)}</span><span class="n">${counts[k]}</span></button>`).join('');
  // Years first, then the shortlist, then what's on hold.
  const order = { year: 0, highlight: 1, pause: 2 };
  const rows = [...sections].sort((a, b) => order[a.kind] - order[b.kind]);

  const body = `<h1 class="page-title">Media</h1>
${description ? `<p class="mdesc">${esc(description)}</p>` : ''}
<div class="legend mlegend" role="group" aria-label="Show one kind">${legend}</div>
${rows.map(row).join('\n')}
<script>
(() => {
  const buttons = [...document.querySelectorAll('.mlegend button')];
  const lines = [...document.querySelectorAll('.ml')];
  let on = null;
  buttons.forEach((b) => b.addEventListener('click', () => {
    on = on === b.dataset.kind ? null : b.dataset.kind;
    buttons.forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.kind === on)));
    lines.forEach((li) => { li.hidden = !!on && li.dataset.kind !== on; });
    document.querySelectorAll('[data-kind-row]').forEach((r) => { r.hidden = !r.querySelector('.ml:not([hidden])'); });
  }));
})();
</script>`;
  return layout(site, { title: 'Media', current: 'media', cls: 'p-media', body, ribbon: false });
}
