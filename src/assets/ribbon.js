/* Almanac ribbon: keeps the bracket over the days currently on screen.
   Anything with data-span="YYYY-MM-DD[ YYYY-MM-DD]" counts as showing those days. */
(function () {
  const DAY = 864e5;
  const html = document.documentElement;
  const utc = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  let frame = 0;

  function update() {
    frame = 0;
    const rb = document.querySelector('.ribbon');
    const win = rb && rb.querySelector('.rb-window');
    const spans = document.querySelectorAll('[data-span]');
    if (!win || !spans.length) return;

    const top = 24;
    const bottom = innerHeight - rb.offsetHeight;
    let lo = null;
    let hi = null;
    for (const el of spans) {
      const r = el.getBoundingClientRect();
      if (r.bottom <= top || r.top >= bottom) continue;
      const [a, b = a] = el.dataset.span.split(' ');
      if (lo === null || a < lo) lo = a;
      if (hi === null || b > hi) hi = b;
    }
    if (lo === null) {
      win.hidden = true;
      return;
    }
    const start = utc(rb.dataset.start);
    const total = +rb.dataset.total;
    const s = (utc(lo) - start) / DAY;
    const e = (utc(hi) - start) / DAY + 1;
    win.style.left = (s / total) * 100 + '%';
    win.style.width = ((e - s) / total) * 100 + '%';
    win.hidden = false;
  }

  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);

  // Place the bracket before the first frame (restored scroll included), without animating it there.
  function settle() {
    html.classList.remove('rb-ready');
    update();
    requestAnimationFrame(() => requestAnimationFrame(() => html.classList.add('rb-ready')));
  }
  addEventListener('pagereveal', settle);
  document.addEventListener('DOMContentLoaded', settle);
})();
