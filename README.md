# Meanwhile

A visual archive of how I spent my time. Built from `daily-log.md` with plain Node (20+), no dependencies.
`media-log.md` (books, films, music, games, … by year, with a Highlight shortlist) becomes the Media page, `/media/`; it is skipped when the file is missing.

Design: `../meanwhile.md` · Build: `../meanwhile-mvp.md` · Motion: `../meanwhile-motion.md`, `../meanwhile-motion-mvp.md` · Play: `../meanwhile-play.md` · Vibe: `../meanwhile-vibe-page.md`

## One site

| Output | Command | Dev URL |
|---|---|---|
| `dist/` | `node build.mjs` | http://localhost:4324 |

Four versions were built from this codebase while the design was being decided — no motion, motion,
the Almanac, and the Almanac plus the play layer. Only the last one is built now; the others' stylesheets
(`style.css`, `motion.css`) and their page switches are still in `src/`, and `variants.mjs` is still the
list of what gets built and served, so bringing one back is a row in that list.

The site is the **Almanac** identity (`almanac.css`, `almanac-motion.css`, `ribbon.js`, `src/ribbon.mjs`):
every data page carries the *ribbon*, a fixed line of every recorded day, with a bracket over the days the page
is showing. Scrolling moves the bracket; changing pages animates it, so zooming into time narrows it and zooming
out widens it. Fonts: Schibsted Grotesk + Newsreader (Google Fonts, with system fallbacks).

On top of it is the **play layer** (`play.css`, `focus.js`). Colour stops being a label and becomes a link:
at rest the page looks as it always did, but looking at a context — a lane, a name beside a group — blooms
every dot of that context in date order, ribbon included, and lets the rest fall back; a context with no
colour of its own borrows the ink while it is the one you are looking at. A year's lane is not a row of
ticks but a 7-day density ridge in the context's own colour, so it is visible at a glance when something ran
thick. There are three pages and three tabs, in the order `theme.nav` names them — **Vibe** (`/vibe/`) is the
small things made fast; **Media** (`/media/`) is the media log; **Log** (`/log/`) is every year, each one
opening with its lanes and then its days. Home is the brand. Contexts and Day pages are
built and reachable, but not in the nav.
Hovering a word in a Home post grows the little line of dates that word stands for. The accent colour of the
site — the nav underline and the text selection — is the context of the last two weeks. With "reduce motion"
on, the focus still works without animation and the rest is static.

```bash
npm run dev     # builds the site, serves it on http://localhost:4324, rebuilds on change
npm run build   # build into dist/
npm run sync    # copy the logs from the vault (config: vaultLog / MEANWHILE_VAULT_LOG, vaultMedia / MEANWHILE_VAULT_MEDIA), then build
npm test
```

If `node`/`npm` hit the nvm lazy-load error in a non-interactive shell, call the binary directly:
`~/.nvm/versions/node/v22.16.0/bin/node serve.mjs`. Builds spawned by `serve.mjs` and `sync.mjs` reuse
the same binary (`process.execPath`), so they don't depend on `node` being on PATH.

`MEANWHILE_BASE=/sub/path/` builds for a site that isn't at the domain root.

## Content is not in git

Everything under `content/` — the daily log, the media log, Home posts, Vibe entries and photos — is
private and stays on the server; the repository holds only the code. A fresh clone needs `content/`
copied in (`npm run sync` brings the two logs from the vault) before `npm run build` works.

## Writing a Home post

One file per entry in `content/home/`, front matter and then prose:

```markdown
---
date: 2026-07-31
kicker: July 2026
title: Back to the revision.
photo: 拾得物系統 | landscape, IsaacLab 裡的 peg-insertion | landscape
---
Vibe Code 了幾個小工具，造福[[航警替代役|分隊和未來的大家]]。

參考 [Diana Lu](https://diana.lu) 的履歷設計後，決定採用 Okabe-Ito Palette。
```

