// parse → model → pages → dist/
// One site: the Almanac's type and ribbon, with the play layer on top (play.css, focus.js).
// The page modules still read the switches below, so a page can be turned off without being rewritten.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from './meanwhile.config.mjs';
import { buildModel } from './src/model.mjs';
import { home, loadPosts } from './src/pages/home.mjs';
import { year, logParts } from './src/pages/year.mjs';
import { contexts, contextPage } from './src/pages/contexts.mjs';
import { day } from './src/pages/day.mjs';
import { media } from './src/pages/media.mjs';
import { parseMedia } from './src/media.mjs';
import { vibe } from './src/pages/vibe.mjs';
import { loadVibe } from './src/vibe.mjs';
import { about, loadAbout } from './src/pages/about.mjs';
import { page, loadPages } from './src/pages/page.mjs';
import { buildPhotos, photoName, jpegSize } from './src/photos.mjs';
import { load as loadData, toParsed } from './src/logdata.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const at = (...p) => path.join(root, ...p);
const started = Date.now();

// Page composition switches, all read by src/pages/*:
//   nav            which sections the header lists, in the order it lists them
//   ribbonOn       pages that carry the ribbon of every recorded day
//   calendarInYear month grids at the bottom of each Year section, and no separate Calendar page
//   yearMonths     false = drop those month grids, leaving the Year its lanes
//   logInYear      the log lives under each Year section, so that page is the Log, at /log/
//   yearGrid       false = no 365-day grid on Year      yearLegend  false = no legend on Year
//   contextGrid    each Context page shows its own 365-day grid per year
//   pathBack       back links return to the page you came from (Context, Day), not up the hierarchy
//   extraCss       stylesheets copied next to style.css and linked after motion.css
//   scripts        extra assets inlined in <head> after transitions.js
//   yearRidge      Year lanes are the 7-day density ridge itself, in full colour, instead of ticks
//   linkTrace      Home prose links carry a mini distribution line
//   nowAccent      the nav underline and text selection follow model.now
//   media          the Media page, from the media log
//   vibe           the Vibe page, from content/vibe/
//   about          the About page, from content/about.md
//   lazyLog        the Log shows its newest days and fetches older ones on scroll (more.js)
//   logDays        false = the Log is its years' lanes only, without the days under them

const theme = {
  css: 'almanac.css',
  motionCss: 'almanac-motion.css',
  fonts: 'https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;1,6..72,400&family=Schibsted+Grotesk:wght@400;500;600&display=swap',
  motion: true,
  nav: ['log', 'media', 'project', 'about'], // the order they appear in; Contexts pages are still built and reachable by URL
  ribbonOn: [], // the Log once had the ribbon of every recorded day along the bottom
  calendarInYear: true,
  yearMonths: false,
  logInYear: true,
  yearGrid: false,
  yearLegend: false,
  contextGrid: true,
  pathBack: true,
  extraCss: ['play.css'],
  scripts: ['focus.js', 'zoom.js'],
  yearRidge: true,
  linkTrace: true,
  nowAccent: true,
  play: true,
  media: true,
  vibe: true,
  about: true,
  lazyLog: false,
  logDays: false,
};

const { motion } = theme;
const out = at('dist');

// The log is built from data (content/log.json), not from the daily log directly: the daily log is
// one source imported into it (node logdata.mjs import daily-log content/daily-log.md), beside
// whatever else is added there.
const dataFile = at(config.data);
if (!fs.existsSync(dataFile)) {
  console.error(`✗ ${config.data} not found. Import the daily log into it: node logdata.mjs import daily-log ${config.log}`);
  process.exit(1);
}

const parsed = toParsed(loadData(dataFile), config);
const model = buildModel(parsed, config);
const base = config.base.replace(/\/$/, '');
const photosDir = at('content/photos');
const warnings = [...parsed.warnings];
const asset = (name) => fs.readFileSync(at('src/assets', name), 'utf8');

// The Media page (theme.media) exists only when the media log does.
const mediaFile = config.media && at(config.media);
const mediaLog = mediaFile && fs.existsSync(mediaFile) ? parseMedia(fs.readFileSync(mediaFile, 'utf8')) : null;

