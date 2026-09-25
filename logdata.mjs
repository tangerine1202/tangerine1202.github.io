// Manage content/log.json, the data the site's log is built from (see src/logdata.mjs).
//
//   node logdata.mjs import <source> <file.md>   replace one source with a markdown log (the daily log is "daily-log")
//   node logdata.mjs list [--date D] [--source S] [--context C]
//   node logdata.mjs add <YYYY-MM-DD> <text> [--context C] [--source S]   (source defaults to "manual")
//   node logdata.mjs edit <id> [--date D] [--context C] [--text T]
//   node logdata.mjs rm <id>
//   node logdata.mjs serve [--host 172.17.0.1] [--port 4325]   the edit page, for Caddy to put a password in front of
//
// Only one place changes the file at a time here; the dev server (serve.mjs) sees each save and rebuilds the site.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from './meanwhile.config.mjs';
import { load, save, importLog, addEntry, updateEntry, removeEntry } from './src/logdata.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(root, config.data);

function flags(args) {
  const out = { _: [] };
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) out[args[i].slice(2)] = args[++i];
    else out._.push(args[i]);
  }
  return out;
}

const show = (e) => `${e.id.padEnd(22)} ${e.date}  ${(e.context ?? '—').padEnd(16)} ${e.text}  [${e.source}]`;

// ── the edit page ────────────────────────────────────

function serve({ host = '172.17.0.1', port = 4325 } = {}) {
  const page = fs.readFileSync(path.join(root, 'src/edit-page.html'));
  const json = (res, status, body) => res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }).end(JSON.stringify(body));

  function body(req) {
    return new Promise((resolve, reject) => {
      let size = 0;
      const parts = [];
      req.on('data', (c) => {
        size += c.length;
        if (size > 64 * 1024) { reject(new Error('request too large')); req.destroy(); }
        else parts.push(c);
      });
      req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(parts).toString('utf8') || '{}')); } catch { reject(new Error('not JSON')); } });
    });
  }

  const server = http.createServer(async (req, res) => {
    // Paths are relative to wherever Caddy mounts this (it strips its own prefix).
    const url = new URL(req.url, 'http://x');
    const route = url.pathname.replace(/^\/+/, '');
    try {
      if (req.method === 'GET' && (route === '' || route === 'index.html')) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(page);
        return;
      }
      if (req.method === 'GET' && route === 'api/entries') {
        const data = load(FILE);
        const sources = [...new Set(data.entries.map((e) => e.source))].sort();
        const contexts = [...new Set([...Object.keys(config.colors), ...data.entries.map((e) => e.context).filter(Boolean)])].sort();
        const imported = [...new Set(data.entries.filter((e) => e.imported).map((e) => e.source))];
        json(res, 200, { entries: data.entries, sources: sources.includes('manual') ? sources : [...sources, 'manual'], contexts, imported });
        return;
      }
      const m = route.match(/^api\/entries(?:\/([^/]+))?$/);
      if (!m || !['POST', 'PUT', 'DELETE'].includes(req.method)) { json(res, 404, { error: 'not found' }); return; }
      // A change needs this header, which a form or link on another site can't send: a guard against
      // a page elsewhere using the browser's remembered password to edit behind your back.
      if (req.headers['x-meanwhile-edit'] !== '1') { json(res, 403, { error: 'missing x-meanwhile-edit header' }); return; }
      const id = m[1] && decodeURIComponent(m[1]);
      const data = load(FILE);
      let result;
      if (req.method === 'POST' && !id) result = addEntry(data, await body(req));
      else if (req.method === 'PUT' && id) result = updateEntry(data, id, await body(req));
      else if (req.method === 'DELETE' && id) result = removeEntry(data, id);
      else { json(res, 404, { error: 'not found' }); return; }
      save(FILE, result.data);
      json(res, 200, { ok: true, entry: result.entry ?? null });
    } catch (err) {
      json(res, 400, { error: err.message });
    }
  });
  server.listen(Number(port), host, () => console.log(`  log data editor  http://${host}:${port}/  (${path.relative(root, FILE)})`));
}

// ── the commands ─────────────────────────────────────

const [cmd, ...rest] = process.argv.slice(2);
const f = flags(rest);
try {
  if (cmd === 'import') {
    const [source, file] = f._;
    if (!source || !file) throw new Error('usage: import <source> <file.md>');
    const r = importLog(load(FILE), source, fs.readFileSync(file, 'utf8'), config);
    save(FILE, r.data);
    for (const w of r.warnings) console.warn(`  ! ${file} ${w}`);
    console.log(`✓ ${source}: ${r.before} → ${r.after} entries (${r.data.entries.length} in all) → ${path.relative(root, FILE)}`);
  } else if (cmd === 'list') {
    const shown = load(FILE).entries.filter((e) => (!f.date || e.date === f.date) && (!f.source || e.source === f.source) && (!f.context || e.context === f.context));
    for (const e of shown) console.log(show(e));
    console.log(`${shown.length} entries`);
  } else if (cmd === 'add') {
    const [date, ...words] = f._;
    const r = addEntry(load(FILE), { date, text: words.join(' '), context: f.context, source: f.source });
    save(FILE, r.data);
    console.log(`✓ added ${show(r.entry)}`);
  } else if (cmd === 'edit') {
    const [id] = f._;
    const change = Object.fromEntries(['date', 'context', 'text'].filter((k) => f[k] !== undefined).map((k) => [k, f[k]]));
    const r = updateEntry(load(FILE), id, change);
    save(FILE, r.data);
    console.log(`✓ ${show(r.entry)}`);
  } else if (cmd === 'rm') {
    const [id] = f._;
    save(FILE, removeEntry(load(FILE), id).data);
    console.log(`✓ removed ${id}`);
  } else if (cmd === 'serve') {
    serve({ host: f.host, port: f.port });
  } else {
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'));
  }
} catch (err) {
  console.error(`✗ ${err.message}`);
  process.exit(1);
}
