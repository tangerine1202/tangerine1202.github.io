// Dev server: one port per version (see variants.mjs). Rebuilds all of them when files change.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { VARIANTS } from './variants.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.pdf': 'application/pdf', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif',
};

// A fresh process per build, so changes to src/ and the config are picked up.
// process.execPath is this Node binary, so this works even when `node` isn't on the shell's PATH.
function build() {
  for (const [args] of VARIANTS) spawnSync(process.execPath, ['build.mjs', ...args], { cwd: root, stdio: 'inherit' });
}

// Only the docker bridge, like the log editor: Caddy (alans.dev/meanwhile, behind Access) is the way in.
// Listening on every interface would put the unreleased log on the open internet.
const HOST = '172.17.0.1';

function serve(dir, port, name) {
  http.createServer((req, res) => {
    let rel;
    try {
      rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    } catch {
      res.writeHead(400).end('Bad request');
      return;
    }
    let file = path.join(dir, path.normalize(rel));
    if (!file.startsWith(dir)) {
      res.writeHead(403).end();
      return;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      if (!rel.endsWith('/')) {
        res.writeHead(301, { Location: `${req.url}/` }).end();
        return;
      }
      file = path.join(file, 'index.html');
    }
    let status = 200;
    if (!fs.existsSync(file)) {
      // Like production: the site's own 404 page, with a 404 status.
      file = path.join(dir, '404.html');
      if (!fs.existsSync(file)) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end(`Not found: ${rel}`);
        return;
      }
      status = 404;
    }
    res.writeHead(status, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  }).listen(port, HOST, () => console.log(`  ${name.padEnd(10)} http://${HOST}:${port}`));
}

build();
for (const [, port, name, dir] of VARIANTS) serve(path.join(root, dir), port, name);

let timer = null;
const rebuild = () => {
  clearTimeout(timer);
  timer = setTimeout(build, 120);
};
for (const target of ['src', 'content', 'meanwhile.config.mjs']) {
  fs.watch(path.join(root, target), { recursive: true }, rebuild);
}
