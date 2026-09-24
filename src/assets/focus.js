/* Meanwhile — Ink & Focus (Play).
   Colour stops meaning "which context is this" and starts meaning "what else is this".
   Looking at a context blooms its dots by date and lets everything else fall back; a context
   with no colour of its own turns ink while it is the one being looked at.
   Inlined as a classic script in <head>, like transitions.js. Remove it and the site still works. */
(function (root) {
  /**
   * Delay in ms for each element, so the colour spreads along time: oldest first, 10ms apart,
   * never more than 400ms in total. The result follows the order of `dates`, not the sorted order.
   */
  function bloomDelays(dates, step = 10, max = 400) {
    const order = dates.map((_, i) => i).sort((a, b) => (dates[a] < dates[b] ? -1 : dates[a] > dates[b] ? 1 : a - b));
    const out = new Array(dates.length);
    order.forEach((idx, rank) => { out[idx] = Math.min(rank * step, max); });
    return out;
  }

  /** A context without a colour of its own (grey) is drawn in ink while it is in focus. */
  function colorOf(styleC, greys, ink) {
    const c = String(styleC || '').trim();
    if (!c) return ink;
    return greys.some((g) => String(g).trim().toLowerCase() === c.toLowerCase()) ? ink : c;
  }

  root.MeanwhileFocus = { bloomDelays, colorOf };
  if (typeof document === 'undefined') return;

  // Everything that can put a context in focus. .cn sits inside .grp h2 on purpose: both are
  // sources, and focus() ignores a request for the context already in focus. On the Log the
  // heading (.lg-grp h3) is not one: it runs the full width, and only the name itself should.
  const SOURCES = '[data-focus], .cn[data-cid], .lk[data-cid], .clist a[data-cid], .grp h2';
  const BLUR_DELAY = 120;

  const html = document.documentElement;
  const noHover = root.matchMedia('(hover: none)');
  const greys = (html.dataset.grey || '').split(/\s+/).filter(Boolean);

  let sources = [];
  let marked = []; // { el, c0, cls } — c0 is the element's own --c, put back on blur
  let current = null;
  let sticky = null; // the Context page's own context: it stays in focus
  let timer = null;

  const ink = () => getComputedStyle(html).getPropertyValue('--ink').trim() || '#1E1E1C';

  /** The date an element belongs to, '' when it belongs to none (a legend, a lane label). */
  function dateOf(el) {
    const box = el.closest('[data-vt-day],[data-date],[data-row]');
    if (box) return box.dataset.vtDay || box.dataset.date || box.dataset.row || '';
    // The ribbon's columns carry no date attribute, but each one links to its own day.
    const a = el.closest('a[href]');
    const m = a && a.pathname.match(/\/d\/(\d{4}-\d{2}-\d{2})\/?$/);
    return m ? m[1] : '';
  }

  /** The colour written on the element that carries this context, before grey is turned to ink. */
  function rawColor(el, cid) {
    const holder = el.matches(`[data-cid="${cid}"]`) ? el : el.querySelector(`[data-cid="${cid}"]`);
    return (holder && holder.style.getPropertyValue('--c')) || el.style.getPropertyValue('--c') || '';
  }

  function cidOf(el) {
    if (el.dataset.focus) return el.dataset.focus;
    if (el.dataset.cid) return el.dataset.cid;
    const inner = el.querySelector('[data-cid]');
    return inner ? inner.dataset.cid : null;
  }

  function clear() {
    for (const m of marked) {
      m.el.classList.remove(m.cls || 'on');
      m.el.style.transitionDelay = '';
      m.el.style.removeProperty('--c-on');
      if (m.c0 !== undefined) {
        if (m.c0) m.el.style.setProperty('--c', m.c0);
        else m.el.style.removeProperty('--c');
      }
    }
    marked = [];
    current = null;
    delete html.dataset.focus;
  }

  /** Mark an element and remember to undo it — unless the page arrived with it marked already. */
  function mark(el, cls) {
    if (el.classList.contains(cls)) return false;
    el.classList.add(cls);
    marked.push({ el, cls });
    return true;
  }

  function focus(cid, color) {
    if (!cid || current === cid) return;
    clear();
    const main = document.querySelector('main');
    if (!main) return;
    const els = [...main.querySelectorAll(`[data-cid="${cid}"], [data-cids~="${cid}"]`)];
    const delays = bloomDelays(els.map(dateOf));
    const grey = color === ink();
    els.forEach((el, i) => {
      const m = { el };
      // A day grid cell shows its dominant context; while this one is in focus, it shows this one.
      if (el.hasAttribute('data-cids')) {
        m.c0 = el.style.getPropertyValue('--c');
        el.style.setProperty('--c', color);
      }
      if (grey) el.style.setProperty('--c-on', color);
      el.style.transitionDelay = `${delays[i]}ms`;
      el.classList.add('on');
      marked.push(m);
      // The lane / group around it is what recedes, so mark it too.
      const box = el.closest('.lane, .grp, .lg-grp');
      if (box && !box.classList.contains('on')) {
        box.classList.add('on');
        marked.push({ el: box });
      }
    });
    // The ribbon sits outside main and has its own words for this (.ribbon.focus b:not(.on)),
    // so borrow them. A Context page's ribbon arrives already focused; mark() leaves that alone.
    const rb = document.querySelector('.ribbon');
    if (rb) {
      mark(rb, 'focus');
      const bs = [...rb.querySelectorAll(`b[data-cid="${cid}"]`)];
      const rbDelays = bloomDelays(bs.map(dateOf));
      bs.forEach((b, i) => {
        if (mark(b, 'on')) b.style.transitionDelay = `${rbDelays[i]}ms`;
      });
    }
    current = cid;
    html.dataset.focus = cid;
  }

  function focusSource(el) {
    const cid = cidOf(el);
    if (!cid) return;
    focus(cid, colorOf(rawColor(el, cid), greys, ink()));
  }

  /** Back to rest — or, on a Context page, back to that page's own context. */
  function blur() {
    if (sticky && current === cidOf(sticky)) return;
    clear();
    if (sticky) focusSource(sticky);
  }

  function anyHovered() {
    return sources.some((el) => el.matches(':hover'));
  }

  function later(fn) {
    clearTimeout(timer);
    timer = setTimeout(fn, BLUR_DELAY);
  }

  function bind(scope) {
    const found = [...scope.querySelectorAll(SOURCES)];
    sources.push(...found);
    for (const el of found) {
      el.addEventListener('pointerenter', () => { clearTimeout(timer); focusSource(el); });
      el.addEventListener('focusin', () => { clearTimeout(timer); focusSource(el); });
      el.addEventListener('pointerleave', () => later(() => { if (!anyHovered()) blur(); }));
      el.addEventListener('focusout', () => later(blur));
    }
  }

  // Days the Log loads later (more.js) join in as they arrive.
  document.addEventListener('meanwhile:more', (e) => bind(e.detail));

  function init() {
    const main = document.querySelector('main');
    if (!main) return;
    sources = [];
    bind(main);
    // The Context page is already about one context, so it is in focus from the start.
    sticky = document.querySelector('.ctx-head .dot[data-cid]');
    if (sticky) focusSource(sticky);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // Touch has no hover, so a tap on a legend entry means "show me", and only the second tap leaves.
  // Capture phase + stopPropagation, because transitions.js also listens for this click.
  document.addEventListener('click', (e) => {
    if (!noHover.matches) return;
    const a = e.target.closest && e.target.closest('a[data-focus]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (html.dataset.focus === a.dataset.focus) return; // second tap: let it navigate
    focusSource(a);
    e.preventDefault();
    e.stopPropagation();
  }, true);

  // A new page starts at rest; on a Context page that means its own context, not nothing.
  addEventListener('pagereveal', blur);

  // No Text → Trace second step here: an Almanac Context page shows its days as a dot grid, not
  // as a line, so the peek's little line has nothing of its own shape to become. It fades with
  // the page instead, and the ribbon's bracket stays the one thing that visibly travels.
})(globalThis);
