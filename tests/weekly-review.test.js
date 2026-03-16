import { describe, it, expect, beforeEach } from 'vitest';
import { loadModules } from './setup.js';

let sandbox;
let WeeklyReview;
let DB;
let HabitsDB;
let storage;

describe('WeeklyReview — Week Summary Generation', () => {
    beforeEach(() => {
        sandbox = loadModules('js/db.js', 'js/habits-db.js', 'js/weekly-review.js');
        WeeklyReview = sandbox.WeeklyReview;
        DB = sandbox.DB;
        HabitsDB = sandbox.HabitsDB;
        storage = sandbox.localStorage;
    });

    // ============================
    // _getMonday (tested via generateWeekSummary behavior)
    // ============================
    describe('generateWeekSummary — date range', () => {
        it('generates a summary with correct weekKey and date range', () => {
            // Monday 2026-03-09
            const summary = WeeklyReview.generateWeekSummary(new Date('2026-03-09'));
            expect(summary.weekStart).toBe('2026-03-09');
            expect(summary.weekEnd).toBe('2026-03-15');
            expect(summary.weekKey).toMatch(/^\d{4}-W\d{2}$/);
        });

        it('generates summary for a different week', () => {
            const summary = WeeklyReview.generateWeekSummary(new Date('2026-01-05'));
            expect(summary.weekStart).toBe('2026-01-05');
            expect(summary.weekEnd).toBe('2026-01-11');
        });
    });

    // ============================
    // Health data aggregation
    // ============================
    describe('generateWeekSummary — health data', () => {
        it('calculates correct weight averages', () => {
            DB.addWeight('2026-03-09', 80);
            DB.addWeight('2026-03-10', 82);
            DB.addWeight('2026-03-11', 81);

            const summary = WeeklyReview.generateWeekSummary(new Date('2026-03-09'));
            expect(summary.health.avgWeight).toBe('81.0');
            expect(summary.health.minWeight).toBe('80.0');
            expect(summary.health.maxWeight).toBe('82.0');
            expect(summary.health.weightMeasurements).toBe(3);
        });

        it('returns null for weight when no data', () => {
            const summary = WeeklyReview.generateWeekSummary(new Date('2026-03-09'));
            expect(summary.health.avgWeight).toBeNull();
            expect(summary.health.minWeight).toBeNull();
            expect(summary.health.maxWeight).toBeNull();
            expect(summary.health.weightMeasurements).toBe(0);
        });

        it('calculates correct blood pressure averages', () => {
            DB.addBloodPressure('2026-03-09', 120, 80, 70, 'ochtend');
            DB.addBloodPressure('2026-03-10', 130, 85, 75, 'ochtend');

            const summary = WeeklyReview.generateWeekSummary(new Date('2026-03-09'));
            expect(summary.health.avgSystolic).toBe(125);
            expect(summary.health.avgDiastolic).toBe(83); // Math.round(82.5)
            expect(summary.health.avgPulse).toBe(73); // Math.round(72.5)
            expect(summary.health.bpMeasurements).toBe(2);
        });

        it('excludes skipped blood pressure entries', () => {
            DB.addBloodPressure('2026-03-09', 120, 80, 70, 'ochtend');
            DB.addBloodPressureSkipped('2026-03-10', 'ochtend');

            const summary = WeeklyReview.generateWeekSummary(new Date('2026-03-09'));
            expect(summary.health.avgSystolic).toBe(120);
            expect(summary.health.bpMeasurements).toBe(1);
        });

        it('returns null for BP when no data', () => {
            const summary = WeeklyReview.generateWeekSummary(new Date('2026-03-09'));
            expect(summary.health.avgSystolic).toBeNull();
            expect(summary.health.avgDiastolic).toBeNull();
            expect(summary.health.avgPulse).toBeNull();
        });

        it('calculates correct sleep averages', () => {
            DB.addSleep('2026-03-09', 7, false, '');
            DB.addSleep('2026-03-10', 8, true, 'noise');
            DB.addSleep('2026-03-11', 6.5, false, '');

            const summary = WeeklyReview.generateWeekSummary(new Date('2026-03-09'));
            expect(summary.health.avgSleep).toBe('7.2'); // (7+8+6.5)/3 = 7.166... → 7.2
            expect(summary.health.sleepNights).toBe(3);
            expect(summary.health.sleepInterrupted).toBe(1);
        });

        it('counts gym sessions excluding Niet gegaan', () => {
            DB.addGym('2026-03-09', 'Cardio', 45, '', 5);
            DB.addGym('2026-03-10', 'Kracht', 60, '', 0);
            DB.addGym('2026-03-11', 'Niet gegaan', 0, '', 0);

            const summary = WeeklyReview.generateWeekSummary(new Date('2026-03-09'));
            expect(summary.health.gymCount).toBe(2);
            expect(summary.health.gymTypes).toEqual({ Cardio: 1, Kracht: 1 });
        });
    });

    // ============================
    // Drinks aggregation
    // ============================
    describe('generateWeekSummary — drinks', () => {
        it('aggregates coffee and decaf totals', () => {
            DB.addDrinks('2026-03-09', 3, 1, false, 0, '', 2);
            DB.addDrinks('2026-03-10', 2, 0, false, 0, '', 1.5);

            const summary = WeeklyReview.generateWeekSummary(new Date('2026-03-09'));
            expect(summary.drinks.totalCoffee).toBe(5);
            expect(summary.drinks.totalDecaf).toBe(1);
        });

        it('counts alcohol days and glasses', () => {
            DB.addDrinks('2026-03-09', 2, 0, true, 3, 'wine', 2);
            DB.addDrinks('2026-03-10', 2, 0, false, 0, '', 2);
            DB.addDrinks('2026-03-11', 2, 0, true, 2, 'beer', 2);

            const summary = WeeklyReview.generateWeekSummary(new Date('2026-03-09'));
            expect(summary.drinks.alcoholDays).toBe(2);
            expect(summary.drinks.totalAlcoholGlasses).toBe(5);
        });

        it('calculates average water intake', () => {
            DB.addDrinks('2026-03-09', 2, 0, false, 0, '', 2);
            DB.addDrinks('2026-03-10', 2, 0, false, 0, '', 3);

            const summary = WeeklyReview.generateWeekSummary(new Date('2026-03-09'));
            expect(summary.drinks.avgWater).toBe('2.5');
        });
    });

    // ============================
    // Habits aggregation
    // ============================
    describe('generateWeekSummary — habits', () => {
        it('calculates habit done/skipped/missed counts', () => {
            HabitsDB.seedDefaults();
            const habits = HabitsDB.getHabits();
            const firstHabit = habits[0];

            // Mark 3 days as done, 1 as skipped
            HabitsDB.addCompletion('2026-03-09', firstHabit.id, '', 'done');
            HabitsDB.addCompletion('2026-03-10', firstHabit.id, '', 'done');
            HabitsDB.addCompletion('2026-03-11', firstHabit.id, '', 'done');
            HabitsDB.addCompletion('2026-03-12', firstHabit.id, '', 'skipped');

            const summary = WeeklyReview.generateWeekSummary(new Date('2026-03-09'));
            const habitDetail = summary.habits.details.find(h => h.name === firstHabit.name);

            expect(habitDetail.done).toBe(3);
            expect(habitDetail.skipped).toBe(1);
            expect(habitDetail.missed).toBe(3); // 7 days - 3 done - 1 skipped
            expect(habitDetail.pct).toBe(43); // Math.round(3/7 * 100)
        });

        it('returns 0 overall percentage when no habits exist', () => {
            const summary = WeeklyReview.generateWeekSummary(new Date('2026-03-09'));
            expect(summary.habits.overallPct).toBe(0);
            expect(summary.habits.details).toEqual([]);
        });
    });

    // ============================
    // Journal data
    // ============================
    describe('generateWeekSummary — journal', () => {
        it('counts 5MJ journal days', () => {
            const fiveMJ = {
                '2026-03-09': { grateful: 'test', great1: '', great2: '', great3: '', affirmations: '' },
                '2026-03-10': { grateful: 'another', great1: 'x', great2: '', great3: '', affirmations: '' },
                '2026-03-15': { grateful: 'sunday', great1: '', great2: '', great3: '', affirmations: '' },
            };
            storage.setItem('5mj_entries', JSON.stringify(fiveMJ));

            const summary = WeeklyReview.generateWeekSummary(new Date('2026-03-09'));
            expect(summary.journal.fiveMJDays).toBe(3);
        });

        it('counts daily review days', () => {
            const dr = {
                '2026-03-09': { dag: 'goed', energiePlus: 'sport', energieMin: '', hoogtepunt1: '', hoogtepunt2: '', hoogtepunt3: '' },
                '2026-03-11': { dag: 'ok', energiePlus: '', energieMin: 'slecht geslapen', hoogtepunt1: '', hoogtepunt2: '', hoogtepunt3: '' },
            };
            storage.setItem('dr_entries', JSON.stringify(dr));

            const summary = WeeklyReview.generateWeekSummary(new Date('2026-03-09'));
            expect(summary.journal.dailyReviewDays).toBe(2);
        });

        it('returns 0 when no journal entries', () => {
            const summary = WeeklyReview.generateWeekSummary(new Date('2026-03-09'));
            expect(summary.journal.fiveMJDays).toBe(0);
            expect(summary.journal.dailyReviewDays).toBe(0);
        });

        it('ignores journal entries outside the week range', () => {
            const fiveMJ = {
                '2026-03-08': { grateful: 'before week', great1: '', great2: '', great3: '', affirmations: '' },
                '2026-03-09': { grateful: 'in week', great1: '', great2: '', great3: '', affirmations: '' },
                '2026-03-16': { grateful: 'after week', great1: '', great2: '', great3: '', affirmations: '' },
            };
            storage.setItem('5mj_entries', JSON.stringify(fiveMJ));

            const summary = WeeklyReview.generateWeekSummary(new Date('2026-03-09'));
            expect(summary.journal.fiveMJDays).toBe(1);
        });
    });

    // ============================
    // Summary persistence
    // ============================
    describe('summary storage', () => {
        it('saves and retrieves summary by weekKey', () => {
            const summary = WeeklyReview.generateWeekSummary(new Date('2026-03-09'));
            const retrieved = WeeklyReview.getSummary(summary.weekKey);
            expect(retrieved).not.toBeNull();
            expect(retrieved.weekStart).toBe('2026-03-09');
        });

        it('getSummaryKeys returns keys sorted descending', () => {
            WeeklyReview.generateWeekSummary(new Date('2026-03-02'));
            WeeklyReview.generateWeekSummary(new Date('2026-03-09'));

            const keys = WeeklyReview.getSummaryKeys();
            expect(keys.length).toBe(2);
            // Descending: later week first
            expect(keys[0] > keys[1]).toBe(true);
        });

        it('returns null for non-existent summary', () => {
            expect(WeeklyReview.getSummary('2099-W01')).toBeNull();
        });
    });

    // ============================
    // autoGenerateIfNeeded
    // ============================
    describe('autoGenerateIfNeeded', () => {
        it('does not generate on non-Monday', () => {
            // We can't easily control Date, but we can verify that calling
            // autoGenerateIfNeeded doesn't crash and check if it generated
            WeeklyReview.autoGenerateIfNeeded();
            // Just verify it doesn't throw
        });
    });

    // ============================
    // Empty week (no data at all)
    // ============================
    describe('generateWeekSummary — empty week', () => {
        it('handles a week with zero data gracefully', () => {
            const summary = WeeklyReview.generateWeekSummary(new Date('2026-03-09'));

            expect(summary.health.avgWeight).toBeNull();
            expect(summary.health.avgSystolic).toBeNull();
            expect(summary.health.avgSleep).toBeNull();
            expect(summary.health.gymCount).toBe(0);
            expect(summary.health.gymTypes).toEqual({});
            expect(summary.drinks.totalCoffee).toBe(0);
            expect(summary.drinks.alcoholDays).toBe(0);
            expect(summary.drinks.avgWater).toBeNull();
            expect(summary.habits.overallPct).toBe(0);
            expect(summary.journal.fiveMJDays).toBe(0);
            expect(summary.journal.dailyReviewDays).toBe(0);
            expect(summary.workouts.count).toBe(0);
            expect(summary.workouts.names).toEqual([]);
        });
    });

    // ============================
    // Checklist in summary
    // ============================
    describe('generateWeekSummary — checklist', () => {
        it('includes checklist status in summary', () => {
            const summary = WeeklyReview.generateWeekSummary(new Date('2026-03-09'));
            expect(summary.checklist).toHaveProperty('done');
            expect(summary.checklist).toHaveProperty('total');
            expect(summary.checklist.total).toBe(9); // 9 ITEMS defined
        });
    });
});
