# RHLOS Test Coverage Analysis

## Current State: 0% Coverage

The RHLOS codebase currently has **zero automated tests**. There are no test files, no testing frameworks, no test runners, and no CI/CD pipelines. All quality assurance is manual.

### Codebase Summary

| Module | Lines | Complexity | Testability |
|--------|-------|------------|-------------|
| `js/db.js` | 598 | High | **High** — pure data logic, minimal DOM |
| `js/habits-db.js` | 558 | High | **High** — pure data logic, complex streak math |
| `js/work-db.js` | 537 | Medium | **High** — pure CRUD + filtering logic |
| `js/weekly-review.js` | 629 | High | **Medium** — aggregation logic + DOM rendering |
| `js/export.js` | 534 | Medium | **Medium** — CSV generation is testable, PDF less so |
| `js/sync.js` | 338 | Medium | **Low** — tightly coupled to Firebase |
| `js/app.js` | 1,111 | High | **Low** — heavy DOM manipulation |
| `js/habits-app.js` | 761 | High | **Low** — heavy DOM manipulation |
| `js/homepage.js` | 304 | Low | **Low** — mostly rendering |
| `sw.js` | 131 | Low | **Medium** — testable with service worker mocks |

---

## Priority 1: Data Layer Modules (Highest Impact)

These modules are the backbone of the app. Bugs here corrupt user data. They are also the easiest to test since they only depend on `localStorage`.

### 1.1 `js/db.js` — Health Data Layer

**Why test:** Every health metric (weight, sleep, blood pressure, gym, nutrition, drinks) passes through this module. A bug in `addWeight()` or `_migrateDay()` silently corrupts data.

**Specific functions to test:**

| Function | Risk | What to test |
|----------|------|--------------|
| `_migrateDay()` | **Critical** | Old single-value → array migration. Edge cases: partial migrations, already-migrated data, empty days |
| `addWeight()` | High | Rejects `NaN`, `0`, negative values. Creates proper `{ id, kg, timestamp }` shape |
| `addBloodPressure()` | High | Validates `systolic`, `diastolic`, `pulse` as integers. Handles `addBloodPressureSkipped()` |
| `addSleep()` | High | Rejects invalid hours. Handles optional `location` defaulting to `'Thuis'` |
| `addGym()` | High | Special case: `'Niet gegaan'` skips duration validation. Handles optional `km` |
| `addDrinks()` | Medium | `water2L` backward-compat field derived from `waterAmount`. Alcohol conditional fields |
| `upsertNutrition()` | Medium | Updates last entry vs. creates new. Edge case: empty nutrition array |
| `getDaysInRange()` | Medium | String date comparison correctness. Sort order |
| `getDaysForMonth()` | Medium | Prefix matching for `"YYYY-MM"`. Descending sort |
| `todayKey()` | Low | Zero-padded month/day formatting |
| `startSession()` | High | Template lookup, exercise/set scaffolding, session persistence |
| `completeSession()` | Medium | Sets `completedAt` timestamp |
| `getRecentSessions()` | Low | Sort order + limit |

**Example test cases for `_migrateDay()`:**
```
- Day with old `weight: { kg: 80 }` → migrated to `weights: [{ id, kg: 80 }]`
- Day already in new format → no changes, returns false
- Day with no fields at all → all arrays initialized to []
- Day with partial migration (has `weights` but no `sleepEntries`) → fills missing arrays
```

### 1.2 `js/habits-db.js` — Habit Tracking Data Layer

**Why test:** The streak calculation algorithm is the most complex pure logic in the codebase (~150 lines). Users see their streak counts daily — a wrong number directly erodes trust.

**Specific functions to test:**

| Function | Risk | What to test |
|----------|------|--------------|
| `_calculateDailyStreak()` | **Critical** | Current streak walks backward from today. Skipped completions excluded. Longest streak scans all dates. Gap detection |
| `_calculateWeeklyStreak()` | **Critical** | ISO week grouping. Current week fallback to previous week. Longest streak across weeks |
| `_calculateMonthlyStreak()` | **Critical** | Month grouping. Current month fallback |
| `getCompletionRate()` | High | Daily: days-completed / total-days. Weekly/monthly: total completions / expected. `'all'` period uses `createdAt` |
| `addCompletion()` | Medium | Creates `{ id, habitId, timestamp, note, status }`. Default status is `'done'` |
| `removeLastCompletion()` | Medium | Uses `findLastIndex`. Deletes from Firestore when array empties |
| `getCompletionsForHabitInRange()` | Medium | String date range filtering |
| `migrate()` | High | Adds new default habits. Removes old ones (`'Gym'`). Restores archived habits. Preserves order |
| `seedDefaults()` | Medium | Only runs when no habits exist |
| `dateKey()` | Low | Accepts both Date objects and strings |

