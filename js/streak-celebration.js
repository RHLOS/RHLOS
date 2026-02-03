// ============================================================
// streak-celebration.js — Streak milestone celebrations
// ============================================================

const StreakCelebration = (() => {

    const MILESTONES = [7, 14, 21, 30, 60, 90, 100, 150, 200, 365];
    const SHOWN_KEY = 'streak_celebrations_shown';

    const MESSAGES = {
        7:   { emoji: '🔥', title: '1 week streak!', sub: 'Een hele week volgehouden. Sterke start!' },
        14:  { emoji: '⚡', title: '2 weken streak!', sub: 'Twee weken op rij. Het wordt een gewoonte!' },
        21:  { emoji: '💪', title: '3 weken streak!', sub: 'Drie weken! Wetenschappelijk bewezen gewoonte.' },
        30:  { emoji: '🏆', title: '30 dagen streak!', sub: 'Een volledige maand! Ongelooflijk.' },
        60:  { emoji: '🌟', title: '60 dagen streak!', sub: 'Twee maanden! Dit is wie je bent.' },
        90:  { emoji: '👑', title: '90 dagen streak!', sub: 'Een kwartaal! Niet meer te stoppen.' },
        100: { emoji: '💯', title: '100 dagen streak!', sub: 'Driecijferig! Legendarisch.' },
        150: { emoji: '🚀', title: '150 dagen streak!', sub: 'Halverwege het jaar! Respect.' },
        200: { emoji: '🎯', title: '200 dagen streak!', sub: 'Tweehonderd dagen. Fenomenaal.' },
        365: { emoji: '🎉', title: 'Een heel jaar!', sub: '365 dagen streak! Je bent een legende.' },
    };

    function _getShown() {
        try {
            return JSON.parse(localStorage.getItem(SHOWN_KEY)) || {};
        } catch { return {}; }
    }

    function _setShown(data) {
        localStorage.setItem(SHOWN_KEY, JSON.stringify(data));
    }

    /**
     * Check if a habit just hit a streak milestone and show celebration.
     * Call this after toggling a completion to "done".
     */
    function checkAndCelebrate(habitId) {
        const streak = HabitsDB.calculateStreak(habitId);
        const current = streak.current;

        // Only celebrate milestones
        if (!MILESTONES.includes(current)) return;

        // Check if we already showed this milestone for this habit
        const shown = _getShown();
        const key = habitId + '_' + current;
        if (shown[key]) return;

        // Mark as shown
        shown[key] = Date.now();
        _setShown(shown);

        // Get habit info for personalization
        const habit = HabitsDB.getHabit(habitId);
        const msg = MESSAGES[current] || { emoji: '🎉', title: current + ' dagen streak!', sub: 'Geweldig volgehouden!' };

        show(msg.emoji, msg.title, (habit ? habit.icon + ' ' + habit.name + ' — ' : '') + msg.sub);
    }

    function show(emoji, title, sub) {
        document.getElementById('streak-emoji').textContent = emoji;
        document.getElementById('streak-title').textContent = title;
        document.getElementById('streak-sub').textContent = sub;
        document.getElementById('streak-overlay').classList.add('visible');
        document.getElementById('streak-toast').classList.add('visible');
    }

    function dismiss() {
        document.getElementById('streak-overlay').classList.remove('visible');
        document.getElementById('streak-toast').classList.remove('visible');
    }

    return { checkAndCelebrate, dismiss };
})();
