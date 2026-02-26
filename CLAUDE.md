# CLAUDE.md — AI Assistant Guide for RHLOS

## Project Overview

**RHLOS (RHL-OS)** is a personal health, habits, and productivity tracking Progressive Web App (PWA). It is a single-page application written in **vanilla JavaScript** (ES6, no framework) with a modular IIFE architecture. The UI is entirely in **Dutch (nl-NL)**.

- **Hosting**: GitHub Pages (static files, no server)
- **Auth**: Firebase Google OAuth
- **Data**: LocalStorage (primary) with Firestore cloud sync (secondary)
- **PWA**: Service Worker with cache-first strategy (current version: `rhlos-v14` in `sw.js`)

## Repository Structure

```
RHLOS/
├── index.html              # Single HTML file — entire app shell and DOM
├── manifest.json           # PWA manifest (name, icons, theme)
├── sw.js                   # Service Worker — caching and offline support
├── css/
│   ├── style.css           # Main styles + dark forest theme
│   ├── habits.css          # Habits module styles
│   ├── work.css            # Work/tasks module styles
│   └── ov.css              # OV departure board styles
├── js/
│   ├── firebase-config.js  # Firebase SDK initialization
│   ├── auth.js             # Google sign-in/sign-out (Auth module)
│   ├── db.js               # Health data layer (DB module) — LocalStorage CRUD
│   ├── habits-db.js        # Habits data layer (HabitsDB module)
│   ├── work-db.js          # Work/tasks data layer (WorkDB module)
│   ├── sync.js             # Firestore real-time sync (Sync module)
│   ├── layout.js           # App navigation and initialization (Layout module)
│   ├── app.js              # Health tracking UI (App module) — weights, BP, sleep, gym, nutrition
│   ├── habits-app.js       # Habits tracking UI (HabitsApp module)
│   ├── homepage.js         # Dashboard/launcher home page (Homepage module)
│   ├── 5mj-app.js          # Five-Minute Journal UI (FiveMJ module)
│   ├── weekly-review.js    # Weekly review/reflection (WeeklyReview module)
│   ├── work-quick-add.js   # Quick task entry (WorkQuickAdd module)
│   ├── ov-app.js           # Public transport departures (OVApp module)
│   ├── export.js           # CSV/PDF export (Export module)
│   └── streak-celebration.js # Streak animation effects
└── icons/                  # PWA icons (72px–512px) + SVG source
```

## Architecture

### Module Pattern

Every JS module uses the **revealing module pattern** via IIFE:

```javascript
const ModuleName = (() => {
    // Private state and helpers (underscore prefix)
    let _state = null;
    function _privateHelper() { }

    // Public API
    function publicMethod() { }

    return { publicMethod };
})();
```

All modules are global singletons loaded via `<script>` tags in `index.html`. There is no build step, no bundler, no transpiler, no package manager.

### Initialization Flow

Entry point: `document.addEventListener('DOMContentLoaded', Layout.init)` in `layout.js`.

`Layout.init()` calls in order:
1. `initializeFirebase()` — Firebase SDK setup
2. `Auth.init()` — starts auth state listener; triggers `Sync.startSync()` on sign-in
3. `goHome()` — show launcher
4. `App.init()`, `HabitsApp.init()`, `FiveMJ.init()`, `WorkQuickAdd.init()`, `OVApp.init()`, `Homepage.init()`
5. `registerServiceWorker()`

### Data Layer

**Offline-first**: LocalStorage is the primary data store. Firestore is a secondary sync destination.

| LocalStorage Key | Format | Description |
|---|---|---|
| `hl_days` | `{ "YYYY-MM-DD": DayEntry }` | Daily health entries |
| `hl_sessions` | `[ WorkoutSession ]` | Completed workout sessions |
| `hl_templates` | `[ WorkoutTemplate ]` | Workout templates (seeded once) |
| `ht_habits` | `[ Habit ]` | Habit definitions |
| `ht_completions` | `{ "YYYY-MM-DD": [...] }` | Daily habit completions |
| `5mj_entries` | `{ "YYYY-MM-DD": Entry }` | Five-Minute Journal entries |
| `dr_entries` | `{ "YYYY-MM-DD": Entry }` | Daily review entries |
| `work_tasks` | `[ Task ]` | Work tasks |

### Firestore Sync

Sync is user-partitioned: `/users/{uid}/{collection}/{docId}`.

Collections defined in `Sync.COLLECTIONS`:
- `health_days`, `health_sessions`, `health_templates`
- `habits`, `habits_completions`
- `journal` (5MJ + daily reviews, prefixed `5mj_` / `dr_`)
- `work_tasks`

**Flow**: DB modules write to LocalStorage, then call `Sync.saveDocument()` / `Sync.deleteDocument()` to push to Firestore. Real-time listeners in `sync.js` pull Firestore changes back to LocalStorage.

**One-time migration**: On first sign-in, `migrateIfNeeded()` uploads all local data to Firestore.

