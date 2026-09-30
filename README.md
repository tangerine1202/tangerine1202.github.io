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
thick. There are four tabs, in the order `theme.nav` names them — **Log** (`/log/`) is every year's
lanes, without the days under them (`theme.logDays`); **Media** (`/media/`) is the media log;
**Project** (`/project/`) is the things I made; **About** (`/about/`) is the CV. (With `logDays` on, the
Log can also list its days and fetch older months as the reader scrolls: `theme.lazyLog`,
`src/assets/more.js`.) Home is the brand. Contexts and Day pages are
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

### Photos

Put photos in `content/photos/` in any of JPG, PNG, WebP, BMP or TIFF, and refer to them by that
name. The build publishes each still as a compressed `.jpg` in `dist/photos/`: at most 2000 px on
the long edge, turned upright from its EXIF orientation, transparency laid on white, and all
metadata (EXIF, GPS) stripped. A small JPEG that would only grow when re-encoded is kept as it was,
less its EXIF. Originals are never changed. Anything else (an `.mp4`) is published as it is.

This needs `ffmpeg` on PATH (`apt install ffmpeg`); without it, the build stops. Results are cached
in `.cache/`, so rebuilds only re-encode what changed. The size and quality are `MAX` and `QUALITY`
at the top of `src/photos.mjs`; changing them starts a fresh cache.

## The log's data

The site's log is built from `content/log.json`, not from the daily log directly. The daily log is one
*source* imported into it; other sources, and entries typed by hand, sit beside it. Each entry is
`{ id, date, context, text, sub, source }`.

```bash
node logdata.mjs import daily-log content/daily-log.md   # replace the daily-log source (other sources untouched)
node logdata.mjs import calendar some-other-log.md       # another markdown log, as its own source
node logdata.mjs add 2026-09-25 "寫了什麼" --context Japanese   # source "manual" unless --source says otherwise
node logdata.mjs list --date 2026-09-25                 # also --source, --context
node logdata.mjs edit <id> --text "…"                  # also --date, --context
node logdata.mjs rm <id>
node logdata.mjs serve                                  # the edit page, on 172.17.0.1:4325
```

An imported source is replaced whole on every import, so its entries are read-only here: fix them in
the log they came from and import again. What is added here (`manual`, or any other name that isn't
an imported source) is edited and removed here, and no import touches it. The site's rules still
apply to imported logs: `#private` lines, `privateContexts` and `mapEntry`. The dev server watches
`content/`, so every save rebuilds the site. `npm run sync` imports the daily log after copying it.

Converting the daily log is the AI's job each time the log changes; `CLAUDE.md` says how.

The edit page (`src/edit-page.html`) lists every entry by day, with search and filters, adds entries and
edits or deletes the ones added here. It listens only on the docker bridge, so it is reachable only
through Caddy, at `/meanwhile-edit/`, behind a login of its own (`~/host/caddy/caddy/sites/meanwhile-edit.caddy`):
someone who can read the site can't change its data. Every change must carry an `x-meanwhile-edit`
header, which a page on another site can't send, so a remembered password can't be used from elsewhere.

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
post can be written before its picture exists. The layout follows the photos (one → beside the
text, two → a pair, none → quiet) unless `layout:` says otherwise.

One real photo is fitted to its text: it stands beside the text at about the text's height (360–600 px),
its width following its own shape, and the text column narrows from 608 to 480 px if a wide photo needs
the room. The build estimates the text's height by counting lines, so a short post gets a small picture
and no photo leaves a band of empty space beside its words. A photo too wide to stand beside the text
(a panorama) goes under it at that height instead. Once the file exists, `shape` only matters for the
placeholder; the real photo's size decides. The numbers live at the top of `fit()` in
`src/pages/home.mjs` and must stay in step with the title and prose sizes in `almanac.css`. `[[Context]]` or `[[Context|words]]`
links a word to that context and grows its peek on hover; a context nobody has recorded stays plain text.
`[words](https://…)` links off the site.

## Writing a project (the Project tab)

`/project/` lists the small things I made — a record of a rhythm, not a portfolio. The files still live in
`content/vibe/`, since every project so far was vibe coded.
One file per project in `content/vibe/`: front matter, then the description in your own words below it.

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

`title` `date` `image` `alt` are required — a missing one fails the build and says which file
and which field. The card's text is the first paragraph below the front matter, word for word
(headings, pictures and their `*captions*` are skipped); `blurb` is used only by a file with no
body, and a file with neither fails the build. `links` is at most three, each `{ type, url }` with `type` either `demo` or `repo`
(shown as demo / source code, underlined in the project's context colour); the title links to
the first of them, preferring `demo`, then `repo` — unless `page:` names a write-up
(below), which the title leads to instead. `context` is the `[[wikilink]]` target
in the daily log; one nobody has recorded only prints a warning.

The blurb is two sentences: what it does, then why I made it. About 80 characters.

### A write-up page

A longer story behind a project lives in `content/page/<name>.md` and is built at `/project/<name>/`,
in the Project tab, as a plain article with a `← Project` link back. Add `page: <name>` to the project's front matter to link
its title there. The file is plain Obsidian markdown: a `# Title` line, paragraphs, and pictures as
`![[file.png]]` or `![alt](file.png)` from `content/photos/`, each optionally followed by a
`*caption*` line. `[[Context|words]]` and `[words](url)` link as they do on Home. A `page:` with no
file, or a picture that isn't there, only prints a warning.

Projects are listed newest first, each a row in the Log's shape: the year out in the margin (from
`date`), and under it, where the Log keeps the weekday, the kind of project — `kind:` in the front
matter, `vibe coding` when it names none. Then the title, words and links, with the picture beside them. The picture lives in `content/photos/` as `vibe-<slug>.png`, where `<slug>` is the file
name, and sits whole — never cropped — in a 16:10 frame, so a tall screenshot and a wide one read
as one list. A file
that isn't there yet lays out as a placeholder frame, like a Home photo. For something that has
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

## Writing the About page

`/about/` is `content/about.md`: `## Section` headings, `- item` lines, and indented `- detail` lines
under an item. An item ending in ` (…)` has that as its dates, shown at the right. Inside a line,
`**bold**` and `[words](url)` work; a url starting with `/` is a page on this site.
A `.pdf` placed in `content/` (the CV) is published at the site root, so `[Resume](/cv.pdf)` links to `content/cv.pdf`.

## Before deploying

Open `dist/` and check it. The log still has health lines that aren't marked `#private`.

## Deploying

Production is a Cloudflare Worker named `meanwhile` that serves the built site as static assets
(`wrangler.jsonc`), at https://blog.alans.dev. It holds a built snapshot of this folder, `content/`
included, so editing files or running `npm run dev` never changes it. To publish what is here now:

```bash
./deploy.sh   # runs the tests and the build inside Docker, then uploads the result
```

`deploy.sh` builds with the `Dockerfile` (base `/`), takes the built site out to `.deploy/site/`, and runs
`wrangler deploy` with the API token in `~/.config/cloudflare/api-token`; it needs Docker and node. If the
tests or the build fail, nothing is uploaded and the live site is as it was. A new version takes about half
a minute to reach every Cloudflare location, and until then some visitors still get the old one.

Any address with no page gets `404.html` (`src/pages/notfound.mjs`), with a 404 status. `npm run dev`
(port 4324) does the same, and stays the local preview.

`blog.alans.dev` is a Custom Domain of the Worker, and the only address it has: `workers.dev` and per-version
preview URLs are off in `wrangler.jsonc`.
