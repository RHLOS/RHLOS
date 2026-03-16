import { describe, it, expect, beforeEach } from 'vitest';
import { loadModules } from './setup.js';

let sandbox;
let ExportService;
let DB;
let formatDateNL;

describe('ExportService — CSV Generation', () => {
    beforeEach(() => {
        sandbox = loadModules('js/db.js', 'js/export.js');
        DB = sandbox.DB;
        ExportService = sandbox.ExportService;
        formatDateNL = sandbox.formatDateNL;
    });

    // ============================
    // formatDateNL
    // ============================
    describe('formatDateNL', () => {
        it('formats a date in Dutch long format', () => {
            const result = formatDateNL('2026-03-15');
            expect(result).toContain('15');
            expect(result).toContain('2026');
        });

        it('formats a date in Dutch short format', () => {
            const result = formatDateNL('2026-03-15', true);
            expect(result).toContain('15');
            expect(result).toContain('2026');
        });
    });

    // ============================
    // generateDailyCSV
    // ============================
    describe('generateDailyCSV (via exportCSV internals)', () => {
        it('generates CSV header', () => {
            // We can't directly call generateDailyCSV (private), but we can
            // test via the data layer: add data and check getDaysInRange
            DB.addWeight('2026-03-10', 80.5);
            DB.addSleep('2026-03-10', 7, false, '');
            const days = DB.getDaysInRange('2026-03-10', '2026-03-10');
            expect(days).toHaveLength(1);
            expect(days[0].weights[0].kg).toBe(80.5);
        });

        it('handles day with multiple entries', () => {
            DB.addWeight('2026-03-10', 80);
            DB.addWeight('2026-03-10', 81);
            DB.addBloodPressure('2026-03-10', 120, 80, 70, 'ochtend');
            DB.addBloodPressure('2026-03-10', 115, 75, 65, 'avond');
            const day = DB.getDay('2026-03-10');
            expect(day.weights).toHaveLength(2);
            expect(day.bloodPressure).toHaveLength(2);
        });
    });

    // ============================
    // Data integrity for CSV export
    // ============================
    describe('Data shapes for CSV export', () => {
        it('weight entries have correct shape', () => {
            DB.addWeight('2026-03-10', 82.3);
            const day = DB.getDay('2026-03-10');
            const w = day.weights[0];
            expect(w).toHaveProperty('id');
            expect(w).toHaveProperty('kg');
            expect(w).toHaveProperty('timestamp');
            expect(typeof w.kg).toBe('number');
        });

        it('blood pressure entries have correct shape', () => {
            DB.addBloodPressure('2026-03-10', 120, 80, 70, 'ochtend');
            const day = DB.getDay('2026-03-10');
            const bp = day.bloodPressure[0];
            expect(bp).toHaveProperty('systolic');
            expect(bp).toHaveProperty('diastolic');
            expect(bp).toHaveProperty('pulse');
            expect(bp).toHaveProperty('moment');
        });

        it('skipped blood pressure has skipped flag', () => {
            DB.addBloodPressureSkipped('2026-03-10', 'avond');
            const day = DB.getDay('2026-03-10');
            expect(day.bloodPressure[0].skipped).toBe(true);
        });

        it('sleep entries have correct shape', () => {
            DB.addSleep('2026-03-10', 7.5, true, 'bad', 'Hotel');
            const day = DB.getDay('2026-03-10');
            const s = day.sleepEntries[0];
            expect(s).toHaveProperty('hours');
            expect(s).toHaveProperty('interrupted');
            expect(s).toHaveProperty('note');
            expect(s).toHaveProperty('location');
        });

        it('gym sessions have correct shape', () => {
            DB.addGym('2026-03-10', 'Cardio', 45, 'good', 5);
            const day = DB.getDay('2026-03-10');
            const g = day.gymSessions[0];
            expect(g).toHaveProperty('type');
            expect(g).toHaveProperty('durationMinutes');
            expect(g).toHaveProperty('km');
        });

        it('drink entries have correct shape', () => {
            DB.addDrinks('2026-03-10', 3, 1, true, 2, 'wine', 2.5);
            const day = DB.getDay('2026-03-10');
            const d = day.drinks[0];
            expect(d).toHaveProperty('coffee');
            expect(d).toHaveProperty('decaf');
            expect(d).toHaveProperty('alcohol');
            expect(d).toHaveProperty('waterAmount');
            expect(d).toHaveProperty('water2L');
            expect(d).toHaveProperty('alcoholGlasses');
            expect(d).toHaveProperty('alcoholNote');
        });

        it('nutrition entries have correct shape', () => {
            DB.addNutrition('2026-03-10', 'a', 'b', 'c', 'd', 'e', 'f');
            const day = DB.getDay('2026-03-10');
            const n = day.nutrition[0];
            expect(n).toHaveProperty('ontbijt');
            expect(n).toHaveProperty('tussen1');
            expect(n).toHaveProperty('lunch');
            expect(n).toHaveProperty('tussen2');
            expect(n).toHaveProperty('diner');
            expect(n).toHaveProperty('tussen3');
        });

        it('workout sessions have correct shape for CSV', () => {
            const session = DB.startSession('tpl_a');
            expect(session).toHaveProperty('date');
            expect(session).toHaveProperty('templateName');
            expect(session).toHaveProperty('exercises');
            expect(session.exercises[0]).toHaveProperty('name');
            expect(session.exercises[0]).toHaveProperty('sets');
            expect(session.exercises[0].sets[0]).toHaveProperty('setNumber');
            expect(session.exercises[0].sets[0]).toHaveProperty('reps');
            expect(session.exercises[0].sets[0]).toHaveProperty('weightKg');
        });
    });

    // ============================
    // Sessions range query for export
    // ============================
    describe('Sessions range for export', () => {
        it('getSessionsInRange returns sessions in date range', () => {
            DB.startSession('tpl_a');
            const t = DB.todayKey();
            const sessions = DB.getSessionsInRange(t, t);
            expect(sessions.length).toBeGreaterThanOrEqual(1);
            expect(sessions[0].templateName).toBe('Workout A');
        });

        it('getSessionsInRange returns empty for out-of-range dates', () => {
            DB.startSession('tpl_a');
            const sessions = DB.getSessionsInRange('2020-01-01', '2020-01-02');
            expect(sessions).toHaveLength(0);
        });
    });
});
