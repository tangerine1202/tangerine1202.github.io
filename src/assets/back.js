/* Path-aware back links (Almanac).
   A link marked data-back names the page you came from and returns you there, instead of always
   pointing up the hierarchy. The page you leave labels itself: the closest data-back-label around the
   link you clicked (a Home post's title, a month, the body's page name). The page you arrive on keeps
   that label in history.state, so it survives reloads and back/forward. When the previous history
   entry is that page, the link uses history.back(): scroll position and the reverse animation come for free. */
(function () {
  const CAME_FROM = 'meanwhile:came-from';
  const FRESH_MS = 10000;
  const store = {
    get(key) { try { return JSON.parse(sessionStorage.getItem(key)); } catch (_) { return null; } },
    set(key, value) { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* no storage: links keep their defaults */ } },
    drop(key) { try { sessionStorage.removeItem(key); } catch (_) { /* ignore */ } },
  };
  const backOfThisEntry = () => (history.state && history.state.back) || null;

  function previousEntryIs(path) {
    const nav = window.navigation;
    if (nav && nav.entries && nav.currentEntry) {
      const prev = nav.entries()[nav.currentEntry.index - 1];
      return !!prev && new URL(prev.url).pathname === path;
    }
    return history.length > 1 && !!document.referrer && new URL(document.referrer).pathname === path;
  }

  // Leaving: remember where we are, in words.
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.origin !== location.origin || a.pathname === location.pathname || a.matches('[data-back]')) return;
    // Stepping to the day before/after keeps the original way back.
    const sibling = a.matches('[rel="prev"], [rel="next"]') ? backOfThisEntry() : null;
    const scope = a.closest('[data-back-label]');
    const back = sibling || { from: location.pathname, label: scope ? scope.dataset.backLabel : document.title };
    store.set(CAME_FROM, { to: a.pathname, back, t: Date.now() });
  }, true);

  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[data-back]');
    const back = backOfThisEntry();
    if (!a || !back || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!previousEntryIs(back.from)) return; // e.g. opened in a new tab: follow the link instead
    e.preventDefault();
    history.back();
  });

  // Arriving: adopt the label and rewrite the back link.
  function arrive() {
    const came = store.get(CAME_FROM);
    if (came && came.to === location.pathname && Date.now() - came.t < FRESH_MS) {
      history.replaceState(Object.assign({}, history.state, { back: came.back }), '');
      store.drop(CAME_FROM);
    }
    const back = backOfThisEntry();
    if (!back) return;
    document.querySelectorAll('a[data-back]').forEach((a) => {
      a.href = back.from;
      a.textContent = '← ' + back.label;
    });
  }

  // Run when the whole page is parsed: immediately on a restored (back/forward cached) page, else at DOMContentLoaded.
  addEventListener('pagereveal', () => { if (document.readyState !== 'loading') arrive(); });
  document.addEventListener('DOMContentLoaded', arrive);
})();