### Navigation

The app uses a launcher-based navigation (not a router). `Layout.openApp(appName)` shows/hides `.app-panel` elements by toggling CSS classes. App names: `health`, `habits`, `5mj`, `work`, `ov`.

## Coding Conventions

### Naming

- **Private functions/state**: `_underscorePrefix` (e.g., `_get()`, `_timer`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `CACHE_NAME`, `COLLECTIONS`, `REFRESH_INTERVAL`)
- **Public functions**: `camelCase` (e.g., `saveDay()`, `openApp()`)
- **Data fields**: `camelCase` (e.g., `durationMinutes`, `bloodPressure`)
- **DOM IDs**: `kebab-case` (e.g., `sync-status`, `panel-habits`)
- **CSS classes**: `kebab-case` (e.g., `app-panel`, `flip-clock`)

### ID Generation

```javascript
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
```

Used across all modules. Some modules use prefixed IDs: `ht_` (habits), `wk_` (work).

### Date Keys

All date-indexed data uses `YYYY-MM-DD` string keys:

```javascript
function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
```

### Error Handling

- Try-catch around all LocalStorage reads/writes with `console.error` + fallback defaults
- Firebase/Firestore operations use `.catch()` with logging; failures don't crash the app
- No thrown exceptions — errors are logged and silently recovered from

### Logging

Scoped console logging with bracketed module prefixes:
```
[Firebase] Initialized successfully
[Auth] User signed in: user@example.com
[Sync] Saved to health_days 2025-01-30
[PWA] Service Worker registered
[SW] Caching static assets
[OV] Proxy 1 failed, trying proxy 2
```

### Async Patterns

- Promise chains (`.then().catch()`) — no async/await in UI modules
- `sync.js` uses `async/await` for migration logic
- Firestore batch writes for bulk operations

### DOM Manipulation

- Direct `document.getElementById()` and `element.querySelector()`
- Visibility via CSS class toggling: `.classList.add('active')`, `.classList.remove('hidden')`
- Content rendering via `element.innerHTML` with template literals

## Key Data Structures

### DayEntry (health)
```javascript
{
    date: "YYYY-MM-DD",
    weights: [{ id, kg, timestamp }],
    bloodPressure: [{ id, systolic, diastolic, pulse, moment, timestamp }],
    sleepEntries: [{ id, hours, interrupted, note, location, timestamp }],
    gymSessions: [{ id, type, durationMinutes, note, km, timestamp }],
    drinks: [{ id, coffee, decaf, alcohol, alcoholGlasses, waterAmount, timestamp }],
    nutrition: [{ id, ontbijt, tussen1, lunch, tussen2, diner, tussen3, timestamp }],
    notes: ""
}
```

### Habit
```javascript
{
    id: "ht_...",
    name: "Meditatie",
    icon: "🧘",
    color: "#007aff",
    category: "Mindfulness",
    goal: { frequency: "daily", count: 1 },
    createdAt: "ISO8601",
    archived: false,
    order: 0
}
```

## Development Workflow

### No Build Step

This is a static site — edit files directly and open `index.html` in a browser or deploy to GitHub Pages. There is no `npm`, no `package.json`, no build command.

### Service Worker Updates

When changing any cached file, **bump the cache version** in `sw.js`:
```javascript
const CACHE_NAME = 'rhlos-v14';  // increment this
```
Also add any new files to the `STATIC_ASSETS` array.

### Adding a New Module

1. Create `js/new-module.js` using the IIFE revealing module pattern
2. Add a `<script>` tag in `index.html` (order matters — dependencies first)
3. Add corresponding CSS in `css/` if needed, link it in `index.html`
4. Add a new `.app-panel` section in `index.html` if it needs its own view
5. Register it in `Layout.init()` and handle it in `Layout.openApp()`
6. Add the files to `STATIC_ASSETS` in `sw.js`
7. Bump the SW cache version

### Adding Firestore Sync for New Data

1. Add a collection name to `Sync.COLLECTIONS`
2. Add a real-time listener in `setupRealtimeListeners()`
3. Add migration logic in `uploadLocalData()`
4. Call `Sync.saveDocument()` / `Sync.deleteDocument()` from the DB module

## Important Notes

- **Language**: All user-facing text is in Dutch. Keep this consistent.
- **No TypeScript**: Pure JavaScript. Do not introduce TypeScript.
- **No npm/bundler**: Do not add package.json or a build pipeline.
- **Offline-first**: Always write to LocalStorage first, then sync to Firestore.
- **Firebase config is committed**: The Firebase API key is a client-side key scoped to the project; this is intentional for a public web app.
- **Mobile-first PWA**: Test changes on mobile viewports. The app detects standalone PWA mode and mobile user agents.
- **CSS variables**: The dark forest theme uses CSS custom properties. Respect the existing theme system.
- **No tests**: There is no test suite. Verify changes manually in the browser.
- **No CI/CD**: Deployment is via GitHub Pages from the main branch.
