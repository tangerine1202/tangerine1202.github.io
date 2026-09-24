import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export default {
  // Where `npm run sync` copies the log from. Override with MEANWHILE_VAULT_LOG.
  vaultLog: process.env.MEANWHILE_VAULT_LOG
    ?? path.join(os.homedir(), 'Library/Mobile Documents/iCloud~md~obsidian/Documents/Vault/daily-log.md'),
  log: 'content/daily-log.md',
  // The media log (books, films, …) sits beside this package in the repo. Override with MEANWHILE_VAULT_MEDIA.
  vaultMedia: process.env.MEANWHILE_VAULT_MEDIA ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'media-log.md'),
  media: 'content/media-log.md',
  // One file per project for the Vibe page. A missing folder is not an error.
  vibe: 'content/vibe',
  base: process.env.MEANWHILE_BASE ?? '/',
  today: null,
  timeZone: 'Asia/Taipei',

  // Order here is the order of the legend, the Year lanes and every dot row.
  colors: {
    'Japanese': '#E69F00',
    'Job Preparation': '#56B4E9',
    'T-RO Revision': '#0072B2',
    '航警替代役': '#D55E00',
    'Reading': '#009E73',
  },
  other: '#8E8E89',
  uncategorized: '#CFCFCA',

  // Switches for the parts of the site that are experiments.
  // vibeDotTrace: the last 90 days of a project's context under its Vibe card.
  // See the README, "Removing the Vibe dot trace", for turning it off and for deleting it.
  features: {
    vibeDotTrace: false,
  },

  privateTag: '#private',
  privateContexts: [],
  laneMinDays: 3,

  // Last chance to change a line after parsing. `text` is still raw here. Return null to drop it.
  mapEntry(e) {
    // [[media-log]] marks a reading line: led by it, the line is Reading; after another context,
    // it is only a tag and leaves the words.
    if (e.context === 'media-log') return { ...e, context: 'Reading' };
    if (e.text.includes('[[media-log]]')) e = { ...e, text: e.text.replace(/\[\[media-log\]\]\s*/g, '') };
    return e;
  },
};
