// ============================================================
// habits-db.js — Habit Tracker data layer (LocalStorage)
// ============================================================

const HabitsDB = (() => {

    const HABITS_KEY = 'ht_habits';
    const COMPLETIONS_KEY = 'ht_completions';

    // --- Helpers ---
    function _get(key) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    }

    function _set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error('HabitsDB._set fout bij key:', key, e);
        }
    }

    function generateId() {
        return 'ht_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    function todayKey() {
        return dateKey(new Date());
    }

    function dateKey(date) {
        if (typeof date === 'string') return date;
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    // ============================================================
    // HABITS CRUD
    // ============================================================
    function _getHabitsRaw() {
        return _get(HABITS_KEY) || [];
    }

    function getHabits() {
        return _getHabitsRaw()
            .filter(h => !h.archived)
            .sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    function getAllHabits() {
        return _getHabitsRaw().sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    function getHabit(id) {
        return _getHabitsRaw().find(h => h.id === id) || null;
    }

    function addHabit(name, icon, color, category, goalFrequency, goalCount) {
        const habits = _getHabitsRaw();
        const maxOrder = habits.reduce((max, h) => Math.max(max, h.order || 0), -1);
        const habit = {
            id: generateId(),
            name,
            icon: icon || '✅',
            color: color || '#007aff',
            category: category || '',
            goal: {
                frequency: goalFrequency || 'daily',
                count: goalCount || 1,
            },
            createdAt: new Date().toISOString(),
            archived: false,
            order: maxOrder + 1,
        };
        habits.push(habit);
        _set(HABITS_KEY, habits);
        return habit;
    }

    function updateHabit(id, updates) {
        const habits = _getHabitsRaw();
        const idx = habits.findIndex(h => h.id === id);
        if (idx === -1) return null;
        Object.assign(habits[idx], updates);
        _set(HABITS_KEY, habits);
        return habits[idx];
    }

    function deleteHabit(id) {
        return updateHabit(id, { archived: true });
    }

    function restoreHabit(id) {
        return updateHabit(id, { archived: false });
    }

    function reorderHabits(orderedIds) {
        const habits = _getHabitsRaw();
        orderedIds.forEach((id, idx) => {
            const h = habits.find(h => h.id === id);
            if (h) h.order = idx;
        });
        _set(HABITS_KEY, habits);
    }

    // ============================================================
    // COMPLETIONS
    // ============================================================
    function _getCompletionsRaw() {
        return _get(COMPLETIONS_KEY) || {};
    }

    function getCompletionsForDate(dateStr) {
        const all = _getCompletionsRaw();
        return all[dateStr] || [];
    }

    function getCompletionsForHabit(habitId, dateStr) {
        return getCompletionsForDate(dateStr).filter(c => c.habitId === habitId);
    }

    function addCompletion(dateStr, habitId, note, status) {
        const all = _getCompletionsRaw();
        if (!all[dateStr]) all[dateStr] = [];
        const completion = {
            id: generateId(),
            habitId,
            timestamp: new Date().toISOString(),
            note: note || '',
            status: status || 'done',
        };
        all[dateStr].push(completion);
        _set(COMPLETIONS_KEY, all);
        return completion;
    }

    function removeCompletion(dateStr, completionId) {
        const all = _getCompletionsRaw();
        if (!all[dateStr]) return;
        all[dateStr] = all[dateStr].filter(c => c.id !== completionId);
        if (all[dateStr].length === 0) delete all[dateStr];
        _set(COMPLETIONS_KEY, all);
    }

    function removeLastCompletion(dateStr, habitId) {
        const all = _getCompletionsRaw();
        if (!all[dateStr]) return;
        const idx = all[dateStr].findLastIndex(c => c.habitId === habitId);
        if (idx !== -1) {
            all[dateStr].splice(idx, 1);
            if (all[dateStr].length === 0) delete all[dateStr];
            _set(COMPLETIONS_KEY, all);
        }
    }

    function getCompletionsForHabitInRange(habitId, startDate, endDate) {
        const all = _getCompletionsRaw();
        const result = {};
        const start = startDate;
        const end = endDate;
        for (const [dateStr, completions] of Object.entries(all)) {
            if (dateStr >= start && dateStr <= end) {
                const filtered = completions.filter(c => c.habitId === habitId);
                if (filtered.length > 0) {
                    result[dateStr] = filtered;
                }
            }
        }
        return result;
    }

    // ============================================================
    // STREAKS & STATS
    // ============================================================
    function _addDays(dateStr, days) {
        const d = new Date(dateStr + 'T00:00:00');
        d.setDate(d.getDate() + days);
        return dateKey(d);
    }

    function _getISOWeek(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        d.setDate(d.getDate() + 4 - (d.getDay() || 7));
        const yearStart = new Date(d.getFullYear(), 0, 1);
        const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
    }

    function _getMonthKey(dateStr) {
        return dateStr.slice(0, 7); // "2026-01"
    }

    function calculateStreak(habitId) {
        const habit = getHabit(habitId);
        if (!habit) return { current: 0, longest: 0 };

        const all = _getCompletionsRaw();
        const freq = habit.goal.frequency;
        const goalCount = habit.goal.count;

        if (freq === 'daily') {
            return _calculateDailyStreak(habitId, goalCount, all);
        } else if (freq === 'weekly') {
            return _calculateWeeklyStreak(habitId, goalCount, all);
        } else if (freq === 'monthly') {
            return _calculateMonthlyStreak(habitId, goalCount, all);
        }
        return { current: 0, longest: 0 };
    }

    function _calculateDailyStreak(habitId, goalCount, all) {
        let current = 0;
        let longest = 0;
        let streak = 0;
        let checkDate = todayKey();

        // Helper: count only "done" completions (exclude "skipped")
        function doneCount(dateStr) {
            return (all[dateStr] || []).filter(c => c.habitId === habitId && c.status !== 'skipped').length;
        }

        // Check if today is completed; if not, start from yesterday
        if (doneCount(checkDate) < goalCount) {
            checkDate = _addDays(checkDate, -1);
        }

        // Walk backwards — break immediately if a day is not met (streak = 0)
        for (let i = 0; i < 1000; i++) {
            if (doneCount(checkDate) >= goalCount) {
                streak++;
            } else {
                break;
            }
            checkDate = _addDays(checkDate, -1);
        }
        current = streak;

        // Calculate longest: scan all dates that have completions for this habit
        const dates = Object.keys(all).filter(d =>
            (all[d] || []).some(c => c.habitId === habitId && c.status !== 'skipped')
        ).sort();
        if (dates.length === 0) return { current, longest: current };

        streak = 0;
        let expectedDate = dates[0];
        for (const d of dates) {
            const count = doneCount(d);
            if (d === expectedDate && count >= goalCount) {
                streak++;
            } else if (d > expectedDate || count < goalCount) {
                longest = Math.max(longest, streak);
                streak = count >= goalCount ? 1 : 0;
            }
            expectedDate = _addDays(d, 1);
        }
        longest = Math.max(longest, streak, current);

        return { current, longest };
    }

    function _calculateWeeklyStreak(habitId, goalCount, all) {
        // Group completions by ISO week
        const weekCounts = {};
        for (const [dateStr, completions] of Object.entries(all)) {
            const week = _getISOWeek(dateStr);
            const count = completions.filter(c => c.habitId === habitId).length;
            weekCounts[week] = (weekCounts[week] || 0) + count;
        }

        const currentWeek = _getISOWeek(todayKey());
        const weeks = Object.keys(weekCounts).sort().reverse();

        let current = 0;
        let checkWeek = currentWeek;
        // If current week not yet met, check previous week
        if ((weekCounts[checkWeek] || 0) < goalCount) {
            // Move to previous week
            const d = new Date(todayKey() + 'T00:00:00');
            d.setDate(d.getDate() - 7);
            checkWeek = _getISOWeek(dateKey(d));
        }
        for (const w of weeks) {
            if (w > checkWeek) continue;
            if ((weekCounts[w] || 0) >= goalCount) {
                current++;
            } else {
                break;
            }
        }

        const longest = Math.max(current, ...(() => {
            const sortedWeeks = Object.keys(weekCounts).sort();
            let max = 0, streak = 0;
            for (const w of sortedWeeks) {
                if ((weekCounts[w] || 0) >= goalCount) { streak++; }
                else { max = Math.max(max, streak); streak = 0; }
            }
            return [Math.max(max, streak)];
        })());

        return { current, longest };
    }

    function _calculateMonthlyStreak(habitId, goalCount, all) {
        const monthCounts = {};
        for (const [dateStr, completions] of Object.entries(all)) {
            const month = _getMonthKey(dateStr);
            const count = completions.filter(c => c.habitId === habitId).length;
            monthCounts[month] = (monthCounts[month] || 0) + count;
        }

        const currentMonth = _getMonthKey(todayKey());
        const months = Object.keys(monthCounts).sort().reverse();

        let current = 0;
        let checkMonth = currentMonth;
        if ((monthCounts[checkMonth] || 0) < goalCount) {
            const d = new Date(todayKey() + 'T00:00:00');
            d.setMonth(d.getMonth() - 1);
            checkMonth = _getMonthKey(dateKey(d));
        }
        for (const m of months) {
            if (m > checkMonth) continue;
            if ((monthCounts[m] || 0) >= goalCount) {
                current++;
            } else {
                break;
            }
        }

        const longest = Math.max(current, ...(() => {
            const sortedMonths = Object.keys(monthCounts).sort();
            let max = 0, streak = 0;
            for (const m of sortedMonths) {
                if ((monthCounts[m] || 0) >= goalCount) { streak++; }
                else { max = Math.max(max, streak); streak = 0; }
            }
            return [Math.max(max, streak)];
        })());

        return { current, longest };
    }

    function getCompletionRate(habitId, period) {
        const habit = getHabit(habitId);
        if (!habit) return 0;

        const today = todayKey();
        let startDate;

        if (period === 'week') {
            startDate = _addDays(today, -6);
        } else if (period === 'month') {
            startDate = _addDays(today, -29);
        } else {
            // all time — use creation date
            startDate = habit.createdAt.slice(0, 10);
        }

        const completions = getCompletionsForHabitInRange(habitId, startDate, today);
        const freq = habit.goal.frequency;
        const goalCount = habit.goal.count;

        if (freq === 'daily') {
            // Count days from startDate to today
            const start = new Date(startDate + 'T00:00:00');
            const end = new Date(today + 'T00:00:00');
            const totalDays = Math.floor((end - start) / 86400000) + 1;
            let completedDays = 0;
            for (let i = 0; i < totalDays; i++) {
                const d = _addDays(startDate, i);
                const count = (completions[d] || []).length;
                if (count >= goalCount) completedDays++;
            }
            return totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;
        }

        // For weekly/monthly, simplified: count total completions vs expected
        const totalCompletions = Object.values(completions).reduce((sum, arr) => sum + arr.length, 0);
        const start = new Date(startDate + 'T00:00:00');
        const end = new Date(today + 'T00:00:00');

        if (freq === 'weekly') {
            const weeks = Math.max(1, Math.ceil(((end - start) / 86400000 + 1) / 7));
            const expected = weeks * goalCount;
            return expected > 0 ? Math.min(100, Math.round((totalCompletions / expected) * 100)) : 0;
        } else {
            const months = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1);
            const expected = months * goalCount;
            return expected > 0 ? Math.min(100, Math.round((totalCompletions / expected) * 100)) : 0;
        }
    }

    function getHabitStats(habitId) {
        const streak = calculateStreak(habitId);
        return {
            currentStreak: streak.current,
            longestStreak: streak.longest,
            rateWeek: getCompletionRate(habitId, 'week'),
            rateMonth: getCompletionRate(habitId, 'month'),
            rateAll: getCompletionRate(habitId, 'all'),
        };
    }

    // ============================================================
    // SEED DATA — default habits
    // ============================================================
    const DEFAULT_HABITS = [
        // HEALTH
        { name: 'Hydrate',      icon: '💧', color: '#007aff', category: 'HEALTH',  order: 0 },
        { name: 'Meditatie',    icon: '🧘', color: '#af52de', category: 'HEALTH',  order: 1 },
        { name: 'R&S',          icon: '🌅', color: '#ff9500', category: 'HEALTH',  order: 2 },
        { name: 'Movement',     icon: '🏃', color: '#34c759', category: 'HEALTH',  order: 3 },
        { name: 'Supplementen', icon: '💊', color: '#ff3b30', category: 'HEALTH',  order: 4 },
        // OPSTART
        { name: 'Mail',         icon: '📧', color: '#007aff', category: 'OPSTART', order: 5 },
        { name: 'Berichten',    icon: '💬', color: '#34c759', category: 'OPSTART', order: 6 },
        { name: 'MSTD',         icon: '📋', color: '#ff9500', category: 'OPSTART', order: 7 },
        { name: 'Linkedin',     icon: '🔗', color: '#5856d6', category: 'OPSTART', order: 8 },
        { name: 'Admin',        icon: '🗂️', color: '#8e8e93', category: 'OPSTART', order: 9 },
        { name: 'Lezen',        icon: '📚', color: '#af52de', category: 'OPSTART', order: 10 },
        { name: '5MJ',          icon: '📓', color: '#ff3b30', category: 'OPSTART', order: 11 },
        // OPRUIMEN
        { name: 'Daily Review', icon: '📝', color: '#5856d6', category: 'OPRUIMEN', order: 12 },
    ];

    function seedDefaults() {
        const existing = _getHabitsRaw();
        if (existing.length > 0) return; // already has habits, don't overwrite

        const habits = DEFAULT_HABITS.map(h => ({
            id: generateId(),
            name: h.name,
            icon: h.icon,
            color: h.color,
            category: h.category,
            goal: { frequency: 'daily', count: 1 },
            createdAt: new Date().toISOString(),
            archived: false,
            order: h.order,
        }));
        _set(HABITS_KEY, habits);
    }

    // ============================================================
    // MIGRATIONS — add new default habits to existing users
    // ============================================================
    function migrate() {
        const existing = _getHabitsRaw();
        if (existing.length === 0) return; // no data yet, seedDefaults will handle it

        const newDefaults = [
            { name: '5MJ', icon: '📓', color: '#ff3b30', category: 'OPSTART' },
            { name: 'Daily Review', icon: '📝', color: '#5856d6', category: 'OPRUIMEN' },
        ];

        // Remove habits that were added by mistake
        const removeNames = ['Gym'];
        const filtered = existing.filter(h => !removeNames.includes(h.name));

        let maxOrder = filtered.reduce((max, h) => Math.max(max, h.order || 0), -1);

        for (const def of newDefaults) {
            const existingHabit = filtered.find(h => h.name === def.name);
            if (!existingHabit) {
                maxOrder++;
                filtered.push({
                    id: generateId(),
                    name: def.name,
                    icon: def.icon,
                    color: def.color,
                    category: def.category,
                    goal: { frequency: 'daily', count: 1 },
                    createdAt: new Date().toISOString(),
                    archived: false,
                    order: maxOrder,
                });
            } else {
                // Restore archived habits and ensure correct category
                existingHabit.archived = false;
                existingHabit.category = def.category;
                existingHabit.icon = def.icon;
                existingHabit.color = def.color;
            }
        }
        _set(HABITS_KEY, filtered);
    }

    // ============================================================
    // PUBLIC API
    // ============================================================
    return {
        todayKey,
        dateKey,
        // Habits
        getHabits,
        getAllHabits,
        getHabit,
        addHabit,
        updateHabit,
        deleteHabit,
        restoreHabit,
        reorderHabits,
        // Completions
        getCompletionsForDate,
        getCompletionsForHabit,
        addCompletion,
        removeCompletion,
        removeLastCompletion,
        getCompletionsForHabitInRange,
        // Stats
        calculateStreak,
        getCompletionRate,
        getHabitStats,
        // Seed & migrate
        seedDefaults,
        migrate,
    };
})();
