# RHLOS — Volgende Test Prioriteiten

Drie concrete vervolgstappen na de initiële testsuite (168 tests). Gerangschikt op urgentie.

---

## Prioriteit 1: Sync Batch Chunking (Bug Fix)

**Bestand:** `js/sync.js` — functie `uploadLocalData()` (regel 94–179)

### Wat het is
Wanneer een gebruiker voor het eerst inlogt, wordt alle lokale data in één Firestore batch-operatie geüpload. Firestore heeft een harde limiet van 500 operaties per batch. De code maakt nu één enkele batch zonder te controleren hoeveel operaties erin zitten.

### Waarom dit urgent is
Een actieve gebruiker die 6+ maanden de app gebruikt kan makkelijk 500+ documenten hebben (180+ dagen gezondheidsdata + sessies + habits + completions + journal entries). Op dat moment crasht de upload met een Firestore-error en wordt de sync nooit voltooid. De gebruiker ziet "Sync fout" zonder te weten waarom, en de data wordt nooit naar de cloud gestuurd. **Dit is een echte bug, niet een hypothetisch risico.**

### Plan van aanpak
1. Fix schrijven: `uploadLocalData()` opsplitsen in chunks van max 499 operaties per batch
2. Testen dat de chunking correct werkt: mock Firestore's `batch()` en `commit()`, en verifieer dat bij 600 documenten er 2 batches worden aangemaakt
3. Testen dat bij 0 documenten er geen batch wordt gecommit
4. Testen dat bij exact 499 documenten alles in 1 batch past

### Geschatte omvang
- Fix: ~20 regels code
- Tests: ~5 tests
- Effort: laag

---

## Prioriteit 2: Weekly Summary Aggregation

**Bestand:** `js/weekly-review.js` — functie `generateWeekSummary()` (regel 134–306)

### Wat het is
De functie `generateWeekSummary()` verzamelt data uit 4+ modules (gezondheid, habits, journal, workouts) en berekent gemiddelden, totalen en percentages voor een hele week. Denk aan gemiddeld gewicht, gemiddelde bloeddruk, slaapkwaliteit, habit-scores, etc. — allemaal in één samenvattingsobject.

### Waarom dit belangrijk is
Dit is de meest complexe aggregatielogica in de codebase (~170 regels). Een fout in een gemiddelde-berekening of telling is onzichtbaar — de gebruiker ziet een verkeerd weekoverzicht maar heeft geen reden om het te wantrouwen. Bijvoorbeeld: als `avgWeight` per ongeluk 0-waarden meeneemt, zie je een lager gemiddelde zonder dat iemand dat opmerkt. Bovendien hangt het af van meerdere modules (`DB`, `HabitsDB`, `localStorage` direct), wat de kans op regressie vergroot bij wijzigingen.

### Plan van aanpak
1. Mock data aanmaken voor een volledige week (7 dagen met gewicht, bloeddruk, slaap, gym, drinks, habits, journal entries)
2. Testen dat gemiddelden correct berekend worden (bijv. 3 gewichtsmetingen → juist gemiddelde)
3. Edge cases: lege week (geen data), week met maar 1 dag data, week met skipped bloeddrukmetingen
4. Testen van `_getMonday()` (geeft zondag de juiste maandag?) en `_getISOWeekKey()` (jaargrens-weken)
5. Testen dat `autoGenerateIfNeeded()` alleen op maandag triggert en geen bestaande samenvattingen overschrijft

### Geschatte omvang
- Tests: ~15 tests
- Effort: middel (vereist data setup voor meerdere modules tegelijk)

---

## Prioriteit 3: CSV Output String Tests

**Bestand:** `js/export.js` — functies `generateDailyCSV()`, `generateWorkoutCSV()`, `generateHabitsCSV()`, `generateJournalCSV()`

### Wat het is
De huidige export-tests controleren alleen dat de datastructuren de juiste vorm hebben. Ze testen niet de daadwerkelijke CSV-output — de strings die gegenereerd worden door de generate-functies.

### Waarom dit belangrijk is
CSV-generatie heeft subtiele pitfalls. De huidige `_csvSafe()` (regel 44) vervangt komma's door puntkomma's, maar handelt aanhalingstekens niet correct af. Een habit met de naam `Lezen "boek"` of een notitie met een komma breekt de CSV-structuur. Ook worden meerdere metingen per dag (bijv. 2x gewicht) op meerdere rijen geplaatst, waarbij alleen de eerste rij de datum toont — dit moet exact kloppen, anders mist de import rijen.

### Bekende bug
`_csvSafe()` vervangt alleen komma's en newlines. Velden met aanhalingstekens (`"`) produceren ongeldige CSV. De fix: velden met speciale tekens in dubbele quotes wrappen en interne quotes escapen als `""`.

### Plan van aanpak
1. De private functies (`generateDailyCSV`, `generateWorkoutCSV`, etc.) toegankelijk maken voor tests door ze toe te voegen aan de public API van `ExportService`
2. Testen dat de CSV-header de juiste kolommen bevat
3. Testen dat een dag met 2 gewichtsmetingen 2 CSV-rijen oplevert, waar alleen de eerste de datum bevat
4. Testen dat `_csvSafe()` komma's, newlines, en aanhalingstekens correct afhandelt
5. De `_csvSafe()` bug fixen en verifiëren met tests

### Geschatte omvang
- Bug fix: ~10 regels code
- Tests: ~15 tests
- Effort: middel (vereist aanpassing van de module's public API)

---

## Samenvatting

| # | Onderwerp | Type | Effort | Impact |
|---|-----------|------|--------|--------|
| 1 | Sync Batch Chunking | Bug fix + tests | Laag | Hoog — voorkomt sync-failures |
| 2 | Weekly Summary Aggregation | Alleen tests | Middel | Middel — vangt rekenfouten |
| 3 | CSV Output Strings | Bug fix + tests | Middel | Middel — voorkomt corrupte exports |

**Aanbeveling:** Begin met prioriteit 1 (Sync Batch Chunking). Het is de enige echte productiebug, de fix is klein en afgebakend, en het risico (dataverlies bij sync) is het hoogst.