**Example test cases for `_calculateDailyStreak()`:**
```
- 5 consecutive days completed → current streak = 5
- Today not completed, yesterday was → starts from yesterday, streak includes yesterday
- Gap of 1 day in middle → current streak broken, longest captures the longer segment
- Completions with status 'skipped' → not counted toward streak
- Goal count = 2, only 1 completion on a day → day not counted as met
- No completions at all → { current: 0, longest: 0 }
```

### 1.3 `js/work-db.js` — Tasks/Projects Data Layer

**Why test:** Task management has complex business rules (next-action constraint, recurring tasks, status transitions).

**Specific functions to test:**

| Function | Risk | What to test |
|----------|------|--------------|
| `processRecurringTask()` | **Critical** | Date arithmetic for all 5 recurrence types (`dagelijks`, `wekelijks`, `tweewekelijks`, `maandelijks`, `kwartaal`). Copies all fields except timestamps |
| `_clearNextAction()` | High | Enforces max-1 `nextAction` per project. `excludeTaskId` works |
| `updateTask()` | High | `completedAt` set on transition to `'afgerond'`. Cleared on transition away. `nextAction` constraint enforced |
| `setNextAction()` | High | Toggle behavior. Clears others in same project |
| `_applyFilters()` | Medium | Array filter values vs. scalar filter values. Null/empty filters skipped |
| `moveTasks()` | Medium | Status changes from `'inbox'` to `'gepland'` on move |
| `getTaskStats()` | Medium | Date range filtering on `completedAt`/`createdAt`. Deviation factor calculation |
| `addTask()` | Medium | Default values, `nextAction` constraint enforcement on create |

**Example test cases for `processRecurringTask()`:**
```
- Task with deadline 2026-01-15, recurring 'wekelijks' → new task with deadline 2026-01-22
- Task with recurring 'maandelijks', deadline 2026-01-31 → new task with deadline 2026-02-28 (month rollover)
- Task with recurring 'geen' → returns null
- Task that doesn't exist → returns null
- New task has status 'gepland', completedAt null, new id, new createdAt
```

---

## Priority 2: Business Logic & Aggregation

### 2.1 `js/weekly-review.js` — Week Summary Generation

**Why test:** `generateWeekSummary()` aggregates data from 4+ modules into a single summary object. A mistake in averaging or counting goes unnoticed until users check their weekly report.

**Key functions to test:**

| Function | Risk | What to test |
|----------|------|--------------|
| `generateWeekSummary()` | **Critical** | Correct averages for weight, BP, sleep. Gym type counting. Alcohol aggregation. Habit percentage calculation. Journal day counting |
| `_getMonday()` | Medium | Edge case: Sunday input should give previous Monday. Monday input gives same day |
| `_getISOWeekKey()` | Medium | Year boundary weeks (e.g., Dec 31 may be W01 of next year) |
| `autoGenerateIfNeeded()` | Medium | Only triggers on Monday. Doesn't regenerate existing summaries |
| `_dateRange()` | Low | Inclusive start and end. Single-day range |

### 2.2 `js/export.js` — CSV/PDF Export

**Why test:** CSV generation involves complex data flattening. Malformed CSV breaks imports. The `_csvSafe()` function is a naive sanitization that doesn't handle all CSV edge cases.

**Key functions to test:**

| Function | Risk | What to test |
|----------|------|--------------|
| `generateDailyCSV()` | High | Multi-row days (multiple weights, multiple BP readings). Column alignment. Empty fields |
| `generateWorkoutCSV()` | Medium | Exercise-level vs. set-level weight handling |
| `generateHabitsCSV()` | Medium | Status mapping: done → 'Gedaan', skipped → 'Overgeslagen' |
| `generateJournalCSV()` | Medium | Two sections (5MJ + Daily Review) combined |
| `_csvSafe()` | Medium | Commas replaced with semicolons, newlines replaced with spaces |
| `_dateRange()` | Low | Same logic as weekly-review (duplicated — consider DRY) |
| `formatDateNL()` | Low | Dutch locale formatting |

