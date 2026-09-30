import { layout } from '../layout.mjs';

/** 404.html: what a missing address shows. The host adds the 404 status (wrangler.jsonc, not_found_handling). */
export function notFound(site) {
  const body = `<h1 class="page-title">Not found</h1>
<p class="quiet-note">There is nothing at this address. <a class="ext" href="${site.url('/')}">Back to the start</a>.</p>`;
  return layout(site, { title: 'Not found', current: null, cls: 'p-404', body, ribbon: false });
}