`photo` is `caption | shape | file`, and a comma starts the next photo, so a caption carries no comma.
The shapes are `landscape`, `portrait` and `square`; the file lives in `content/photos/`. A photo whose
file is missing — or a bare `photo:` with nothing after it — still lays out, as a placeholder frame, so a
post can be written before its picture exists. The layout follows the photos (one portrait → beside the
text, two → a pair, none → quiet) unless `layout:` says otherwise. `[[Context]]` or `[[Context|words]]`
links a word to that context and grows its peek on hover; a context nobody has recorded stays plain text.
`[words](https://…)` links off the site.

## Writing a Vibe entry

`/vibe/` lists the small things AI helped me make fast — a record of a rhythm, not a portfolio.
One file per project in `content/vibe/`, front matter only; there is no body.

```markdown
---
title: 發票自動對帳
date: 2026-08-14
image: vibe-invoice-recon.png
alt: 終端機顯示對帳結果表格
blurb: 把銀行 CSV 和發票 PDF 對起來，列出對不上的幾筆。手動對了三個月之後決定不要再手動對了。
links:
  - { type: repo, url: https://github.com/… }
context: 航警替代役
---
```

`title` `date` `image` `alt` `blurb` are required — a missing one fails the build and says which file
and which field. `links` is at most three, each `{ type, url }` with `type` one of `demo` / `repo` /
`post` (shown as 示範 / 原始碼 / 文章, underlined in the project's context colour); the title links to
the first of them, preferring `demo`, then `post`, then `repo`. `context` is the `[[wikilink]]` target
in the daily log; one nobody has recorded only prints a warning.

The blurb is two sentences: what it does, then why I made it. About 80 characters.

Projects are listed newest first, each with its year out in the margin and its month beside it,
the way the Media page keeps its years. The picture lives in `content/photos/` as `vibe-<slug>.png`, where `<slug>` is the file
name, and sits whole — never cropped — in a 16:10 frame, so a tall screenshot and a wide one read
as one list. A file
that isn't there yet lays out as a placeholder frame, like a Home photo. A `vibe-<slug>.webp` beside
it is used when it exists (the build never makes one: no image dependency). For something that has
to move, use a short `.mp4` — never a GIF — and it plays muted and looping in the same frame.

### Removing the Vibe dot trace

The line of the last 90 days under a Vibe card is an experiment. It lives in
`src/vibe-dot-trace.mjs` (markup and its styles) and `src/vibe-context-activity.mjs` (the days,
read off the finished model), and nothing else imports them.

**Turning it off**

1. Set `features.vibeDotTrace = false` in `meanwhile.config.mjs`.
2. The page must still be right: no empty gap and no leftover rule at the bottom of a card.

**Deleting it for good**

1. Delete `src/vibe-dot-trace.mjs` and `src/vibe-context-activity.mjs`.
2. Delete the import and the one use of it in `src/pages/vibe.mjs` (the `trace` line in the card and
   the `<style>` in `vibe()`), both inside the switch.
3. Delete `features.vibeDotTrace` from `meanwhile.config.mjs`.
4. Delete the "dot trace" section of `test/vibe.test.mjs` and the two imports it uses at the top.
5. Afterwards no `DotTrace` or `vibeContextActivity` string is left in the project.

## Before deploying

Open `dist/` and check it. The log still has health lines that aren't marked `#private`.

## Deploying

Production is the `meanwhile` container (`Dockerfile`, `docker-compose.yml`), served at https://blog.alans.dev.
It holds a built snapshot of this folder, `content/` included, and mounts nothing from the host, so
editing files or running `npm run dev` never changes it. To publish what is here now:

```bash
./deploy.sh   # runs the tests and the build inside Docker, then swaps the container
```

If the tests or the build fail, the running container is left as it was. `restart: unless-stopped`
brings it back after a crash or a reboot.

The Cloudflare tunnel routes `blog.alans.dev` straight to `http://meanwhile:80` on the `caddy` docker
network, not through Caddy, so that hostname can reach this container and nothing else on the machine.
`npm run dev` (port 4324) stays the local preview.