**Known issue:** `_csvSafe()` replaces commas with semicolons but does not handle quotes, which means field values containing quotes will produce broken CSV.

---

## Priority 3: Edge Cases & Integration Points

### 3.1 Data Migration (`db.js:_migrateDay`)

The migration from single-value to array format runs on every `getDay()` call. This is a hot path that should never corrupt data. Test with:
- v1 data (single `weight` object)
- v2 data (single `sleep` object)
- v3 data (already arrays)
- Mixed: some fields migrated, some not

### 3.2 Sync Module (`sync.js`)

While hard to unit test due to Firebase coupling, the following can be tested in isolation:
- `cleanDoc()` — removes `updatedAt` field
- Batch operation size limits (Firestore allows max 500 ops per batch — `uploadLocalData()` doesn't chunk)

### 3.3 Service Worker (`sw.js`)

- Cache versioning: old caches deleted on activate
- Fetch strategy: cache-first, network fallback
- Non-GET requests skipped
- External requests skipped

---

## Proposed Testing Strategy

### Recommended Framework: Vitest

Vitest is the best fit for this project because:
- No build step required (works with vanilla JS)
- Built-in `localStorage` mock via `jsdom` or `happy-dom`
- Fast execution
- Minimal configuration

### Setup Steps

1. Initialize npm: `npm init -y`
2. Install: `npm install -D vitest jsdom`
3. Create `vitest.config.js` with `jsdom` environment
4. Create `tests/` directory

### Suggested Test File Structure

```
tests/
├── db.test.js              # Health data layer (Priority 1)
├── habits-db.test.js       # Habit tracking + streaks (Priority 1)
├── work-db.test.js         # Task management (Priority 1)
├── weekly-review.test.js   # Week summary generation (Priority 2)
├── export.test.js          # CSV generation (Priority 2)
├── migration.test.js       # Data migration edge cases (Priority 3)
└── helpers/
    └── setup.js            # localStorage mock, common fixtures
```

### Estimated Test Count by Priority

| Priority | Module(s) | Estimated Tests | Effort |
|----------|-----------|-----------------|--------|
| P1 | db.js | ~40 tests | Medium |
| P1 | habits-db.js | ~35 tests | High (streak logic) |
| P1 | work-db.js | ~30 tests | Medium |
| P2 | weekly-review.js | ~15 tests | Medium |
| P2 | export.js | ~15 tests | Low |
| P3 | migration/sync/sw | ~10 tests | Low |
| **Total** | | **~145 tests** | |

---

## Specific Bugs & Risks Found During Analysis

1. **`_csvSafe()` doesn't handle quotes** (`export.js:44`): Field values with double quotes will produce broken CSV. Should wrap fields in quotes and escape internal quotes.

2. **`_calculateDailyStreak` longest-streak logic has a subtle bug** (`habits-db.js:283-294`): The longest streak scan walks through sorted dates with an `expectedDate` tracker, but if a date has completions below `goalCount`, it resets but may miscount the next segment start.

3. **Firestore batch limit not enforced** (`sync.js:98`): `uploadLocalData()` adds all documents to a single batch. Firestore batches are limited to 500 operations. A user with more than 500 days of data would hit this limit.

4. **Duplicated `_dateRange()` utility**: Both `export.js:49` and `weekly-review.js:50` have identical implementations. Should be extracted to a shared utility.

5. **`addGym()` allows `NaN` duration for `'Niet gegaan'` type** (`db.js:339`): `dur` will be `NaN` from `parseInt(undefined)`, stored as `0` via `dur || 0`. Not a bug, but fragile.

6. **No input sanitization on HTML in PDF export** (`export.js:282-518`): User-entered values (notes, habit names, etc.) are injected directly into HTML strings. While this is only rendered in a print window the user controls, it's still an XSS surface.

---

## Quick Wins (Start Here)

If you want to begin testing today, these three areas give the highest confidence-per-effort ratio:

1. **Streak calculations** (`habits-db.js`): Pure math, highest user-facing impact, most likely to have edge case bugs
2. **Data migration** (`db.js:_migrateDay`): Runs on every page load, data loss risk, finite set of input shapes
3. **Recurring task generation** (`work-db.js:processRecurringTask`): Date arithmetic is notoriously error-prone, easy to test in isolation
