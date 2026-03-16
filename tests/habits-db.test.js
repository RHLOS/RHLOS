import { describe, it, expect, beforeEach } from 'vitest';
import { loadModules } from './setup.js';

let HabitsDB;
let sandbox;

function today() {
    return HabitsDB.todayKey();
}

function addDays(dateStr, days) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return HabitsDB.dateKey(d);
}

function createHabit(overrides = {}) {
    return HabitsDB.addHabit(
        overrides.name || 'Test Habit',
        overrides.icon || '✅',
        overrides.color || '#007aff',
        overrides.category || 'TEST',
        overrides.goalFrequency || 'daily',
        overrides.goalCount || 1,
    );
}

function addCompletionsForDays(habitId, endDate, count, perDay = 1) {
    for (let i = count - 1; i >= 0; i--) {
        const d = addDays(endDate, -i);
        for (let j = 0; j < perDay; j++) {
            HabitsDB.addCompletion(d, habitId);
        }
    }
}

describe('HabitsDB', () => {
    beforeEach(() => {
        sandbox = loadModules('js/habits-db.js');
        HabitsDB = sandbox.HabitsDB;
    });

    // ============================
    // dateKey helper
    // ============================
    describe('dateKey', () => {
        it('formats a Date object to YYYY-MM-DD', () => {
            const d = new Date(2026, 0, 5);
            expect(HabitsDB.dateKey(d)).toBe('2026-01-05');
        });

        it('zero-pads single digit months and days', () => {
            const d = new Date(2026, 2, 3);
            expect(HabitsDB.dateKey(d)).toBe('2026-03-03');
        });

        it('returns strings as-is', () => {
            expect(HabitsDB.dateKey('2026-12-25')).toBe('2026-12-25');
        });
    });

    // ============================
    // CRUD
    // ============================
    describe('Habits CRUD', () => {
        it('addHabit creates a habit with correct defaults', () => {
            const habit = createHabit({ name: 'Meditate' });
            expect(habit.name).toBe('Meditate');
            expect(habit.icon).toBe('✅');
            expect(habit.archived).toBe(false);
            expect(habit.goal).toEqual({ frequency: 'daily', count: 1 });
            expect(habit.id).toMatch(/^ht_/);
        });

        it('getHabits excludes archived habits', () => {
            createHabit({ name: 'Active' });
            const h2 = createHabit({ name: 'Archived' });
            HabitsDB.deleteHabit(h2.id);
            const habits = HabitsDB.getHabits();
            expect(habits).toHaveLength(1);
            expect(habits[0].name).toBe('Active');
        });

        it('getAllHabits includes archived habits', () => {
            createHabit({ name: 'A' });
            const h2 = createHabit({ name: 'B' });
            HabitsDB.deleteHabit(h2.id);
            expect(HabitsDB.getAllHabits()).toHaveLength(2);
        });

        it('getHabit returns null for nonexistent id', () => {
            expect(HabitsDB.getHabit('nonexistent')).toBeNull();
        });

        it('updateHabit modifies fields', () => {
            const h = createHabit({ name: 'Old' });
            const updated = HabitsDB.updateHabit(h.id, { name: 'New' });
            expect(updated.name).toBe('New');
            expect(HabitsDB.getHabit(h.id).name).toBe('New');
        });

        it('updateHabit returns null for nonexistent id', () => {
            expect(HabitsDB.updateHabit('nope', { name: 'X' })).toBeNull();
        });

        it('restoreHabit unarchives a habit', () => {
            const h = createHabit();
            HabitsDB.deleteHabit(h.id);
            expect(HabitsDB.getHabit(h.id).archived).toBe(true);
            HabitsDB.restoreHabit(h.id);
            expect(HabitsDB.getHabit(h.id).archived).toBe(false);
        });

        it('reorderHabits sets order values', () => {
            const h1 = createHabit({ name: 'A' });
            const h2 = createHabit({ name: 'B' });
            HabitsDB.reorderHabits([h2.id, h1.id]);
            const habits = HabitsDB.getHabits();
            expect(habits[0].name).toBe('B');
            expect(habits[1].name).toBe('A');
        });

        it('addHabit auto-increments order', () => {
            const h1 = createHabit({ name: 'First' });
            const h2 = createHabit({ name: 'Second' });
            expect(h2.order).toBe(h1.order + 1);
        });
    });

    // ============================
    // Completions
    // ============================
    describe('Completions', () => {
        it('addCompletion creates a completion with defaults', () => {
            const h = createHabit();
            const c = HabitsDB.addCompletion('2026-03-10', h.id);
            expect(c.habitId).toBe(h.id);
            expect(c.status).toBe('done');
            expect(c.note).toBe('');
            expect(c.id).toMatch(/^ht_/);
        });

        it('addCompletion with custom status and note', () => {
            const h = createHabit();
            const c = HabitsDB.addCompletion('2026-03-10', h.id, 'feeling tired', 'skipped');
            expect(c.status).toBe('skipped');
            expect(c.note).toBe('feeling tired');
        });

        it('getCompletionsForDate returns completions for that date', () => {
            const h = createHabit();
            HabitsDB.addCompletion('2026-03-10', h.id);
            HabitsDB.addCompletion('2026-03-10', h.id);
            HabitsDB.addCompletion('2026-03-11', h.id);
            expect(HabitsDB.getCompletionsForDate('2026-03-10')).toHaveLength(2);
            expect(HabitsDB.getCompletionsForDate('2026-03-12')).toHaveLength(0);
        });

        it('getCompletionsForHabit filters by habitId', () => {
            const h1 = createHabit({ name: 'A' });
            const h2 = createHabit({ name: 'B' });
            HabitsDB.addCompletion('2026-03-10', h1.id);
            HabitsDB.addCompletion('2026-03-10', h2.id);
            expect(HabitsDB.getCompletionsForHabit(h1.id, '2026-03-10')).toHaveLength(1);
        });

        it('removeCompletion removes a specific completion', () => {
            const h = createHabit();
            const c1 = HabitsDB.addCompletion('2026-03-10', h.id);
            HabitsDB.addCompletion('2026-03-10', h.id);
            HabitsDB.removeCompletion('2026-03-10', c1.id);
            expect(HabitsDB.getCompletionsForDate('2026-03-10')).toHaveLength(1);
        });

        it('removeCompletion deletes the date key when empty', () => {
            const h = createHabit();
            const c = HabitsDB.addCompletion('2026-03-10', h.id);
            HabitsDB.removeCompletion('2026-03-10', c.id);
            expect(HabitsDB.getCompletionsForDate('2026-03-10')).toHaveLength(0);
        });

        it('removeLastCompletion removes the last completion for a habit', () => {
            const h = createHabit();
            HabitsDB.addCompletion('2026-03-10', h.id, 'first');
            HabitsDB.addCompletion('2026-03-10', h.id, 'second');
            HabitsDB.removeLastCompletion('2026-03-10', h.id);
            const remaining = HabitsDB.getCompletionsForHabit(h.id, '2026-03-10');
            expect(remaining).toHaveLength(1);
            expect(remaining[0].note).toBe('first');
        });

        it('getCompletionsForHabitInRange filters by date range', () => {
            const h = createHabit();
            HabitsDB.addCompletion('2026-03-08', h.id);
            HabitsDB.addCompletion('2026-03-10', h.id);
            HabitsDB.addCompletion('2026-03-12', h.id);
            const result = HabitsDB.getCompletionsForHabitInRange(h.id, '2026-03-09', '2026-03-11');
            expect(Object.keys(result)).toEqual(['2026-03-10']);
        });
    });

    // ============================
    // Daily Streak Calculations
    // ============================
    describe('Daily Streaks', () => {
        it('returns 0/0 for nonexistent habit', () => {
            expect(HabitsDB.calculateStreak('nonexistent')).toEqual({ current: 0, longest: 0 });
        });

        it('returns 0/0 for habit with no completions', () => {
            const h = createHabit();
            expect(HabitsDB.calculateStreak(h.id)).toEqual({ current: 0, longest: 0 });
        });

        it('counts consecutive days ending today', () => {
            const h = createHabit();
            const t = today();
            addCompletionsForDays(h.id, t, 5);
            const streak = HabitsDB.calculateStreak(h.id);
            expect(streak.current).toBe(5);
            expect(streak.longest).toBe(5);
        });

        it('starts from yesterday if today not completed', () => {
            const h = createHabit();
            const yesterday = addDays(today(), -1);
            addCompletionsForDays(h.id, yesterday, 3);
            const streak = HabitsDB.calculateStreak(h.id);
            expect(streak.current).toBe(3);
        });

        it('breaks streak on gap', () => {
            const h = createHabit();
            const t = today();
            HabitsDB.addCompletion(t, h.id);
            HabitsDB.addCompletion(addDays(t, -1), h.id);
            // Gap at day -2
            HabitsDB.addCompletion(addDays(t, -3), h.id);
            HabitsDB.addCompletion(addDays(t, -4), h.id);
            const streak = HabitsDB.calculateStreak(h.id);
            expect(streak.current).toBe(2);
            expect(streak.longest).toBe(2);
        });

        it('skipped completions do not count toward streak', () => {
            const h = createHabit();
            const t = today();
            HabitsDB.addCompletion(t, h.id, '', 'done');
            HabitsDB.addCompletion(addDays(t, -1), h.id, '', 'skipped');
            const streak = HabitsDB.calculateStreak(h.id);
            expect(streak.current).toBe(1);
        });

        it('respects goalCount > 1', () => {
            const h = createHabit({ goalCount: 2 });
            const t = today();
            // Day with 2 completions — meets goal
            HabitsDB.addCompletion(t, h.id);
            HabitsDB.addCompletion(t, h.id);
            // Day with only 1 completion — does not meet goal
            HabitsDB.addCompletion(addDays(t, -1), h.id);
            const streak = HabitsDB.calculateStreak(h.id);
            expect(streak.current).toBe(1);
        });

        it('longest streak captures historical streaks longer than current', () => {
            const h = createHabit();
            const t = today();
            // Old 5-day streak (days -14 through -10)
            for (let i = 14; i >= 10; i--) {
                HabitsDB.addCompletion(addDays(t, -i), h.id);
            }
            // Current 2-day streak
            HabitsDB.addCompletion(t, h.id);
            HabitsDB.addCompletion(addDays(t, -1), h.id);
            const streak = HabitsDB.calculateStreak(h.id);
            expect(streak.current).toBe(2);
            expect(streak.longest).toBe(5);
        });

        it('single day completion gives streak of 1', () => {
            const h = createHabit();
            HabitsDB.addCompletion(today(), h.id);
            const streak = HabitsDB.calculateStreak(h.id);
            expect(streak.current).toBe(1);
            expect(streak.longest).toBe(1);
        });

        it('longest streak: mid-streak day under goalCount breaks the streak', () => {
            const h = createHabit({ goalCount: 2 });
            const t = today();
            // Days -4 to -3: both meet goal (2 completions each)
            for (const offset of [-4, -3]) {
                HabitsDB.addCompletion(addDays(t, offset), h.id);
                HabitsDB.addCompletion(addDays(t, offset), h.id);
            }
            // Day -2: only 1 completion (under goalCount=2) — should break streak
            HabitsDB.addCompletion(addDays(t, -2), h.id);
            // Days -1 to 0: both meet goal
            for (const offset of [-1, 0]) {
                HabitsDB.addCompletion(addDays(t, offset), h.id);
                HabitsDB.addCompletion(addDays(t, offset), h.id);
            }
            const streak = HabitsDB.calculateStreak(h.id);
            expect(streak.current).toBe(2);
            expect(streak.longest).toBe(2);
        });

        it('longest streak: first date under goalCount does not start a streak', () => {
            const h = createHabit({ goalCount: 2 });
            const t = today();
            // Day -3: 1 completion (under goal)
            HabitsDB.addCompletion(addDays(t, -3), h.id);
            // Days -2 to 0: 2 completions each (meets goal)
            for (const offset of [-2, -1, 0]) {
                HabitsDB.addCompletion(addDays(t, offset), h.id);
                HabitsDB.addCompletion(addDays(t, offset), h.id);
            }
            const streak = HabitsDB.calculateStreak(h.id);
            expect(streak.current).toBe(3);
            expect(streak.longest).toBe(3);
        });

        it('longest streak: all dates under goalCount gives longest 0', () => {
            const h = createHabit({ goalCount: 3 });
            const t = today();
            // 5 consecutive days, each with only 1 completion (goalCount=3)
            for (let i = 0; i < 5; i++) {
                HabitsDB.addCompletion(addDays(t, -i), h.id);
            }
            const streak = HabitsDB.calculateStreak(h.id);
            expect(streak.current).toBe(0);
            expect(streak.longest).toBe(0);
        });

        it('longest streak: multiple separate streaks picks the longest', () => {
            const h = createHabit();
            const t = today();
            // Old 4-day streak (days -20 to -17)
            for (let i = 20; i >= 17; i--) {
                HabitsDB.addCompletion(addDays(t, -i), h.id);
            }
            // Middle 2-day streak (days -10 to -9)
            HabitsDB.addCompletion(addDays(t, -10), h.id);
            HabitsDB.addCompletion(addDays(t, -9), h.id);
            // Current 1-day streak
            HabitsDB.addCompletion(t, h.id);
            const streak = HabitsDB.calculateStreak(h.id);
            expect(streak.current).toBe(1);
            expect(streak.longest).toBe(4);
        });

        it('longest streak: skipped days in dates array do not count', () => {
            const h = createHabit();
            const t = today();
            // 3-day streak
            HabitsDB.addCompletion(addDays(t, -2), h.id);
            HabitsDB.addCompletion(addDays(t, -1), h.id);
            HabitsDB.addCompletion(t, h.id);
            // A skipped completion on day -3 should NOT extend the streak
            HabitsDB.addCompletion(addDays(t, -3), h.id, '', 'skipped');
            const streak = HabitsDB.calculateStreak(h.id);
            expect(streak.current).toBe(3);
            expect(streak.longest).toBe(3);
        });
    });

    // ============================
    // Weekly Streak Calculations
    // ============================
    describe('Weekly Streaks', () => {
        it('counts weekly completions grouped by ISO week', () => {
            const h = createHabit({ goalFrequency: 'weekly', goalCount: 1 });
            const t = today();
            HabitsDB.addCompletion(t, h.id);
            HabitsDB.addCompletion(addDays(t, -7), h.id);
            const streak = HabitsDB.calculateStreak(h.id);
            expect(streak.current).toBeGreaterThanOrEqual(1);
        });

        it('returns 0 current streak when no weeks meet goal', () => {
            const h = createHabit({ goalFrequency: 'weekly', goalCount: 5 });
            HabitsDB.addCompletion(today(), h.id);
            const streak = HabitsDB.calculateStreak(h.id);
            expect(streak.current).toBe(0);
        });
    });

    // ============================
    // Monthly Streak Calculations
    // ============================
    describe('Monthly Streaks', () => {
        it('counts monthly completions', () => {
            const h = createHabit({ goalFrequency: 'monthly', goalCount: 1 });
            HabitsDB.addCompletion(today(), h.id);
            const streak = HabitsDB.calculateStreak(h.id);
            expect(streak.current).toBeGreaterThanOrEqual(1);
        });

        it('returns 0 for unknown frequency', () => {
            const h = createHabit({ goalFrequency: 'yearly' });
            HabitsDB.addCompletion(today(), h.id);
            expect(HabitsDB.calculateStreak(h.id)).toEqual({ current: 0, longest: 0 });
        });
    });

    // ============================
    // Completion Rate
    // ============================
    describe('getCompletionRate', () => {
        it('returns 0 for nonexistent habit', () => {
            expect(HabitsDB.getCompletionRate('nope', 'week')).toBe(0);
        });

        it('calculates daily rate for a week', () => {
            const h = createHabit();
            const t = today();
            addCompletionsForDays(h.id, t, 7);
            const rate = HabitsDB.getCompletionRate(h.id, 'week');
            expect(rate).toBe(100);
        });

        it('calculates partial daily rate', () => {
            const h = createHabit();
            const t = today();
            addCompletionsForDays(h.id, t, 3);
            const rate = HabitsDB.getCompletionRate(h.id, 'week');
            expect(rate).toBe(43);
        });

        it('calculates rate for month period', () => {
            const h = createHabit();
            const t = today();
            addCompletionsForDays(h.id, t, 15);
            const rate = HabitsDB.getCompletionRate(h.id, 'month');
            expect(rate).toBe(50);
        });

        it('caps weekly rate at 100%', () => {
            const h = createHabit({ goalFrequency: 'weekly', goalCount: 1 });
            const t = today();
            addCompletionsForDays(h.id, t, 7);
            const rate = HabitsDB.getCompletionRate(h.id, 'week');
            expect(rate).toBeLessThanOrEqual(100);
        });
    });

    // ============================
    // Seed & Migrate
    // ============================
    describe('seedDefaults', () => {
        it('seeds default habits when none exist', () => {
            HabitsDB.seedDefaults();
            const habits = HabitsDB.getAllHabits();
            expect(habits.length).toBeGreaterThan(0);
            expect(habits[0].goal).toEqual({ frequency: 'daily', count: 1 });
        });

        it('does not overwrite existing habits', () => {
            createHabit({ name: 'My Custom Habit' });
            HabitsDB.seedDefaults();
            expect(HabitsDB.getAllHabits()).toHaveLength(1);
        });
    });

    describe('migrate', () => {
        it('adds missing default habits', () => {
            createHabit({ name: 'Existing' });
            HabitsDB.migrate();
            const names = HabitsDB.getAllHabits().map(h => h.name);
            expect(names).toContain('5MJ');
            expect(names).toContain('Daily Review');
            expect(names).toContain('Existing');
        });

        it('removes habits named Gym', () => {
            createHabit({ name: 'Gym' });
            createHabit({ name: 'Keep' });
            HabitsDB.migrate();
            const names = HabitsDB.getAllHabits().map(h => h.name);
            expect(names).not.toContain('Gym');
            expect(names).toContain('Keep');
        });

        it('restores archived default habits', () => {
            const h = HabitsDB.addHabit('5MJ', '📓', '#ff3b30', 'OPSTART', 'daily', 1);
            HabitsDB.deleteHabit(h.id);
            expect(HabitsDB.getHabit(h.id).archived).toBe(true);
            HabitsDB.migrate();
            expect(HabitsDB.getHabit(h.id).archived).toBe(false);
        });

        it('does nothing when no habits exist yet', () => {
            HabitsDB.migrate();
            expect(HabitsDB.getAllHabits()).toHaveLength(0);
        });
    });

    // ============================
    // getHabitStats
    // ============================
    describe('getHabitStats', () => {
        it('returns all stats for a habit', () => {
            const h = createHabit();
            addCompletionsForDays(h.id, today(), 3);
            const stats = HabitsDB.getHabitStats(h.id);
            expect(stats).toHaveProperty('currentStreak');
            expect(stats).toHaveProperty('longestStreak');
            expect(stats).toHaveProperty('rateWeek');
            expect(stats).toHaveProperty('rateMonth');
            expect(stats).toHaveProperty('rateAll');
            expect(stats.currentStreak).toBe(3);
        });
    });
});
