// vault → content/daily-log.md → imported into content/log.json, then build.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import config from './meanwhile.config.mjs';
import { VARIANTS } from './variants.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));

if (!fs.existsSync(config.vaultLog)) {
  console.error(`✗ Log not found at ${config.vaultLog}\n  Set "vaultLog" in meanwhile.config.mjs or MEANWHILE_VAULT_LOG.`);
  process.exit(1);
}
fs.mkdirSync(path.join(root, path.dirname(config.log)), { recursive: true });
fs.copyFileSync(config.vaultLog, path.join(root, config.log));
console.log(`✓ copied ${config.vaultLog} → ${config.log}`);
const imported = spawnSync(process.execPath, ['logdata.mjs', 'import', 'daily-log', config.log], { cwd: root, stdio: 'inherit' });
if (imported.status !== 0) process.exit(imported.status ?? 1);
if (config.media && fs.existsSync(config.vaultMedia)) {
  fs.copyFileSync(config.vaultMedia, path.join(root, config.media));
  console.log(`✓ copied ${config.vaultMedia} → ${config.media}`);
}

for (const [args] of VARIANTS) {
  const r = spawnSync(process.execPath, ['build.mjs', ...args], { cwd: root, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
