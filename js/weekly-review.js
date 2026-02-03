// ============================================================
// weekly-review.js — Weekly Review checklist + Week Summary
// ============================================================

const WeeklyReview = (() => {

    const STORAGE_KEY = 'wr_checklist';
    const HISTORY_KEY = 'wr_last_completed';
    const SUMMARY_KEY = 'wr_summaries';   // { "2026-W05": { ... }, ... }

    const ITEMS = [
        'mailboxen', 'notities', 'whatsapp', 'takenlijsten',
        'fotorol', 'admin', 'plannen', 'review', 'lezen'
    ];

    // Week offset for navigating summaries (0 = current/latest, -1 = vorige, etc.)
    let summaryWeekOffset = 0;

    // ========================================================
    // DATE HELPERS
    // ========================================================

    function _dateKey(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    /** Get the Monday of the week containing the given date */
    function _getMonday(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    /** Get ISO week key like "2026-W05" */
    function _getISOWeekKey(date) {
        const d = new Date(date);
        d.setDate(d.getDate() + 4 - (d.getDay() || 7));
        const yearStart = new Date(d.getFullYear(), 0, 1);
        const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
    }

    /** Generate array of YYYY-MM-DD strings from startDate to endDate */
    function _dateRange(startStr, endStr) {
        const dates = [];
        const current = new Date(startStr + 'T00:00:00');
        const end = new Date(endStr + 'T00:00:00');
        while (current <= end) {
            dates.push(_dateKey(current));
            current.setDate(current.getDate() + 1);
        }
        return dates;
    }

    /** Format date for display */
    function _formatDate(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
    }

    // ========================================================
    // CHECKLIST STORAGE (unchanged)
    // ========================================================

    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch { return {}; }
    }

    function save(state) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) {
            console.error('WeeklyReview save fout:', e);
        }
    }

    function getLastCompleted() {
        return localStorage.getItem(HISTORY_KEY) || null;
    }

    function saveLastCompleted() {
        const now = new Date();
        try {
            localStorage.setItem(HISTORY_KEY, now.toISOString());
        } catch (e) {
            console.error('WeeklyReview saveLastCompleted fout:', e);
        }
    }

    // ========================================================
    // SUMMARY STORAGE
    // ========================================================

    function _loadSummaries() {
        try {
            return JSON.parse(localStorage.getItem(SUMMARY_KEY)) || {};
        } catch { return {}; }
    }

    function _saveSummaries(data) {
        try {
            localStorage.setItem(SUMMARY_KEY, JSON.stringify(data));
        } catch (e) {
            console.error('WeeklyReview _saveSummaries fout:', e);
        }
    }

    function getSummary(weekKey) {
        return _loadSummaries()[weekKey] || null;
    }

    function getSummaryKeys() {
        return Object.keys(_loadSummaries()).sort().reverse();
    }

    // ========================================================
    // SUMMARY GENERATION
    // ========================================================

    /**
     * Generate a week summary for the given Monday-Sunday range.
     * Reads data from Health Logger (DB), Habits (HabitsDB),
     * Journal (5mj_entries, dr_entries), and Workouts.
     */
    function generateWeekSummary(mondayDate) {
        const monday = new Date(mondayDate);
        monday.setHours(0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setDate(sunday.getDate() + 6);

        const startStr = _dateKey(monday);
        const endStr = _dateKey(sunday);
        const weekKey = _getISOWeekKey(monday);
        const dates = _dateRange(startStr, endStr);

        // --- Health Logger data ---
        const hlDays = DB.getDaysInRange(startStr, endStr);
        const sessions = DB.getSessionsInRange(startStr, endStr);

        // Weight
        const allWeights = hlDays.flatMap(d => d.weights || []);
        const weightValues = allWeights.map(w => w.kg).filter(v => v > 0);
        const avgWeight = weightValues.length > 0
            ? (weightValues.reduce((a, b) => a + b, 0) / weightValues.length).toFixed(1)
            : null;
        const minWeight = weightValues.length > 0 ? Math.min(...weightValues).toFixed(1) : null;
        const maxWeight = weightValues.length > 0 ? Math.max(...weightValues).toFixed(1) : null;

        // Blood Pressure
        const allBP = hlDays.flatMap(d => (d.bloodPressure || []).filter(bp => !bp.skipped));
        const avgSystolic = allBP.length > 0
            ? Math.round(allBP.reduce((s, bp) => s + bp.systolic, 0) / allBP.length)
            : null;
        const avgDiastolic = allBP.length > 0
            ? Math.round(allBP.reduce((s, bp) => s + bp.diastolic, 0) / allBP.length)
            : null;
        const avgPulse = allBP.length > 0
            ? Math.round(allBP.reduce((s, bp) => s + bp.pulse, 0) / allBP.length)
            : null;

        // Sleep
        const allSleep = hlDays.flatMap(d => d.sleepEntries || []);
        const sleepHours = allSleep.map(s => s.hours).filter(h => h > 0);
        const avgSleep = sleepHours.length > 0
            ? (sleepHours.reduce((a, b) => a + b, 0) / sleepHours.length).toFixed(1)
            : null;
        const sleepInterrupted = allSleep.filter(s => s.interrupted).length;

        // Gym
        const gymSessions = hlDays.flatMap(d => (d.gymSessions || []).filter(g => g.type !== 'Niet gegaan'));
        const gymCount = gymSessions.length;
        const gymTypes = {};
        gymSessions.forEach(g => { gymTypes[g.type] = (gymTypes[g.type] || 0) + 1; });

        // Drinks
        const allDrinks = hlDays.flatMap(d => d.drinks || []);
        const totalCoffee = allDrinks.reduce((s, d) => s + (d.coffee || 0), 0);
        const totalDecaf = allDrinks.reduce((s, d) => s + (d.decaf || 0), 0);
        const alcoholDays = allDrinks.filter(d => d.alcohol).length;
        const totalAlcoholGlasses = allDrinks.filter(d => d.alcohol).reduce((s, d) => s + (d.alcoholGlasses || 0), 0);
        const waterEntries = allDrinks.map(d => d.waterAmount != null ? d.waterAmount : (d.water2L ? 2 : 0)).filter(w => w > 0);
        const avgWater = waterEntries.length > 0
            ? (waterEntries.reduce((a, b) => a + b, 0) / waterEntries.length).toFixed(1)
            : null;

        // --- Habits data ---
        const habits = HabitsDB.getHabits();
        const habitSummary = habits.map(habit => {
            let done = 0, skipped = 0, missed = 0;
            for (const dateStr of dates) {
                const comps = HabitsDB.getCompletionsForHabit(habit.id, dateStr);
                if (comps.length === 0) {
                    missed++;
                } else {
                    const last = comps[comps.length - 1];
                    if (last.status === 'skipped') skipped++;
                    else done++;
                }
            }
            const total = dates.length;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            return {
                name: habit.name,
                icon: habit.icon,
                category: habit.category,
                done, skipped, missed, pct
            };
        });

        const habitOverallPct = habitSummary.length > 0
            ? Math.round(habitSummary.reduce((s, h) => s + h.pct, 0) / habitSummary.length)
            : 0;

        // --- Journal data ---
        let fiveMJData = {};
        let drData = {};
        try { fiveMJData = JSON.parse(localStorage.getItem('5mj_entries')) || {}; } catch {}
        try { drData = JSON.parse(localStorage.getItem('dr_entries')) || {}; } catch {}

        const journalDays5MJ = dates.filter(d => {
            const e = fiveMJData[d];
            return e && (e.grateful || e.great1 || e.great2 || e.great3 || e.affirmations);
        }).length;

        const journalDaysDR = dates.filter(d => {
            const e = drData[d];
            return e && (e.dag || e.energiePlus || e.energieMin || e.hoogtepunt1 || e.hoogtepunt2 || e.hoogtepunt3);
        }).length;

        // --- Workouts ---
        const workoutCount = sessions.length;
        const workoutNames = sessions.map(s => s.templateName);

        // --- Weekly Review checklist status ---
        const checklistState = load();
        const checklistDone = ITEMS.filter(k => checklistState[k]).length;
        const checklistTotal = ITEMS.length;

        // --- Build summary object ---
        const summary = {
            weekKey,
            weekStart: startStr,
            weekEnd: endStr,
            generatedAt: new Date().toISOString(),

            // Health
            health: {
                avgWeight, minWeight, maxWeight,
                weightMeasurements: weightValues.length,
                avgSystolic, avgDiastolic, avgPulse,
                bpMeasurements: allBP.length,
                avgSleep,
                sleepNights: sleepHours.length,
                sleepInterrupted,
                gymCount,
                gymTypes,
            },

            // Drinks
            drinks: {
                totalCoffee, totalDecaf,
                alcoholDays, totalAlcoholGlasses,
                avgWater,
            },

            // Habits
            habits: {
                overallPct: habitOverallPct,
                details: habitSummary,
            },

            // Journal
            journal: {
                fiveMJDays: journalDays5MJ,
                dailyReviewDays: journalDaysDR,
            },

            // Workouts
            workouts: {
                count: workoutCount,
                names: workoutNames,
            },

            // Weekly Review checklist
            checklist: {
                done: checklistDone,
                total: checklistTotal,
            }
        };

        // Save
        const summaries = _loadSummaries();
        summaries[weekKey] = summary;
        _saveSummaries(summaries);

        return summary;
    }

    // ========================================================
    // AUTO-GENERATE: run on Monday for previous week
    // ========================================================

    function autoGenerateIfNeeded() {
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon

        // Only trigger on Monday
        if (dayOfWeek !== 1) return;

        // Calculate previous week's Monday
        const prevMonday = new Date(today);
        prevMonday.setDate(prevMonday.getDate() - 7);
        prevMonday.setHours(0, 0, 0, 0);

        const weekKey = _getISOWeekKey(prevMonday);

        // Only generate if not already exists
        if (!getSummary(weekKey)) {
            generateWeekSummary(prevMonday);
            console.log('Week samenvatting gegenereerd voor', weekKey);
        }
    }

    // ========================================================
    // RENDERING — Checklist (unchanged)
    // ========================================================

    function render() {
        const state = load();

        // Update checkboxes
        ITEMS.forEach(key => {
            const label = document.querySelector(`.wr-item[data-key="${key}"] input`);
            if (label) label.checked = !!state[key];
        });

        // Update progress
        const done = ITEMS.filter(k => state[k]).length;
        const total = ITEMS.length;
        const pct = Math.round((done / total) * 100);

        const fill = document.getElementById('wr-progress-fill');
        const text = document.getElementById('wr-progress-text');
        if (fill) fill.style.width = pct + '%';
        if (text) text.textContent = done + ' / ' + total;

        // Update last-completed subtitle
        renderLastCompleted();

        // Also render week summary
        renderSummary();
    }

    function renderLastCompleted() {
        const el = document.getElementById('review-last-completed');
        if (!el) return;

        const iso = getLastCompleted();
        if (!iso) {
            el.textContent = 'Nog niet voltooid';
            return;
        }

        const d = new Date(iso);
        const dag = d.toLocaleDateString('nl-NL', {
            weekday: 'long', day: 'numeric', month: 'long'
        });
        const tijd = d.toLocaleTimeString('nl-NL', {
            hour: '2-digit', minute: '2-digit'
        });
        el.textContent = 'Laatst voltooid: ' + dag + ', ' + tijd;
    }

    // ========================================================
    // RENDERING — Week Summary
    // ========================================================

    function _getCurrentSummaryWeekKey() {
        const keys = getSummaryKeys(); // sorted descending
        if (keys.length === 0) return null;

        // offset 0 = most recent, -1 = second most recent, etc.
        const idx = -summaryWeekOffset; // offset is negative for older
        if (idx < 0 || idx >= keys.length) return null;
        return keys[idx];
    }

    function renderSummary() {
        const container = document.getElementById('wr-summary-container');
        if (!container) return;

        const keys = getSummaryKeys();

        if (keys.length === 0) {
            container.innerHTML = `
                <div style="padding: 24px 16px; text-align: center; color: var(--muted);">
                    Nog geen weekoverzichten beschikbaar.<br>
                    <small>Wordt automatisch gegenereerd op maandag.</small>
                </div>`;
            // Hide navigation
            const nav = document.getElementById('wr-summary-nav');
            if (nav) nav.style.display = 'none';
            return;
        }

        const weekKey = _getCurrentSummaryWeekKey();
        if (!weekKey) {
            container.innerHTML = '<div style="padding:16px;text-align:center;color:var(--muted);">Geen samenvatting voor deze week.</div>';
            return;
        }

        const summary = getSummary(weekKey);
        if (!summary) {
            container.innerHTML = '<div style="padding:16px;text-align:center;color:var(--muted);">Geen data.</div>';
            return;
        }

        // Show navigation
        const nav = document.getElementById('wr-summary-nav');
        if (nav) nav.style.display = '';

        // Update nav date
        const navDate = document.getElementById('wr-summary-nav-date');
        if (navDate) {
            navDate.textContent = _formatDate(summary.weekStart) + ' – ' + _formatDate(summary.weekEnd);
        }

        // Update nav button states
        const prevBtn = document.getElementById('wr-summary-prev');
        const nextBtn = document.getElementById('wr-summary-next');
        const idx = -summaryWeekOffset;
        if (prevBtn) prevBtn.disabled = (idx >= keys.length - 1);
        if (nextBtn) nextBtn.disabled = (summaryWeekOffset >= 0);

        // Build summary HTML
        const h = summary.health;
        const d = summary.drinks;
        const hab = summary.habits;
        const j = summary.journal;
        const w = summary.workouts;

        let html = '';

        // --- Health section ---
        html += '<div class="wr-summary-section">';
        html += '<div class="wr-summary-section-title">Gezondheid</div>';
        html += '<div class="wr-summary-grid">';

        if (h.avgWeight) {
            html += _summaryCard('Gewicht', `${h.avgWeight} kg`, `${h.minWeight} – ${h.maxWeight} kg`, '');
        }
        if (h.avgSystolic) {
            html += _summaryCard('Bloeddruk', `${h.avgSystolic}/${h.avgDiastolic}`, `Pols: ${h.avgPulse}`, `${h.bpMeasurements} metingen`);
        }
        if (h.avgSleep) {
            html += _summaryCard('Slaap', `${h.avgSleep} uur/nacht`, `${h.sleepNights} nachten`, h.sleepInterrupted > 0 ? `${h.sleepInterrupted}x onderbroken` : 'Niet onderbroken');
        }
        if (h.gymCount > 0) {
            const gymTypesStr = Object.entries(h.gymTypes).map(([t, c]) => `${t}: ${c}x`).join(', ');
            html += _summaryCard('Gym', `${h.gymCount}x`, gymTypesStr, '');
        }

        html += '</div></div>';

        // --- Drinks section ---
        html += '<div class="wr-summary-section">';
        html += '<div class="wr-summary-section-title">Dranken</div>';
        html += '<div class="wr-summary-grid">';

        html += _summaryCard('Koffie', `${d.totalCoffee} koppen`, d.totalDecaf > 0 ? `${d.totalDecaf} decaf` : '', '');
        if (d.alcoholDays > 0) {
            html += _summaryCard('Alcohol', `${d.alcoholDays} dagen`, `${d.totalAlcoholGlasses} glazen`, '');
        } else {
            html += _summaryCard('Alcohol', 'Geen', '', '');
        }
        if (d.avgWater) {
            html += _summaryCard('Water', `${d.avgWater} L/dag`, '', '');
        }

        html += '</div></div>';

        // --- Habits section ---
        html += '<div class="wr-summary-section">';
        html += '<div class="wr-summary-section-title">Habits</div>';

        // Overall progress bar
        html += `<div class="wr-summary-overall">
            <div class="wr-summary-overall-label">Overall score: <strong>${hab.overallPct}%</strong></div>
            <div class="wr-progress-bar" style="margin-top:4px;">
                <div class="wr-progress-fill" style="width:${hab.overallPct}%;background:${hab.overallPct >= 80 ? 'var(--green, #34c759)' : hab.overallPct >= 50 ? 'var(--orange, #ff9500)' : 'var(--red, #ff3b30)'}"></div>
            </div>
        </div>`;

        // Habit details table
        if (hab.details && hab.details.length > 0) {
            html += '<div class="wr-summary-habits-table">';
            for (const habit of hab.details) {
                const barColor = habit.pct >= 80 ? 'var(--green, #34c759)' : habit.pct >= 50 ? 'var(--orange, #ff9500)' : 'var(--red, #ff3b30)';
                html += `<div class="wr-habit-row">
                    <span class="wr-habit-name">${habit.icon} ${habit.name}</span>
                    <span class="wr-habit-score">${habit.done}/7</span>
                    <div class="wr-habit-bar"><div class="wr-habit-bar-fill" style="width:${habit.pct}%;background:${barColor}"></div></div>
                </div>`;
            }
            html += '</div>';
        }

        html += '</div>';

        // --- Journal & Workouts section ---
        html += '<div class="wr-summary-section">';
        html += '<div class="wr-summary-section-title">Journal & Workouts</div>';
        html += '<div class="wr-summary-grid">';

        html += _summaryCard('5-Minute Journal', `${j.fiveMJDays}/7 dagen`, '', '');
        html += _summaryCard('Daily Review', `${j.dailyReviewDays}/7 dagen`, '', '');
        html += _summaryCard('Workouts', `${w.count}x`, w.names.length > 0 ? w.names.join(', ') : '', '');

        html += '</div></div>';

        container.innerHTML = html;
    }

    function _summaryCard(title, value, sub1, sub2) {
        return `<div class="wr-summary-card">
            <div class="wr-summary-card-title">${title}</div>
            <div class="wr-summary-card-value">${value}</div>
            ${sub1 ? `<div class="wr-summary-card-sub">${sub1}</div>` : ''}
            ${sub2 ? `<div class="wr-summary-card-sub">${sub2}</div>` : ''}
        </div>`;
    }

    // ========================================================
    // SUMMARY NAVIGATION
    // ========================================================

    function prevSummaryWeek() {
        const keys = getSummaryKeys();
        const idx = -summaryWeekOffset;
        if (idx < keys.length - 1) {
            summaryWeekOffset--;
            renderSummary();
        }
    }

    function nextSummaryWeek() {
        if (summaryWeekOffset < 0) {
            summaryWeekOffset++;
            renderSummary();
        }
    }

    // ========================================================
    // MANUAL GENERATE (for current or specific week)
    // ========================================================

    function generateCurrentWeek() {
        const monday = _getMonday(new Date());
        generateWeekSummary(monday);
        summaryWeekOffset = 0;
        render();
    }

    function generatePreviousWeek() {
        const monday = _getMonday(new Date());
        monday.setDate(monday.getDate() - 7);
        generateWeekSummary(monday);
        summaryWeekOffset = 0;
        render();
    }

    // ========================================================
    // CHECKLIST ACTIONS (unchanged)
    // ========================================================

    function toggle(key) {
        const state = load();
        state[key] = !state[key];
        save(state);

        // Check if all done
        const allDone = ITEMS.every(k => state[k]);
        if (allDone) {
            saveLastCompleted();
        }

        render();
    }

    function refresh() {
        // Save completion timestamp before resetting
        const state = load();
        const anyChecked = ITEMS.some(k => state[k]);
        if (anyChecked) {
            saveLastCompleted();
        }

        // Clear all checkboxes
        save({});
        render();
    }

    // ========================================================
    // PUBLIC API
    // ========================================================

    return {
        toggle,
        refresh,
        render,
        autoGenerateIfNeeded,
        generateWeekSummary,
        generateCurrentWeek,
        generatePreviousWeek,
        prevSummaryWeek,
        nextSummaryWeek,
        getSummary,
        getSummaryKeys,
    };
})();
