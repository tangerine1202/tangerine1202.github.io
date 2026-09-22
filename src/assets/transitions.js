/* Meanwhile motion layer.
   Decides what kind of navigation this is, then names only the elements that should travel
   between the two pages (cross-document View Transitions). Inlined as a classic script in
   <head> so `pagereveal` is caught before the first frame. Remove it and the site still works. */
(function (root) {
  const BASE = '__BASE__';
  // Time-scale levels. Lower = closer to a single day. Change a page's level here.
  const LEVEL = { home: 5, year: 4, calendar: 3, log: 2, day: 1 };
  const DAY_HOSTS = ['calendar', 'log', 'year', 'context'];

  function pageOf(pathname) {
    const rest = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname.replace(/^\//, '');
    const p = '/' + rest;
    const day = p.match(/^\/d\/(\d{4}-\d{2}-\d{2})\/?$/);
    if (day) return { type: 'day', date: day[1], path: pathname };
    if (p === '/' || p === '/index.html') return { type: 'home', path: pathname };
    if (p.startsWith('/c/')) return { type: 'context', path: pathname };
    const top = p.split('/')[1];
    return { type: ['year', 'calendar', 'log', 'contexts'].includes(top) ? top : 'other', path: pathname };
  }

  // First matching rule wins. `via` is what the clicked element said (e.g. a context link).
  function classify(from, to, via) {
    if (from.type === 'day' && to.type === 'day') return to.date > from.date ? 'day-next' : 'day-prev';
    if (via) return via;
    if ((from.type === 'day' && DAY_HOSTS.includes(to.type)) || (to.type === 'day' && DAY_HOSTS.includes(from.type))) return 'morph';
    if ([from.type, to.type].some((t) => t === 'context' || t === 'contexts')) return 'thread';
    if (from.type in LEVEL && to.type in LEVEL && LEVEL[from.type] !== LEVEL[to.type]) {
      return LEVEL[to.type] < LEVEL[from.type] ? 'zoom-in' : 'zoom-out';
    }
    return 'fade';
  }

  root.MeanwhileVT = { pageOf, classify };
  if (typeof document === 'undefined') return;

  const html = document.documentElement;
  html.classList.add('enter');
  if (!('onpagereveal' in root)) return;

  const LAST = 'meanwhile:vt-last';
  const PAIRS = 'meanwhile:vt-pairs';
  const reduce = root.matchMedia('(prefers-reduced-motion: reduce)');
  let named = [];
  let lastLink = null;

  const store = {
    get(key) { try { return JSON.parse(sessionStorage.getItem(key)); } catch (_) { return null; } },
    set(key, value) { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* private mode: fall back to URL rules */ } },
  };

  function inView(el) {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.bottom > 0 && r.top < root.innerHeight;
  }

  // A duplicate or wrapped (multi-fragment) named element aborts the whole transition, so guard both.
  function nameIt(el, name, cls) {
    if (!el || named.some((n) => n.name === name) || el.getClientRects().length !== 1) return;
    el.style.viewTransitionName = name;
    if (cls) el.style.viewTransitionClass = cls;
    named.push({ el, name });
  }

  function clearNames() {
    for (const { el } of named) {
      el.style.viewTransitionName = '';
      el.style.viewTransitionClass = '';
    }
    named = [];
    html.classList.remove('focusing');
    document.querySelectorAll('.lit').forEach((el) => el.classList.remove('lit'));
  }

  function setKind(kind, back) {
    html.dataset.vt = kind;
    if (back) html.dataset.vtDir = 'back';
    else delete html.dataset.vtDir;
  }

  function clearKind() {
    delete html.dataset.vt;
    delete html.dataset.vtDir;
  }

  function findLink(path) {
    for (const a of document.querySelectorAll('main a[href]')) {
      if (a.pathname === path && inView(a)) return a;
    }
    return null;
  }

  function nameDots(scope) {
    scope.querySelectorAll('.dot[data-cid]').forEach((d) => nameIt(d, 'dot-' + d.dataset.cid, 'dot'));
  }

  function nameEntries(scope) {
    if (!scope || !inView(scope)) return;
    scope.querySelectorAll('.ents > li').forEach((li, k) => {
      if (k < 30 && inView(li)) nameIt(li, 'ent-' + k, 'ent');
    });
  }

  // Both pages run this with their own point of view; matching names become one moving thing.
  function nameShared(kind, here, there, link) {
    if (kind === 'morph') {
      if (here.type === 'day') {
        const sheet = document.querySelector('.sheet');
        if (!sheet) return;
        nameIt(sheet.querySelector(':scope > .plate'), 'vt-day');
        nameIt(sheet.querySelector('.dn'), 'vt-date');
        sheet.querySelectorAll('.grp').forEach(nameDots);
      } else if (there.type === 'day') {
        // A page can show the same day twice (a Context's grid and its day list): prefer what was clicked.
        const sel = '[data-vt-day="' + there.date + '"]';
        const el = link && link.matches(sel) ? link : [...document.querySelectorAll(sel)].find(inView);
        if (!el || !inView(el)) return;
        nameIt(el.matches('.plate') ? el : el.querySelector('.plate'), 'vt-day');
        nameIt(el.querySelector('[data-vt-date]'), 'vt-date');
        nameDots(el);
      }
    } else if (kind === 'thread') {
      if (here.type === 'context') {
        nameIt(document.querySelector('.ctx-title'), 'ctx-title');
        nameIt(document.querySelector('.ctx-head .dot'), 'ctx-dot');
        if (there.type === 'day') nameEntries(document.querySelector('[data-row="' + there.date + '"]'));
      } else if (there.type === 'context') {
        const a = link || findLink(there.path);
        if (!a) return;
        const group = a.closest('[data-group]');
        nameIt(a.querySelector('.nm') || a, 'ctx-title');
        nameIt(a.querySelector('.dot') || (group && group.querySelector('.dot')), 'ctx-dot');
        if (here.type === 'day' && group) nameEntries(group);
      }
    }
  }

  document.addEventListener('click', (e) => {
    lastLink = e.target.closest ? e.target.closest('a[href]') : null;
  }, true);

  // Dots → Line, step one: clicking a context in a legend or lane first lights up its dots
  // on this page and lets the rest fall back, then leaves for the Context page.
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[data-focus]');
    if (!a || reduce.matches || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    lastLink = a;
    document.querySelectorAll('[data-cid="' + a.dataset.focus + '"]').forEach((el) => el.classList.add('lit'));
    html.classList.add('focusing');
    // How long the lit dots hold before leaving; a theme can shorten it with --vt-focus-hold (ms).
    const hold = parseFloat(getComputedStyle(html).getPropertyValue('--vt-focus-hold')) || 320;
    setTimeout(() => { location.href = a.href; }, hold);
  });

  addEventListener('pageswap', (e) => {
    clearNames();
    if (!e.viewTransition) return;
    const act = e.activation;
    const destHref = act && act.entry && act.entry.url ? act.entry.url : lastLink && lastLink.href;
    if (!destHref) return;
    const dest = new URL(destHref);
    if (dest.origin !== location.origin) return;

    const here = pageOf(location.pathname);
    const there = pageOf(dest.pathname);
    const traverse = !!act && act.navigationType === 'traverse';
    const back = traverse && root.navigation && act.entry.index < root.navigation.currentEntry.index;
    const link = !traverse && lastLink && lastLink.pathname === dest.pathname ? lastLink : null;

    let via = null;
    const pairs = store.get(PAIRS) || {};
    if (traverse) via = pairs[dest.pathname + '>' + here.path] || null; // replay the way we came, reversed
    else if (link && there.type === 'context' && !link.matches('[data-vt-day]')) via = 'thread';

    const kind = classify(here, there, via);
    pairs[here.path + '>' + dest.pathname] = kind;
    store.set(PAIRS, pairs);
    store.set(LAST, { from: here.path, to: dest.pathname, kind, back, t: Date.now() });

    setKind(kind, back);
    nameShared(kind, here, there, link);
  });

  addEventListener('pagereveal', (e) => {
    clearNames();
    clearKind();
    if (!e.viewTransition) return;

    const here = pageOf(location.pathname);
    const last = store.get(LAST);
    let there;
    let kind;
    let back;
    if (last && last.to === location.pathname && Date.now() - last.t < 10000) {
      there = pageOf(last.from);
      kind = last.kind;
      back = last.back;
    } else {
      const act = root.navigation && root.navigation.activation;
      const fromHref = act && act.from ? act.from.url : document.referrer;
      if (!fromHref || new URL(fromHref).origin !== location.origin) {
        e.viewTransition.skipTransition();
        return;
      }
      there = pageOf(new URL(fromHref).pathname);
      kind = classify(there, here, null);
      back = !!(act && act.from && act.navigationType === 'traverse' && act.entry.index < act.from.index);
    }
    store.set(LAST, null);

    setKind(kind, back);
    nameShared(kind, here, there, null);
    e.viewTransition.finished.finally(() => {
      clearNames();
      clearKind();
    });
  });
})(globalThis);