const site = {
  model,
  config,
  media: mediaLog,
  theme,
  motion,
  url: (p) => base + p,
  hasPhoto: (src) => fs.existsSync(path.join(photosDir, src)),
  // Inline, classic scripts in <head>, so `pagereveal` is caught before the first frame.
  scripts: motion
    ? [asset('transitions.js').replace("'__BASE__'", JSON.stringify(`${base}/`)), ...(theme.ribbonOn?.length ? [asset('ribbon.js')] : []), ...(theme.pathBack ? [asset('back.js')] : []), ...(theme.scripts ?? []).map(asset)]
    : [],
};

// The Vibe page: small things made fast. A project with a context nobody has recorded still shows,
// it just has no trace under it (spec §4.2).
let vibeItems = [];
try {
  vibeItems = theme.vibe ? loadVibe(at(config.vibe)) : [];
} catch (e) {
  // A project missing a field is a mistake to fix, not a project to skip quietly.
  console.error(`✗ ${e.message}`);
  process.exit(1);
}
for (const v of vibeItems) {
  if (!site.hasPhoto(v.image)) warnings.push(`${v.file}: image ${v.image} not found (placeholder shown)`);
  if (v.context && !model.ctx.has(v.context)) warnings.push(`${v.file}: context "${v.context}" is not in the log (no dot trace)`);
}

// Write-ups behind projects (content/page/), each at /project/<name>/; a project links to one with `page:`.
let writeups = [];
try {
  writeups = theme.vibe ? loadPages(at('content/page')) : [];
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exit(1);
}
for (const v of vibeItems) {
  if (v.page && !writeups.some((w) => w.slug === v.page)) warnings.push(`${v.file}: page "${v.page}" is not in content/page/ (title not linked)`);
}
vibeItems = vibeItems.map((v) => (v.page && !writeups.some((w) => w.slug === v.page) ? { ...v, page: null } : v));
for (const w of writeups) {
  for (const b of w.blocks) if (b.type === 'img' && !site.hasPhoto(b.src)) warnings.push(`page/${w.file}: image ${b.src} not found (placeholder shown)`);
}

const posts = loadPosts(at('content/home'));
for (const p of posts) {
  for (const ph of p.photos) if (ph.src && !site.hasPhoto(ph.src)) warnings.push(`${p.file}: photo ${ph.src} not found (placeholder shown)`);
}

// Photos first: Home lays each post out around its photo's real size.
fs.rmSync(out, { recursive: true, force: true });
try {
  warnings.push(...buildPhotos(photosDir, path.join(out, 'photos'), at('.cache')));
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exit(1);
}
site.photoSize = (src) => {
  const f = path.join(out, 'photos', photoName(src));
  return fs.existsSync(f) ? jpegSize(fs.readFileSync(f)) : null;
};

const pages = [
  ['index.html', home(site, posts)],
  // The Log is the Year page: each year's shape, with that year's days under it.
  ['log/index.html', year(site)],
  // …and its older days, fetched as the reader scrolls (theme.lazyLog).
  ...(theme.lazyLog ? logParts(site).flatMap((p) => p.files.map((f) => [`log/${f.name}`, f.html])) : []),
  ['contexts/index.html', contexts(site)],
  ...(theme.media && mediaLog ? [['media/index.html', media(site)]] : []),
  ...(theme.vibe ? [['project/index.html', vibe(site, vibeItems)]] : []),
  ...writeups.map((w) => [`project/${w.slug}/index.html`, page(site, w)]),
  ...(theme.about ? [['about/index.html', about(site, loadAbout(at('content/about.md')))]] : []),
  ...[...model.ctx.values()].map((c) => [`c/${c.slug}/index.html`, contextPage(site, c)]),
  ...model.dates.map((d) => [`d/${d}/index.html`, day(site, d)]),
];

for (const [file, html] of pages) {
  fs.mkdirSync(path.dirname(path.join(out, file)), { recursive: true });
  fs.writeFileSync(path.join(out, file), html);
}
fs.copyFileSync(at('src/assets', theme.css), path.join(out, 'style.css'));
if (motion) fs.copyFileSync(at('src/assets', theme.motionCss), path.join(out, 'motion.css'));
for (const f of theme.extraCss ?? []) fs.copyFileSync(at('src/assets', f), path.join(out, f));

for (const w of warnings) console.warn(`  ! ${w}`);
console.log(`✓ ${pages.length} pages → ${path.basename(out)}/ in ${Date.now() - started}ms`);
