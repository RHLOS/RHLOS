// ============================================================
// 5mj-app.js — Journal controller for RHLOS
// ============================================================

const FiveMJ = (() => {

    const STORAGE_KEY = '5mj_entries';
    const DR_STORAGE_KEY = 'dr_entries';
    let currentDate = new Date();
    let drDate = new Date();

    function init() {
        updateHeaderDate();
    }

    // --- Helpers ---

    function dateKey(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function updateHeaderDate() {
        const dateEl = document.getElementById('5mj-date');
        if (dateEl) {
            dateEl.textContent = new Date().toLocaleDateString('nl-NL', {
                weekday: 'long', day: 'numeric', month: 'long'
            });
        }
    }

    function updateNavDate() {
        const el = document.getElementById('5mj-nav-date');
        if (!el) return;
        const today = new Date();
        if (dateKey(currentDate) === dateKey(today)) {
            el.textContent = 'Vandaag';
        } else {
            el.textContent = currentDate.toLocaleDateString('nl-NL', {
                weekday: 'short', day: 'numeric', month: 'long'
            });
        }
    }

    // --- Storage ---

    function loadAll() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
        } catch { return {}; }
    }

    function saveAll(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.error('5MJ saveAll fout:', e);
        }
    }

    // --- Page navigation ---

    function showPage(pageId) {
        const panel = document.getElementById('panel-5mj');
        panel.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const target = document.getElementById('5mj-page-' + pageId);
        if (target) target.classList.add('active');
        window.scrollTo(0, 0);

        if (pageId === '5mj') {
            currentDate = new Date();
            updateNavDate();
            load5MJ();
        }
        if (pageId === 'daily') {
            drDate = new Date();
            updateDRNavDate();
            loadDailyReview();
        }
        if (pageId === 'weekly') {
            WeeklyReview.render();
        }
    }

    // --- 5MJ date navigation ---

    function prevDay() {
        currentDate.setDate(currentDate.getDate() - 1);
        updateNavDate();
        load5MJ();
    }

    function nextDay() {
        currentDate.setDate(currentDate.getDate() + 1);
        updateNavDate();
        load5MJ();
    }

    // --- 5MJ load & save ---

    function load5MJ() {
        const data = loadAll();
        const entry = data[dateKey(currentDate)] || {};

        document.getElementById('5mj-grateful').value = entry.grateful || '';
        document.getElementById('5mj-great-1').value = entry.great1 || '';
        document.getElementById('5mj-great-2').value = entry.great2 || '';
        document.getElementById('5mj-great-3').value = entry.great3 || '';
        document.getElementById('5mj-affirmations').value = entry.affirmations || '';
    }

    function save5MJ() {
        const data = loadAll();
        data[dateKey(currentDate)] = {
            grateful: document.getElementById('5mj-grateful').value.trim(),
            great1: document.getElementById('5mj-great-1').value.trim(),
            great2: document.getElementById('5mj-great-2').value.trim(),
            great3: document.getElementById('5mj-great-3').value.trim(),
            affirmations: document.getElementById('5mj-affirmations').value.trim()
        };
        saveAll(data);

        // Auto-check "5MJ" habit in Habit Tracker
        autoCheck5MJHabit();

        // Terug naar laag 1 (launcher)
        Layout.goHome();
    }

    function autoCheck5MJHabit() {
        const dStr = dateKey(currentDate);
        // Find the "5MJ" habit by name
        const habits = HabitsDB.getHabits();
        const habit = habits.find(h => h.name === '5MJ');
        if (!habit) return;

        // Only add completion if not already met for this date
        const completions = HabitsDB.getCompletionsForHabit(habit.id, dStr);
        if (completions.length >= habit.goal.count) return; // already checked

        HabitsDB.addCompletion(dStr, habit.id, 'Auto: Journal 5MJ ingevuld');
    }

    // --- Daily Review helpers ---

    function updateDRNavDate() {
        const el = document.getElementById('dr-nav-date');
        if (!el) return;
        const today = new Date();
        if (dateKey(drDate) === dateKey(today)) {
            el.textContent = 'Vandaag';
        } else {
            el.textContent = drDate.toLocaleDateString('nl-NL', {
                weekday: 'short', day: 'numeric', month: 'long'
            });
        }
    }

    function prevDayDR() {
        drDate.setDate(drDate.getDate() - 1);
        updateDRNavDate();
        loadDailyReview();
    }

    function nextDayDR() {
        drDate.setDate(drDate.getDate() + 1);
        updateDRNavDate();
        loadDailyReview();
    }

    // --- Daily Review storage ---

    function loadAllDR() {
        try {
            return JSON.parse(localStorage.getItem(DR_STORAGE_KEY)) || {};
        } catch { return {}; }
    }

    function saveAllDR(data) {
        try {
            localStorage.setItem(DR_STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.error('Daily Review saveAllDR fout:', e);
        }
    }

    // --- Daily Review load & save ---

    function loadDailyReview() {
        const data = loadAllDR();
        const entry = data[dateKey(drDate)] || {};

        document.getElementById('dr-dag').value = entry.dag || '';
        document.getElementById('dr-energie-plus').value = entry.energiePlus || '';
        document.getElementById('dr-energie-min').value = entry.energieMin || '';
        document.getElementById('dr-hoogtepunt-1').value = entry.hoogtepunt1 || '';
        document.getElementById('dr-hoogtepunt-2').value = entry.hoogtepunt2 || '';
        document.getElementById('dr-hoogtepunt-3').value = entry.hoogtepunt3 || '';
    }

    function saveDailyReview() {
        const data = loadAllDR();
        data[dateKey(drDate)] = {
            dag: document.getElementById('dr-dag').value.trim(),
            energiePlus: document.getElementById('dr-energie-plus').value.trim(),
            energieMin: document.getElementById('dr-energie-min').value.trim(),
            hoogtepunt1: document.getElementById('dr-hoogtepunt-1').value.trim(),
            hoogtepunt2: document.getElementById('dr-hoogtepunt-2').value.trim(),
            hoogtepunt3: document.getElementById('dr-hoogtepunt-3').value.trim(),
        };
        saveAllDR(data);

        // Auto-check "Daily Review" habit in Habit Tracker
        autoCheckDailyReviewHabit();

        // Terug naar Journal home
        showPage('home');
    }

    function autoCheckDailyReviewHabit() {
        const dStr = dateKey(drDate);
        const habits = HabitsDB.getHabits();
        const habit = habits.find(h => h.name === 'Daily Review');
        if (!habit) return;

        const completions = HabitsDB.getCompletionsForHabit(habit.id, dStr);
        if (completions.length >= habit.goal.count) return;

        HabitsDB.addCompletion(dStr, habit.id, 'Auto: Daily Review ingevuld');
    }

    return { init, showPage, prevDay, nextDay, save5MJ, prevDayDR, nextDayDR, saveDailyReview };
})();
