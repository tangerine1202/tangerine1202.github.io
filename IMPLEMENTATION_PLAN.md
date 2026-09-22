# Play variant — implementation plan

Spec: `../meanwhile-play.md`. Delete this file when every stage is Complete.

## Stage 1: Play variant plumbing + Now accent
**Goal**: `node build.mjs --theme=play` → `dist-play/` (style.css + motion.css + play.css + transitions.js + empty focus.js/dots.js shells); `npm run dev` serves :4324; the site's accent colour follows the main context of the last two weeks.
**Success Criteria**: The three existing dist dirs only gain harmless `data-cid`/`data-cids`/`--c` attributes (`diff -r`); `dist-play/index.html` links `play.css` and has `style="--now:#…"`; nav underline and the dot beside the brand use that colour; README table has a fourth row.
**Tests**: `test/play.test.mjs`: `model.now` (3 cases), layout emits `--now` only with `nowAccent`, `year(play)` links `play.css`; `npm test` green.
**Status**: Complete

## Stage 2: Ink & Focus
**Goal**: "Only what you look at has colour": hovering/focusing/tapping any context source blooms that context's dots by date and dims the rest; grey contexts turn ink when focused; Year lane hover filters the 365 grid to that context; Day/Log other groups recede; Context page focuses itself.
**Success Criteria**: Manual list in spec 3-1 passes; Chrome and Safari agree; two-step tap on `hover: none` doesn't affect desktop; reduced motion still shows focus (no animation).
**Tests**: `bloomDelays`, `colorOf` pure functions; `ctxName`/`weeksGrid`/`prose` hooks present; existing tests unchanged and green.
**Status**: Complete

## Stage 3: Year Ridge
**Goal**: Year lanes and Context traces grow a 7-day density ridge, drawn left→right by the existing `vt-draw`; "when I did this densely" is visible at a glance.
**Success Criteria**: Lane svg 28px tall, ridge 28% opacity, ticks on top; only the play theme has `class="ridge"`; no ridge past today; no horizontal scroll on phone width.
**Tests**: `test/ridge.test.mjs`: `density` boundaries (year start/end, single day), `ridgePath` format, `year(plain)` has no ridge.
**Status**: Complete

## Stage 4: Prose Peek
**Goal**: Hovering a Home prose link grows that context's mini trace and "N days · from – to"; clicking flies the small line into the Context page's big line.
**Success Criteria**: Every Home link has a peek; text for unknown contexts has none; peek doesn't push the paragraph or hide under the next one; line position is continuous through the View Transition; reduced motion shows the peek instantly.
**Tests**: `home(play)` contains `lk-trace` with the right day count; `home(plain)` doesn't; unknown context stays plain text.
**Status**: Complete

## Stage 5: Dots engine — removed
**Goal**: A canvas engine that gathered a context's dots into a line before leaving (motion 3-1), plus the "Let the dots go" easter egg.
**Tried and removed**: all three targets were built and then cut after the user saw them: gathering into the ribbon on Log ("too messy"), the easter egg and the dot beside the brand (not needed), and gathering into the Year lane (not wanted). `dots.js` and its tests are deleted; only Almanac's 150ms light-up-and-leave remains. See `../meanwhile-play.md` 1-2, 1-5 and section 2.
**Status**: Complete

## Stage 6 (optional): Context Playhead
**Goal**: The Context page's trace is sticky; scrolling the list moves a cursor on the line to the date being read (compute from `.row[data-span]` like `ribbon.js`).
**Success Criteria**: Cursor = `dayFraction` of the row nearest the viewport centre; smooth (rAF-throttled); sticky bar doesn't cover titles on phones.
**Tests**: Position maths as a pure function with tests; the rest manual.
**Status**: Not Started
