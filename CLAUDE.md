# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

RHL-OS is a personal health, habits, and productivity tracker built as a vanilla-JS Progressive Web App. There is **no build system, no package.json, no test suite, and no linter** — just static files (`index.html`, `css/`, `js/`, `sw.js`, `manifest.json`) served directly. Hosted on GitHub Pages, hence all paths in `sw.js` and `index.html` are relative.

UI strings are in **Dutch** (`<html lang="nl">`, `toLocaleDateString('nl-NL', ...)`). Preserve the language when editing user-facing text.

## Running / "Building"

- **Run locally:** open `index.html` directly in a browser, or serve the repo root with any static server (e.g. `python3 -m http.server`). No install step.
- **Tests / lint:** none exist. Verify changes by exercising the relevant app panel in the browser and checking the console for `[Sync]`, `[Auth]`, `[Firebase]`, `[SW]`, `[PWA]` log lines.
- **Cache busting after edits:** see "Service Worker" below — required, otherwise users will keep getting the old version.

## Architecture

### Single-page layout with panel switching

`index.html` contains every screen. `js/layout.js` swaps which `.app-panel` is active via `Layout.openApp(name)` / `Layout.goHome()`. The five apps are: `habits`, `health`, `5mj` (journal), `work` (tasks), `ov` (Amsterdam transit). The launcher (home) shows a clock/weather/quote and tile grid; the global header lives outside the panels.

`Layout.init` (fired on `DOMContentLoaded`) initializes Firebase, then each app module's `init()`, then registers the service worker. Adding a new app means: new `panel-<name>` in `index.html`, new `<name>-app.js` module, new launcher tile, an entry in `Layout.openApp`'s render dispatch, and a `<script>` tag in `index.html`.

### Module pattern

Every JS file is an IIFE that assigns to a global: `const Foo = (() => { ... return { ... }; })();`. There is no module system, no bundler. Inter-module calls happen via these globals (`HabitsApp`, `HabitsDB`, `App`, `DB`, `WorkDB`, `WorkQuickAdd`, `FiveMJ`, `WeeklyReview`, `Homepage`, `OVApp`, `Sync`, `Auth`, `Utils`, `ExportService`). Load order in `index.html` matters — Firebase scripts and `firebase-config.js`/`auth.js`/`sync.js` must come before the DB/app modules that call `Sync.saveDocument`.

### Per-app file pairs

Each feature app has a data layer + UI controller pair:

| App     | DB module        | UI module             | localStorage keys                              |
|---------|------------------|-----------------------|------------------------------------------------|
| Health  | `js/db.js`       | `js/app.js`           | `hl_days`, `hl_sessions`, `hl_templates`       |
| Habits  | `js/habits-db.js`| `js/habits-app.js`    | `ht_habits`, `ht_completions`                  |
| Journal | (in app module)  | `js/5mj-app.js`       | `5mj_entries`, `dr_entries`                    |
| Work    | `js/work-db.js`  | `js/work-quick-add.js`| `wk_tasks`, `wk_clients`, `wk_projects`        |
| Weekly  | (in app module)  | `js/weekly-review.js` | `wr_checklist`, `wr_last_completed`, `wr_summaries` |

`js/utils.js` (`Utils.dateKey`, `Utils.dateRange`, `Utils.escapeHtml`) holds the shared helpers. Several modules still have local copies of `dateKey` etc. — prefer `Utils` when adding new code.

### Data layer + cloud sync

`localStorage` is the **source of truth on the client**. DB modules read/write JSON blobs under the keys above. Each mutating operation also calls `Sync.saveDocument(collection, docId, data)` (or `Sync.deleteDocument`) — these are no-ops when the user is signed out, so DB modules work offline-first.

`js/sync.js` mirrors localStorage to Firestore at `users/{uid}/{collection}/{docId}`. Collection names are listed in `Sync.COLLECTIONS`. On sign-in:
1. `migrateIfNeeded()` checks if Firestore is empty and uploads local data once.
2. `setupRealtimeListeners()` opens an `onSnapshot` per collection. Incoming snapshots are written back to localStorage via `safeSetLocal()`, which **refuses to overwrite a non-empty local value with an empty remote value** and instead re-uploads from local — this guard exists to prevent data loss and must not be removed.
3. After a snapshot updates local data, the relevant UI module's render function is called to refresh the panel.

When you add a new persisted field, you must update: the DB module's read/write, the migration uploader in `sync.js` (`uploadLocalData`), the realtime listener in `sync.js` (`setupRealtimeListeners`), and the per-key branch in `uploadCollectionFromLocal`.

Firebase config (`js/firebase-config.js`) ships a public web API key — that's expected for Firebase web SDK; access control is enforced by Firestore security rules on the project, not by hiding the key.

### Service Worker (`sw.js`)

Network-first for HTML/JS/CSS, cache-first for static assets. Two things to remember when editing:

1. **Bump `CACHE_NAME`** (currently `'rhlos-v25'`) on every change that touches cached files. The activate handler deletes any cache whose name doesn't match, which is what forces clients to pick up the new bundle.
2. **Add new files to `STATIC_ASSETS`** if they should be available offline.

`index.html` also uses `?v=N` query strings on `<script>`/`<link>` tags as a secondary cache-buster — bump these (or the cache name) when shipping changes that users need to see immediately.

### Security note

All user-supplied strings rendered into HTML must go through `Utils.escapeHtml(...)` (see commit `48458b5`). Several render functions build HTML via template strings and concatenation, so this is easy to get wrong — when adding a new field that can contain user text, escape it at the interpolation site.

## Branch convention

Development happens on feature branches (the active task branch is `claude/add-claude-documentation-m95fL`). Commit messages in this repo are short imperative summaries ("Fix XSS: escape all user input in HTML templates", "Deduplicate _dateRange() and _dateKey() into shared Utils module") — match that style.
