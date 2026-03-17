# RHLOS - Volgende Test Prioriteiten

> Gebaseerd op de test coverage analyse. Dit zijn de concrete volgende stappen om tests toe te voegen aan het RHLOS project.

---

## Status: Geen tests aanwezig (0% coverage)

Het project heeft momenteel **geen geautomatiseerde tests**, geen test framework, en geen CI/CD pipeline.

---

## Stap 1: Test Framework Opzetten

```bash
npm init -y
npm install -D vitest jsdom
```

Maak `vitest.config.js`:
```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
```

Voeg toe aan `package.json`:
```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest"
}
```

---

## Stap 2: Quick Wins (Begin Hier)

### A. Streak Berekeningen (`js/habits-db.js`)
**Waarom eerst:** Pure wiskunde, hoogste impact voor gebruikers, meest kans op edge case bugs.

| Test | Beschrijving |
|------|-------------|
| 5 opeenvolgende dagen voltooid | current streak = 5 |
| Vandaag niet voltooid, gisteren wel | streak begint bij gisteren |
| Gat van 1 dag in het midden | current streak gebroken |
| Completions met status 'skipped' | tellen niet mee |
| Goal count = 2, maar 1 completion | dag telt niet als behaald |
| Geen completions | { current: 0, longest: 0 } |

**Mogelijke bug gevonden:** De longest-streak logica in `_calculateDailyStreak` (regel 283-294) kan een fout segment-start geven als een dag onder goalCount completions heeft.

### B. Data Migratie (`js/db.js:_migrateDay`)
**Waarom:** Draait bij elke page load, risico op dataverlies.

| Test | Beschrijving |
|------|-------------|
| Oud formaat `weight: { kg: 80 }` | Migreert naar `weights: [{ id, kg: 80 }]` |
| Al nieuw formaat | Geen wijzigingen |
| Lege dag | Alle arrays geinitialiseerd naar `[]` |
| Gedeeltelijk gemigreerd | Vult ontbrekende arrays aan |

### C. Terugkerende Taken (`js/work-db.js:processRecurringTask`)
**Waarom:** Datum-rekenkunde is foutgevoelig.

| Test | Beschrijving |
|------|-------------|
| Deadline 2026-01-15, 'wekelijks' | Nieuwe deadline: 2026-01-22 |
| 'maandelijks', deadline 2026-01-31 | Nieuwe deadline: 2026-02-28 |
| Recurring 'geen' | Returns null |
| Niet-bestaande taak | Returns null |

---

## Stap 3: Data Layer Tests (Prioriteit 1)

### `js/db.js` — ~40 tests nodig
Belangrijkste functies:
- `addWeight()` — weiger NaN, 0, negatief
- `addBloodPressure()` — valideer systolic, diastolic, pulse
- `addSleep()` — weiger ongeldige uren, default location 'Thuis'
- `addGym()` — speciale case 'Niet gegaan'
- `addDrinks()` — water2L backward-compat
- `upsertNutrition()` — update vs. create logica
- `getDaysInRange()` / `getDaysForMonth()` — datum filtering en sortering

### `js/habits-db.js` — ~35 tests nodig
Belangrijkste functies:
- `_calculateDailyStreak()` / `_calculateWeeklyStreak()` / `_calculateMonthlyStreak()`
- `getCompletionRate()` — daily, weekly, monthly, en 'all' periodes
- `addCompletion()` / `removeLastCompletion()`
- `migrate()` — toevoegen/verwijderen default habits

### `js/work-db.js` — ~30 tests nodig
Belangrijkste functies:
- `processRecurringTask()` — alle 5 recurrence types
- `_clearNextAction()` — max 1 nextAction per project
- `updateTask()` — completedAt op transitie naar 'afgerond'
- `setNextAction()` — toggle gedrag
- `_applyFilters()` — array vs. scalar filters

---

## Stap 4: Business Logic Tests (Prioriteit 2)

### `js/weekly-review.js` — ~15 tests
- `generateWeekSummary()` — correcte gemiddelden, aggregaties
- `_getMonday()` — zondag geeft vorige maandag
- `_getISOWeekKey()` — jaargrens weken

### `js/export.js` — ~15 tests
- `generateDailyCSV()` — multi-row dagen, kolom uitlijning
- `_csvSafe()` — **bug:** handelt geen quotes af

---

## Stap 5: Edge Cases & Integratie (Prioriteit 3)

- **Sync module** (`sync.js`): Firestore batch limiet (max 500) wordt niet afgedwongen
- **Service Worker** (`sw.js`): Cache versioning, fetch strategy

---

## Gevonden Bugs & Risico's

| # | Probleem | Locatie | Ernst |
|---|----------|---------|-------|
| 1 | ~~`_csvSafe()` handelt geen quotes af~~ | `export.js:44` | **Opgelost** |
| 2 | ~~Longest-streak telling mogelijk incorrect~~ | `habits-db.js:283-294` | **Weerlegd** — logica is correct, 6 edge case tests bevestigen dit |
| 3 | ~~Firestore batch limiet niet afgedwongen~~ | `sync.js:98` | **Opgelost** — batches van 450 ops, zie `34c8492` op main |
| 4 | Gedupliceerde `_dateRange()` utility | `export.js:49` + `weekly-review.js:50` | Laag |
| 5 | ~~`addGym()` laat NaN duration door~~ | `db.js:339` | **Opgelost** |
| 6 | Geen HTML sanitization in PDF export | `export.js:282-518` | Medium (XSS) |

---

## Geschatte Totalen

| Prioriteit | Module(s) | Tests | Effort |
|------------|-----------|-------|--------|
| P1 | db.js | ~40 | Medium |
| P1 | habits-db.js | ~35 | Hoog |
| P1 | work-db.js | ~30 | Medium |
| P2 | weekly-review.js | ~15 | Medium |
| P2 | export.js | ~15 | Laag |
| P3 | migration/sync/sw | ~10 | Laag |
| **Totaal** | | **~145** | |

---

## Aanbevolen Mapstructuur

```
tests/
├── db.test.js              # Health data layer (P1)
├── habits-db.test.js       # Habit tracking + streaks (P1)
├── work-db.test.js         # Task management (P1)
├── weekly-review.test.js   # Week summary generation (P2)
├── export.test.js          # CSV generation (P2)
├── migration.test.js       # Data migration edge cases (P3)
└── helpers/
    └── setup.js            # localStorage mock, common fixtures
```
