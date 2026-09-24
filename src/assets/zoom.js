// A write-up's pictures, larger, in place: a click widens the picture itself out of the text column
// (centred on the screen, up to its own size, never taller than the screen), and what follows it
// moves down to make room. Another click, or Esc, puts it back in the column.
(() => {
  const SEL = '.pg-fig .frame img';
  const still = matchMedia('(prefers-reduced-motion: reduce)');

  // How wide the picture may grow: the screen less a margin, its own width, and a height that fits.
  function widest(img) {
    const pad = innerWidth < 600 ? 12 : 40;
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    return Math.min(w, innerWidth - pad * 2, (innerHeight - pad * 2) * (w / h));
  }

  function grow(fig, img) {
    const col = fig.parentElement.clientWidth;
    const w = widest(img);
    if (w <= col + 1) return; // already as large as it can be
    // Start from the column's width in pixels, so the change has a number to travel from.
    fig.style.width = `${col}px`;
    fig.style.marginLeft = '0px';
    fig.getBoundingClientRect();
    fig.classList.add('big');
    fig.style.width = `${w}px`;
    fig.style.marginLeft = `${(col - w) / 2}px`; // the column is centred, so this centres the picture
    img.setAttribute('aria-expanded', 'true');
    const settle = () => {
      const r = fig.getBoundingClientRect();
      if (r.top < 0 || r.bottom > innerHeight) fig.scrollIntoView({ block: 'center', behavior: still.matches ? 'auto' : 'smooth' });
    };
    if (still.matches) settle();
    else fig.addEventListener('transitionend', settle, { once: true });
  }

  function shrink(fig, img) {
    fig.style.width = `${fig.parentElement.clientWidth}px`;
    fig.style.marginLeft = '0px';
    img.setAttribute('aria-expanded', 'false');
    const done = () => {
      fig.classList.remove('big');
      fig.style.width = '';
      fig.style.marginLeft = '';
    };
    if (still.matches) done();
    else fig.addEventListener('transitionend', done, { once: true });
  }

  function toggle(img) {
    const fig = img.closest('.pg-fig');
    if (fig.classList.contains('big')) shrink(fig, img);
    else grow(fig, img);
  }

  function start() {
    for (const img of document.querySelectorAll(SEL)) {
      img.tabIndex = 0;
      img.setAttribute('role', 'button');
      img.setAttribute('aria-expanded', 'false');
      img.setAttribute('aria-label', `Enlarge: ${img.alt || 'picture'}`);
    }
  }

  document.addEventListener('click', (e) => {
    const img = e.target.closest && e.target.closest(SEL);
    if (img) toggle(img);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      for (const fig of document.querySelectorAll('.pg-fig.big')) shrink(fig, fig.querySelector('img'));
      return;
    }
    if (e.target.matches && e.target.matches(SEL) && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      toggle(e.target);
    }
  });
  // A new window size means new limits: back into the column, without a transition.
  addEventListener('resize', () => {
    for (const fig of document.querySelectorAll('.pg-fig.big')) {
      fig.classList.remove('big');
      fig.style.width = '';
      fig.style.marginLeft = '';
      fig.querySelector('img').setAttribute('aria-expanded', 'false');
    }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
