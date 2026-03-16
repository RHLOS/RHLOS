import { describe, it, expect, beforeEach } from 'vitest';
import { loadModules } from './setup.js';

let DB;
let storage;

describe('DB — Health Data Layer', () => {
    beforeEach(() => {
        const sandbox = loadModules('js/db.js');
        DB = sandbox.DB;
        storage = sandbox.localStorage;
    });

    // ============================
    // Helpers
    // ============================
    describe('todayKey', () => {
        it('returns a YYYY-MM-DD string', () => {
            expect(DB.todayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });
    });

    describe('generateId', () => {
        it('returns unique ids', () => {
            const a = DB.generateId();
            const b = DB.generateId();
            expect(a).not.toBe(b);
        });
    });

    // ============================
    // Templates
    // ============================
    describe('Templates', () => {
        it('seeds default templates on first access', () => {
            const templates = DB.getTemplates();
            expect(templates).toHaveLength(2);
            expect(templates[0].name).toBe('Workout A');
            expect(templates[1].name).toBe('Workout B');
        });

        it('getTemplate returns a specific template', () => {
            const t = DB.getTemplate('tpl_a');
            expect(t).not.toBeNull();
            expect(t.name).toBe('Workout A');
            expect(t.exercises.length).toBeGreaterThan(0);
        });

        it('getTemplate returns null for unknown id', () => {
            expect(DB.getTemplate('nonexistent')).toBeNull();
        });
    });

    // ============================
    // Day Entries
    // ============================
    describe('Day Entries', () => {
        it('getDay returns null for nonexistent date', () => {
            expect(DB.getDay('2020-01-01')).toBeNull();
        });

        it('getOrCreateDay creates a new day with empty arrays', () => {
            const day = DB.getOrCreateDay('2026-03-10');
            expect(day.date).toBe('2026-03-10');
            expect(day.weights).toEqual([]);
            expect(day.bloodPressure).toEqual([]);
            expect(day.sleepEntries).toEqual([]);
            expect(day.gymSessions).toEqual([]);
            expect(day.drinks).toEqual([]);
            expect(day.nutrition).toEqual([]);
            expect(day.notes).toBe('');
        });

        it('getOrCreateDay returns existing day on second call', () => {
            DB.getOrCreateDay('2026-03-10');
            DB.addWeight('2026-03-10', 80);
            const day = DB.getOrCreateDay('2026-03-10');
            expect(day.weights).toHaveLength(1);
        });

        it('getToday creates today entry', () => {
            const day = DB.getToday();
            expect(day.date).toBe(DB.todayKey());
        });

        it('getAllDays returns all stored days', () => {
            DB.getOrCreateDay('2026-03-10');
            DB.getOrCreateDay('2026-03-11');
            const all = DB.getAllDays();
            expect(Object.keys(all)).toHaveLength(2);
        });
    });

    // ============================
    // Migration
    // ============================
    describe('_migrateDay (via getDay)', () => {
        it('migrates old weight object to weights array', () => {
            // Manually store v1 format
            const days = {
                '2026-01-01': {
                    date: '2026-01-01',
                    weight: { kg: 80.5 },
                }
            };
            storage.setItem('hl_days', JSON.stringify(days));

            const day = DB.getDay('2026-01-01');
            expect(day.weights).toHaveLength(1);
            expect(day.weights[0].kg).toBe(80.5);
            expect(day.weight).toBeUndefined();
        });

        it('migrates old sleep object to sleepEntries array', () => {
            const days = {
                '2026-01-01': {
                    date: '2026-01-01',
                    sleep: { hours: 7.5, interrupted: true, note: 'restless' },
                }
            };
            storage.setItem('hl_days', JSON.stringify(days));

            const day = DB.getDay('2026-01-01');
            expect(day.sleepEntries).toHaveLength(1);
            expect(day.sleepEntries[0].hours).toBe(7.5);
            expect(day.sleepEntries[0].interrupted).toBe(true);
            expect(day.sleep).toBeUndefined();
        });

        it('migrates old gym object to gymSessions array', () => {
            const days = {
                '2026-01-01': {
                    date: '2026-01-01',
                    gym: { type: 'Cardio', durationMinutes: 45, note: '' },
                }
            };
            storage.setItem('hl_days', JSON.stringify(days));

            const day = DB.getDay('2026-01-01');
            expect(day.gymSessions).toHaveLength(1);
            expect(day.gymSessions[0].type).toBe('Cardio');
            expect(day.gym).toBeUndefined();
        });

        it('initializes missing arrays to empty', () => {
            const days = { '2026-01-01': { date: '2026-01-01' } };
            storage.setItem('hl_days', JSON.stringify(days));

            const day = DB.getDay('2026-01-01');
            expect(day.weights).toEqual([]);
            expect(day.bloodPressure).toEqual([]);
            expect(day.sleepEntries).toEqual([]);
            expect(day.gymSessions).toEqual([]);
            expect(day.drinks).toEqual([]);
            expect(day.nutrition).toEqual([]);
        });

        it('does not modify already-migrated data', () => {
            const day = DB.getOrCreateDay('2026-01-01');
            DB.addWeight('2026-01-01', 80);
            const loaded = DB.getDay('2026-01-01');
            expect(loaded.weights).toHaveLength(1);
        });
    });

    // ============================
    // Weight CRUD
    // ============================
    describe('Weight', () => {
        it('addWeight adds a weight entry', () => {
            const day = DB.addWeight('2026-03-10', 82.5);
            expect(day.weights).toHaveLength(1);
            expect(day.weights[0].kg).toBe(82.5);
            expect(day.weights[0].id).toBeTruthy();
            expect(day.weights[0].timestamp).toBeTruthy();
        });

        it('addWeight rejects NaN', () => {
            expect(DB.addWeight('2026-03-10', 'abc')).toBeNull();
        });

        it('addWeight rejects 0', () => {
            expect(DB.addWeight('2026-03-10', 0)).toBeNull();
        });

        it('addWeight rejects negative', () => {
            expect(DB.addWeight('2026-03-10', -5)).toBeNull();
        });

        it('addWeight parses string numbers', () => {
            const day = DB.addWeight('2026-03-10', '79.3');
            expect(day.weights[0].kg).toBe(79.3);
        });

        it('deleteWeight removes a specific weight entry', () => {
            DB.addWeight('2026-03-10', 80);
            DB.addWeight('2026-03-10', 81);
            const day = DB.getDay('2026-03-10');
            const idToDelete = day.weights[0].id;
            DB.deleteWeight('2026-03-10', idToDelete);
            const updated = DB.getDay('2026-03-10');
            expect(updated.weights).toHaveLength(1);
            expect(updated.weights[0].kg).toBe(81);
        });

        it('deleteWeight on nonexistent date does nothing', () => {
            expect(DB.deleteWeight('2099-01-01', 'fake')).toBeUndefined();
        });
    });

    // ============================
    // Blood Pressure
    // ============================
    describe('Blood Pressure', () => {
        it('addBloodPressure adds a valid entry', () => {
            const day = DB.addBloodPressure('2026-03-10', 120, 80, 70, 'ochtend');
            expect(day.bloodPressure).toHaveLength(1);
            expect(day.bloodPressure[0].systolic).toBe(120);
            expect(day.bloodPressure[0].diastolic).toBe(80);
            expect(day.bloodPressure[0].pulse).toBe(70);
            expect(day.bloodPressure[0].moment).toBe('ochtend');
        });

        it('addBloodPressure rejects invalid values', () => {
            expect(DB.addBloodPressure('2026-03-10', 'x', 80, 70, 'ochtend')).toBeNull();
            expect(DB.addBloodPressure('2026-03-10', 120, 'x', 70, 'ochtend')).toBeNull();
            expect(DB.addBloodPressure('2026-03-10', 120, 80, 'x', 'ochtend')).toBeNull();
        });

        it('addBloodPressureSkipped creates a skipped entry', () => {
            const day = DB.addBloodPressureSkipped('2026-03-10', 'avond');
            expect(day.bloodPressure[0].skipped).toBe(true);
            expect(day.bloodPressure[0].moment).toBe('avond');
        });

        it('deleteBloodPressure removes entry', () => {
            DB.addBloodPressure('2026-03-10', 120, 80, 70, 'ochtend');
            const day = DB.getDay('2026-03-10');
            DB.deleteBloodPressure('2026-03-10', day.bloodPressure[0].id);
            expect(DB.getDay('2026-03-10').bloodPressure).toHaveLength(0);
        });
    });

    // ============================
    // Sleep
    // ============================
    describe('Sleep', () => {
        it('addSleep adds a valid entry', () => {
            const day = DB.addSleep('2026-03-10', 7.5, true, 'bad dreams', 'Hotel');
            expect(day.sleepEntries).toHaveLength(1);
            expect(day.sleepEntries[0].hours).toBe(7.5);
            expect(day.sleepEntries[0].interrupted).toBe(true);
            expect(day.sleepEntries[0].note).toBe('bad dreams');
            expect(day.sleepEntries[0].location).toBe('Hotel');
        });

        it('addSleep defaults location to Thuis', () => {
            const day = DB.addSleep('2026-03-10', 8, false, '');
            expect(day.sleepEntries[0].location).toBe('Thuis');
        });

        it('addSleep rejects invalid hours', () => {
            expect(DB.addSleep('2026-03-10', 'abc', false, '')).toBeNull();
            expect(DB.addSleep('2026-03-10', 0, false, '')).toBeNull();
            expect(DB.addSleep('2026-03-10', -1, false, '')).toBeNull();
        });

        it('deleteSleep removes entry', () => {
            DB.addSleep('2026-03-10', 8, false, '');
            const day = DB.getDay('2026-03-10');
            DB.deleteSleep('2026-03-10', day.sleepEntries[0].id);
            expect(DB.getDay('2026-03-10').sleepEntries).toHaveLength(0);
        });
    });

    // ============================
    // Gym
    // ============================
    describe('Gym', () => {
        it('addGym adds a valid entry', () => {
            const day = DB.addGym('2026-03-10', 'Cardio', 45, 'good session', 5.2);
            expect(day.gymSessions).toHaveLength(1);
            expect(day.gymSessions[0].type).toBe('Cardio');
            expect(day.gymSessions[0].durationMinutes).toBe(45);
            expect(day.gymSessions[0].km).toBe(5.2);
        });

        it('addGym rejects missing type', () => {
            expect(DB.addGym('2026-03-10', '', 45, '')).toBeNull();
        });

        it('addGym rejects invalid duration', () => {
            expect(DB.addGym('2026-03-10', 'Cardio', 'abc', '')).toBeNull();
            expect(DB.addGym('2026-03-10', 'Cardio', 0, '')).toBeNull();
        });

        it('addGym allows Niet gegaan without valid duration', () => {
            const day = DB.addGym('2026-03-10', 'Niet gegaan', null, 'rest day');
            expect(day.gymSessions).toHaveLength(1);
            expect(day.gymSessions[0].type).toBe('Niet gegaan');
            expect(day.gymSessions[0].durationMinutes).toBe(0);
        });

        it('addGym omits km when null or 0', () => {
            const day = DB.addGym('2026-03-10', 'Weights', 60, '', null);
            expect(day.gymSessions[0].km).toBeUndefined();
        });

        it('deleteGym removes entry', () => {
            DB.addGym('2026-03-10', 'Cardio', 30, '');
            const day = DB.getDay('2026-03-10');
            DB.deleteGym('2026-03-10', day.gymSessions[0].id);
            expect(DB.getDay('2026-03-10').gymSessions).toHaveLength(0);
        });
    });

    // ============================
    // Drinks
    // ============================
    describe('Drinks', () => {
        it('addDrinks adds a non-alcohol entry', () => {
            const day = DB.addDrinks('2026-03-10', 3, 1, false, 0, '', 2.5);
            expect(day.drinks).toHaveLength(1);
            expect(day.drinks[0].coffee).toBe(3);
            expect(day.drinks[0].decaf).toBe(1);
            expect(day.drinks[0].alcohol).toBe(false);
            expect(day.drinks[0].waterAmount).toBe(2.5);
            expect(day.drinks[0].water2L).toBe(true);
        });

        it('addDrinks adds alcohol fields when alcohol is true', () => {
            const day = DB.addDrinks('2026-03-10', 2, 0, true, 3, 'wine', 1);
            expect(day.drinks[0].alcohol).toBe(true);
            expect(day.drinks[0].alcoholGlasses).toBe(3);
            expect(day.drinks[0].alcoholNote).toBe('wine');
        });

        it('water2L backward compat is false under 2L', () => {
            const day = DB.addDrinks('2026-03-10', 0, 0, false, 0, '', 1.5);
            expect(day.drinks[0].water2L).toBe(false);
        });

        it('deleteDrinks removes entry', () => {
            DB.addDrinks('2026-03-10', 2, 0, false, 0, '', 2);
            const day = DB.getDay('2026-03-10');
            DB.deleteDrinks('2026-03-10', day.drinks[0].id);
            expect(DB.getDay('2026-03-10').drinks).toHaveLength(0);
        });
    });

    // ============================
    // Nutrition
    // ============================
    describe('Nutrition', () => {
        it('addNutrition adds an entry', () => {
            const day = DB.addNutrition('2026-03-10', 'oatmeal', '', 'salad', '', 'pasta', '');
            expect(day.nutrition).toHaveLength(1);
            expect(day.nutrition[0].ontbijt).toBe('oatmeal');
            expect(day.nutrition[0].lunch).toBe('salad');
            expect(day.nutrition[0].diner).toBe('pasta');
        });

        it('getNutrition returns last entry', () => {
            DB.addNutrition('2026-03-10', 'a', '', '', '', '', '');
            DB.addNutrition('2026-03-10', 'b', '', '', '', '', '');
            const nut = DB.getNutrition('2026-03-10');
            expect(nut.ontbijt).toBe('b');
        });

        it('getNutrition returns null for empty day', () => {
            expect(DB.getNutrition('2099-01-01')).toBeNull();
        });

        it('upsertNutrition updates existing entry', () => {
            DB.addNutrition('2026-03-10', 'oatmeal', '', '', '', '', '');
            DB.upsertNutrition('2026-03-10', 'eggs', '', 'soup', '', 'rice', '');
            const day = DB.getDay('2026-03-10');
            expect(day.nutrition).toHaveLength(1);
            expect(day.nutrition[0].ontbijt).toBe('eggs');
            expect(day.nutrition[0].diner).toBe('rice');
        });

        it('upsertNutrition creates new entry if none exists', () => {
            DB.upsertNutrition('2026-03-10', 'toast', '', '', '', '', '');
            const day = DB.getDay('2026-03-10');
            expect(day.nutrition).toHaveLength(1);
            expect(day.nutrition[0].ontbijt).toBe('toast');
        });

        it('deleteNutrition removes entry', () => {
            DB.addNutrition('2026-03-10', 'a', '', '', '', '', '');
            const day = DB.getDay('2026-03-10');
            DB.deleteNutrition('2026-03-10', day.nutrition[0].id);
            expect(DB.getDay('2026-03-10').nutrition).toHaveLength(0);
        });
    });

    // ============================
    // Notes
    // ============================
    describe('Notes', () => {
        it('saveNotes persists notes', () => {
            DB.saveNotes('2026-03-10', 'Feeling great');
            expect(DB.getDay('2026-03-10').notes).toBe('Feeling great');
        });
    });

    // ============================
    // Range Queries
    // ============================
    describe('Range Queries', () => {
        it('getDaysInRange returns sorted days within range', () => {
            DB.getOrCreateDay('2026-03-08');
            DB.getOrCreateDay('2026-03-10');
            DB.getOrCreateDay('2026-03-12');
            const result = DB.getDaysInRange('2026-03-09', '2026-03-11');
            expect(result).toHaveLength(1);
            expect(result[0].date).toBe('2026-03-10');
        });

        it('getDaysInRange returns empty for no matches', () => {
            expect(DB.getDaysInRange('2099-01-01', '2099-12-31')).toEqual([]);
        });

        it('getDaysForMonth returns days for a specific month (desc order)', () => {
            DB.getOrCreateDay('2026-03-01');
            DB.getOrCreateDay('2026-03-15');
            DB.getOrCreateDay('2026-04-01');
            const result = DB.getDaysForMonth(2026, 3);
            expect(result).toHaveLength(2);
            expect(result[0].date).toBe('2026-03-15'); // descending
            expect(result[1].date).toBe('2026-03-01');
        });
    });

    // ============================
    // Workout Sessions
    // ============================
    describe('Workout Sessions', () => {
        it('startSession creates a session from template', () => {
            const session = DB.startSession('tpl_a');
            expect(session).not.toBeNull();
            expect(session.templateName).toBe('Workout A');
            expect(session.exercises.length).toBeGreaterThan(0);
            expect(session.completedAt).toBeNull();
            expect(session.exercises[0].sets).toHaveLength(3);
            expect(session.exercises[0].sets[0].reps).toBeNull();
        });

        it('startSession returns null for unknown template', () => {
            expect(DB.startSession('nonexistent')).toBeNull();
        });

        it('getSession returns session by id', () => {
            const created = DB.startSession('tpl_a');
            const found = DB.getSession(created.id);
            expect(found.id).toBe(created.id);
        });

        it('getSession returns null for unknown id', () => {
            expect(DB.getSession('fake')).toBeNull();
        });

        it('completeSession sets completedAt', () => {
            const session = DB.startSession('tpl_a');
            const completed = DB.completeSession(session.id);
            expect(completed.completedAt).toBeTruthy();
        });

        it('saveSession updates an existing session', () => {
            const session = DB.startSession('tpl_a');
            session.exercises[0].sets[0].reps = 10;
            session.exercises[0].sets[0].weightKg = 50;
            DB.saveSession(session);
            const loaded = DB.getSession(session.id);
            expect(loaded.exercises[0].sets[0].reps).toBe(10);
        });

        it('deleteSession removes session', () => {
            const session = DB.startSession('tpl_a');
            DB.deleteSession(session.id);
            expect(DB.getSession(session.id)).toBeNull();
        });

        it('getSessionsForDate filters by date', () => {
            DB.startSession('tpl_a');
            const sessions = DB.getSessionsForDate(DB.todayKey());
            expect(sessions.length).toBeGreaterThanOrEqual(1);
        });

        it('getRecentSessions returns up to limit, sorted desc', () => {
            DB.startSession('tpl_a');
            DB.startSession('tpl_b');
            const recent = DB.getRecentSessions(1);
            expect(recent).toHaveLength(1);
        });

        it('getSessionsInRange filters by date range', () => {
            DB.startSession('tpl_a');
            const t = DB.todayKey();
            const sessions = DB.getSessionsInRange(t, t);
            expect(sessions.length).toBeGreaterThanOrEqual(1);
        });
    });
});
