import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { photoName, exifOrientation, stripExif, jpegSize, buildPhotos } from '../src/photos.mjs';

test('a still image publishes as .jpg; anything else keeps its name', () => {
  assert.equal(photoName('a.png'), 'a.jpg');
  assert.equal(photoName('b.JPEG'), 'b.jpg');
  assert.equal(photoName('c.webp'), 'c.jpg');
  assert.equal(photoName('clip.mp4'), 'clip.mp4');
});

/** A minimal JPEG header with one EXIF tag: orientation. */
function exifJpeg(orientation, le = false) {
  const tiff = Buffer.alloc(26);
  tiff.write(le ? 'II' : 'MM', 0, 'latin1');
  const w16 = (v, o) => (le ? tiff.writeUInt16LE(v, o) : tiff.writeUInt16BE(v, o));
  const w32 = (v, o) => (le ? tiff.writeUInt32LE(v, o) : tiff.writeUInt32BE(v, o));
  w16(42, 2); w32(8, 4); w16(1, 8); // one entry in IFD0
  w16(0x0112, 10); w16(3, 12); w32(1, 14); w16(orientation, 18);
  const app1 = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
  const len = Buffer.alloc(2); len.writeUInt16BE(app1.length + 2);
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe1]), len, app1, Buffer.from([0xff, 0xda])]);
}

test('the EXIF orientation is read in either byte order, and 1 when there is none', () => {
  assert.equal(exifOrientation(exifJpeg(6)), 6);
  assert.equal(exifOrientation(exifJpeg(8, true)), 8);
  assert.equal(exifOrientation(Buffer.from([0xff, 0xd8, 0xff, 0xda])), 1);
  assert.equal(exifOrientation(Buffer.from('not a jpeg')), 1);
});

test('a size is only read from a JPEG', () => {
  assert.equal(jpegSize(Buffer.from('not a jpeg')), null);
});

test('stripping takes out the EXIF segment and nothing else', () => {
  const jpg = exifJpeg(6);
  const out = stripExif(jpg);
  assert.equal(exifOrientation(out), 1);
  assert.ok(!out.includes('Exif'));
  assert.deepEqual([...out], [0xff, 0xd8, 0xff, 0xda]);
});

const hasFfmpeg = !spawnSync('ffmpeg', ['-version']).error;
const ff = (args) => spawnSync('ffmpeg', ['-v', 'error', '-y', ...args]);
const size = (f) => spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', f], { encoding: 'utf8' }).stdout.trim();
const pixel = (f, x, y) => [...spawnSync('ffmpeg', ['-v', 'error', '-i', f, '-vf', `crop=w=2:h=2:x=${x}:y=${y}`, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1e6 }).stdout.subarray(0, 3)];

test('the build converts, shrinks, flattens and caches; videos pass through', { skip: !hasFfmpeg && 'no ffmpeg' }, () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'photos-'));
  const src = path.join(tmp, 'src');
  const out = path.join(tmp, 'out');
  fs.mkdirSync(src);
  // A transparent PNG with an opaque blue box, and a JPEG far wider than the limit.
  ff(['-f', 'lavfi', '-i', 'color=red@0.0:s=300x200,format=rgba', '-f', 'lavfi', '-i', 'color=blue:s=100x100,format=rgba',
    '-filter_complex', '[0][1]overlay=50:50', '-frames:v', '1', path.join(src, 'clear.png')]);
  ff(['-f', 'lavfi', '-i', 'color=gray:s=4000x1000', '-frames:v', '1', path.join(src, 'wide.jpg')]);
  fs.writeFileSync(path.join(src, 'clip.mp4'), 'not really a video');

  assert.deepEqual(buildPhotos(src, out, path.join(tmp, 'cache')), []);
  assert.deepEqual(fs.readdirSync(out).sort(), ['clear.jpg', 'clip.mp4', 'wide.jpg']);
  assert.equal(size(path.join(out, 'wide.jpg')), '2000,500');
  assert.deepEqual(jpegSize(fs.readFileSync(path.join(out, 'wide.jpg'))), { w: 2000, h: 500 }); // read from the header, as ffprobe does
  assert.equal(size(path.join(out, 'clear.jpg')), '300,200'); // never enlarged
  assert.ok(pixel(path.join(out, 'clear.jpg'), 4, 4).every((c) => c > 245), 'transparent is white, not black');
  assert.ok(pixel(path.join(out, 'clear.jpg'), 100, 100)[2] > 200, 'the box stays blue');

  // A second build reuses the cache: the cached file is not written again.
  const cached = fs.readdirSync(path.join(tmp, 'cache')).map((d) => path.join(tmp, 'cache', d, 'wide.jpg'))[0];
  const before = fs.statSync(cached).mtimeMs;
  buildPhotos(src, out, path.join(tmp, 'cache'));
  assert.equal(fs.statSync(cached).mtimeMs, before);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('two files that would publish under one name: the second is skipped, with a warning', { skip: !hasFfmpeg && 'no ffmpeg' }, () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'photos-'));
  const src = path.join(tmp, 'src');
  fs.mkdirSync(src);
  for (const f of ['a.jpg', 'a.png']) ff(['-f', 'lavfi', '-i', 'color=gray:s=10x10', '-frames:v', '1', path.join(src, f)]);
  const warnings = buildPhotos(src, path.join(tmp, 'out'), path.join(tmp, 'cache'));
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /both publish as a\.jpg/);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('a file ffmpeg cannot read stops the build, naming it', { skip: !hasFfmpeg && 'no ffmpeg' }, () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'photos-'));
  const src = path.join(tmp, 'src');
  fs.mkdirSync(src);
  fs.writeFileSync(path.join(src, 'broken.png'), 'not a png');
  assert.throws(() => buildPhotos(src, path.join(tmp, 'out'), path.join(tmp, 'cache')), /could not convert broken\.png/);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('a small JPEG that would grow when re-encoded is kept as it was, less its EXIF', { skip: !hasFfmpeg && 'no ffmpeg' }, () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'photos-'));
  const src = path.join(tmp, 'src');
  fs.mkdirSync(src);
  // Saved at the worst quality, so re-encoding at ours only adds bytes; then an EXIF block goes in.
  ff(['-f', 'lavfi', '-i', 'testsrc=s=320x240', '-frames:v', '1', '-q:v', '31', path.join(tmp, 'tiny.jpg')]);
  const plain = fs.readFileSync(path.join(tmp, 'tiny.jpg'));
  const app1 = exifJpeg(1).subarray(2, -2);
  fs.writeFileSync(path.join(src, 'tiny.jpg'), Buffer.concat([plain.subarray(0, 2), app1, plain.subarray(2)]));
  buildPhotos(src, path.join(tmp, 'out'), path.join(tmp, 'cache'));
  assert.deepEqual(fs.readFileSync(path.join(tmp, 'out', 'tiny.jpg')), plain);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('a WebP saved with a .jpg name is still converted, never published as it was', { skip: !hasFfmpeg && 'no ffmpeg' }, () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'photos-'));
  const src = path.join(tmp, 'src');
  fs.mkdirSync(src);
  ff(['-f', 'lavfi', '-i', 'testsrc=s=320x240', '-frames:v', '1', '-q:v', '5', '-f', 'webp', path.join(src, 'lies.jpg')]);
  buildPhotos(src, path.join(tmp, 'out'), path.join(tmp, 'cache'));
  assert.deepEqual(jpegSize(fs.readFileSync(path.join(tmp, 'out', 'lies.jpg'))), { w: 320, h: 240 });
  fs.rmSync(tmp, { recursive: true, force: true });
});
