# Meanwhile — notes for the AI

## Updating the log data from the daily log

The site's log is built from `content/log.json` (see README, "The log's data"). When the user says the
daily log changed (a new `content/daily-log.md`, an export, "update the log"), converting it is your job:

1. `node logdata.mjs import daily-log content/daily-log.md` — replaces the `daily-log` source only. Never
   touch other sources or `manual` entries, and never edit `content/daily-log.md` yourself: it is the
   user's, and it comes back from the vault on the next export anyway.
2. Read what the import printed: the entry count before → after, and any warnings (an unclosed `[[`, a line
   that isn't a list item). Compare the count with what the diff of the daily log suggests.
3. Check what a script can't: reading lines with no `[[media-log]]` tag (they land in no context, not
   Reading), a context spelled a new way (`[[Job preparation]]` beside `[[Job Preparation]]` makes two),
   and health or other personal lines that aren't marked `#private` (the README's "Before deploying").
   Report these to the user with line numbers and let them fix the log; don't paper over them in data.
4. `node --test test/*.test.mjs`, then check the build: `MEANWHILE_BASE=/meanwhile/ node build.mjs`
   (the running dev server rebuilds by itself when `content/` changes).

`node` may need to be `~/.nvm/versions/node/v22.16.0/bin/node` in a non-interactive shell.
