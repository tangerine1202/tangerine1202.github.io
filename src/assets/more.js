// The Log's older days, fetched as the reader scrolls. The page holds the newest days and, after
// them, a skeleton (.log-more) naming the files still to come; when it nears the screen, the next
// file is fetched and its months go in above it. After the last one the skeleton goes.
(() => {
  function watch(box) {
    const queue = box.dataset.chunks.split(' ').filter(Boolean);
    let busy = false;
    const io = new IntersectionObserver((seen) => {
      if (busy || !seen.some((e) => e.isIntersecting)) return;
      busy = true;
      const next = queue.shift();
      fetch(next)
        .then((r) => (r.ok ? r.text() : Promise.reject(r.status)))
        .then((text) => {
          const t = document.createElement('template');
          t.innerHTML = text;
          const added = [...t.content.children];
          box.before(t.content);
          // focus.js links the new context names to the rest of the page.
          for (const el of added) document.dispatchEvent(new CustomEvent('meanwhile:more', { detail: el }));
          busy = false;
          if (!queue.length) {
            io.disconnect();
            box.remove();
          } else {
            // Still on screen after a short chunk? Observing again reports it, and the next one loads.
            io.unobserve(box);
            io.observe(box);
          }
        })
        .catch(() => {
          queue.unshift(next);
          io.disconnect();
          box.classList.add('failed');
          const retry = document.createElement('button');
          retry.type = 'button';
          retry.className = 'log-retry';
          retry.textContent = 'Couldn’t load older days — try again';
          retry.addEventListener('click', () => {
            retry.remove();
            box.classList.remove('failed');
            busy = false;
            io.observe(box);
          });
          box.after(retry);
        });
    }, { rootMargin: '0px 0px 800px 0px' }); // start a screen early, so the reader rarely sees it
    io.observe(box);
  }

  function start() {
    document.querySelectorAll('.log-more[data-chunks]').forEach(watch);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
