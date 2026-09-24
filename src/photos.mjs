// content/photos/ → dist/photos/: every still image becomes a compressed JPG, at most MAX px on
// its long edge, with its metadata (EXIF, GPS) stripped. Originals are never touched.
// Uses the system ffmpeg, so there is still no npm dependency. Without ffmpeg, or with a file it can't
// read, the build stops: the pages already link to the .jpg.
// Results are cached in .cache/, so the dev server's rebuilds don't re-encode anything unchanged.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const MAX = 2000;
const QUALITY = 3; // ffmpeg's JPEG scale: 2 (best) … 31 (worst)
const STILL = /\.(jpe?g|png|webp|bmp|tiff?)$/i;

/** The name a photo is published under: a still image always ends in .jpg, anything else keeps its name. */
export function photoName(src) {
  return STILL.test(src) ? src.replace(STILL, '.jpg') : src;
}

/** A JPEG's EXIF orientation (1–8), or 1. Only the tag is read, from the APP1 segment. */
export function exifOrientation(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return 1;
  for (let i = 2; i + 4 < buf.length && buf[i] === 0xff;) {
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker === 0xe1 && buf.toString('latin1', i + 4, i + 10) === 'Exif\0\0') {
      const t = i + 10;
      const le = buf.toString('latin1', t, t + 2) === 'II';
      const u16 = (o) => (le ? buf.readUInt16LE(o) : buf.readUInt16BE(o));
      const u32 = (o) => (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
      const ifd = t + u32(t + 4);
      for (let n = u16(ifd), e = ifd + 2; n-- > 0; e += 12) {
        if (u16(e) === 0x0112) return u16(e + 8);
      }
      return 1;
    }
    if (marker === 0xda) break; // image data starts: no EXIF before it
    i += 2 + len;
  }
  return 1;
}

/** A JPEG's pixel size, from its frame header: { w, h }, or null if it can't be read. */
export function jpegSize(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  for (let i = 2; i + 9 < buf.length && buf[i] === 0xff;) {
    const m = buf[i + 1];
    // SOF0–SOF15, less the three markers in that range that aren't frames (DHT, JPG, DAC).
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

/** The JPEG without its APP1 segments (EXIF, XMP — where GPS lives); the pixels are untouched. */
export function stripExif(buf) {
  const keep = [buf.subarray(0, 2)];
  let i = 2;
  while (i + 4 < buf.length && buf[i] === 0xff && buf[i + 1] !== 0xda) {
    const end = i + 2 + buf.readUInt16BE(i + 2);
    if (buf[i + 1] !== 0xe1) keep.push(buf.subarray(i, end));
    i = end;
  }
  keep.push(buf.subarray(i));
  return Buffer.concat(keep);
}

const dims = (f) => spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', f], { encoding: 'utf8' })
  .stdout.trim().split(',').map(Number);

// Turns the pixels upright; the mirrored orientations (2, 4, 5, 7) are rare enough to leave as they are.
const ROTATE = { 3: 'hflip,vflip,', 6: 'transpose=1,', 8: 'transpose=2,' };

function encode(from, to) {
  const turn = /\.jpe?g$/i.test(from) ? ROTATE[exifOrientation(fs.readFileSync(from))] ?? '' : '';
  // Shrink (never enlarge), then lay the picture on white so a transparent PNG doesn't turn black.
  const graph = `[0:v]${turn}scale='min(${MAX},iw)':'min(${MAX},ih)':force_original_aspect_ratio=decrease,format=rgba[f];`
    + 'color=white:s=16x16[bg];[bg][f]scale2ref[bg][f];[bg][f]overlay=shortest=1,format=yuvj420p';
  return spawnSync('ffmpeg', ['-v', 'error', '-y', '-noautorotate', '-i', from, '-filter_complex', graph,
    '-map_metadata', '-1', '-frames:v', '1', '-q:v', String(QUALITY), to], { encoding: 'utf8' });
}

/** Publishes every file in `srcDir` to `outDir`. Returns warnings, for the build to print; throws on what would break a page. */
export function buildPhotos(srcDir, outDir, cacheRoot) {
  const warnings = [];
  if (!fs.existsSync(srcDir)) return warnings;
  fs.mkdirSync(outDir, { recursive: true });
  const cache = path.join(cacheRoot, `photos-${MAX}-q${QUALITY}`); // new settings → a fresh cache
  fs.mkdirSync(cache, { recursive: true });
  const files = fs.readdirSync(srcDir).filter((f) => !f.startsWith('.') && fs.statSync(path.join(srcDir, f)).isFile());
  if (files.some((f) => STILL.test(f)) && spawnSync('ffmpeg', ['-version']).error) {
    throw new Error('ffmpeg not found: it converts content/photos/ to JPG (apt install ffmpeg)');
  }

  const seen = new Map();
  for (const f of files) {
    const from = path.join(srcDir, f);
    const name = photoName(f);
    if (seen.has(name)) {
      warnings.push(`photos: ${f} and ${seen.get(name)} both publish as ${name}; ${f} is skipped`);
      continue;
    }
    seen.set(name, f);
    if (!STILL.test(f)) {
      fs.copyFileSync(from, path.join(outDir, f)); // a video, say: published as it is
      continue;
    }
    const cached = path.join(cache, name);
    if (!fs.existsSync(cached) || fs.statSync(cached).mtimeMs < fs.statSync(from).mtimeMs) {
      const r = encode(from, cached);
      if (r.status !== 0) {
        fs.rmSync(cached, { force: true });
        throw new Error(`photos: could not convert ${f}: ${(r.stderr || r.error?.message || '').trim().split('\n').at(-1)}`);
      }
      // A JPEG that was already small and upright can come out bigger re-encoded: keep it as it was,
      // less its metadata.
      if (/\.jpe?g$/i.test(f)) {
        const orig = fs.readFileSync(from);
        const stripped = stripExif(orig);
        const isJpeg = orig[0] === 0xff && orig[1] === 0xd8; // by its bytes: a .jpg can be a WebP inside
        if (isJpeg && stripped.length < fs.statSync(cached).size && exifOrientation(orig) === 1 && Math.max(...dims(from)) <= MAX) {
          fs.writeFileSync(cached, stripped);
        }
      }
    }
    fs.copyFileSync(cached, path.join(outDir, name));
  }
  return warnings;
}
