// ============================================================
// export.js — CSV and PDF export for RHLOS
// ============================================================

// Shared date formatting utility (used by ExportService and App)
function formatDateNL(dateStr, short = false) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: short ? 'short' : 'long', year: 'numeric' });
}

const ExportService = (() => {

    // --- Helpers: read Habits & Journal data from localStorage ---
    function _getHabitsData() {
        try {
            return JSON.parse(localStorage.getItem('ht_habits')) || [];
        } catch { return []; }
    }

    function _getCompletionsData() {
        try {
            return JSON.parse(localStorage.getItem('ht_completions')) || {};
        } catch { return {}; }
    }

    function _get5MJData() {
        try {
            return JSON.parse(localStorage.getItem('5mj_entries')) || {};
        } catch { return {}; }
    }

    function _getDRData() {
        try {
            return JSON.parse(localStorage.getItem('dr_entries')) || {};
        } catch { return {}; }
    }

    function _getWeekSummaries() {
        try {
            return JSON.parse(localStorage.getItem('wr_summaries')) || {};
        } catch { return {}; }
    }

    function _csvSafe(str) {
        return (str || '').replace(/,/g, ';').replace(/\n/g, ' ');
    }

    // --- Generate date range array ---
    function _dateRange(startDate, endDate) {
        const dates = [];
        const current = new Date(startDate + 'T00:00:00');
        const end = new Date(endDate + 'T00:00:00');
        while (current <= end) {
            const y = current.getFullYear();
            const m = String(current.getMonth() + 1).padStart(2, '0');
            const d = String(current.getDate()).padStart(2, '0');
            dates.push(`${y}-${m}-${d}`);
            current.setDate(current.getDate() + 1);
        }
        return dates;
    }

    // --- CSV: Daily overview ---
    function generateDailyCSV(days, sessions) {
        const lines = ['Datum,Gewicht (kg),Systolisch,Diastolisch,Pols,Moment,Slaap (uur),Onderbroken,Slaap locatie,Slaap notitie,Gym type,Gym duur (min),Gym km,Gym notitie,Ontbijt,Tussendoor 1,Lunch,Tussendoor 2,Diner,Tussendoor 3,Koffie,Decaf,Alcohol,Alcohol glazen,Alcohol notitie,Water >2L,Workout,Notities'];

        for (const day of days) {
            const daySessions = sessions.filter(s => s.date === day.date);
            const workoutStr = daySessions.map(s => s.templateName).join('; ');
            const notes = (day.notes || '').replace(/,/g, ';');

            const nutritionArr = day.nutrition || [];

            // Determine the max number of rows needed for this day
            const maxRows = Math.max(
                1,
                day.weights.length,
                day.bloodPressure.length,
                day.sleepEntries.length,
                day.gymSessions.length,
                day.drinks.length,
                nutritionArr.length
            );

            for (let i = 0; i < maxRows; i++) {
                const weight = day.weights[i] ? day.weights[i].kg.toFixed(1) : '';
                const bpEntry = day.bloodPressure[i];
                const sys = bpEntry ? (bpEntry.skipped ? 'Niet gemeten' : bpEntry.systolic) : '';
                const dia = bpEntry ? (bpEntry.skipped ? '' : bpEntry.diastolic) : '';
                const pulse = bpEntry ? (bpEntry.skipped ? '' : bpEntry.pulse) : '';
                const moment = bpEntry ? bpEntry.moment : '';
                const sleepHours = day.sleepEntries[i] ? day.sleepEntries[i].hours : '';
                const sleepInterrupted = day.sleepEntries[i] ? (day.sleepEntries[i].interrupted ? 'Ja' : 'Nee') : '';
                const sleepLocation = day.sleepEntries[i] ? (day.sleepEntries[i].location || '').replace(/,/g, ';') : '';
                const sleepNote = day.sleepEntries[i] ? (day.sleepEntries[i].note || '').replace(/,/g, ';') : '';
                const gymType = day.gymSessions[i] ? day.gymSessions[i].type : '';
                const gymDuration = day.gymSessions[i] ? day.gymSessions[i].durationMinutes : '';
                const gymKm = day.gymSessions[i] && day.gymSessions[i].km ? day.gymSessions[i].km : '';
                const gymNote = day.gymSessions[i] ? (day.gymSessions[i].note || '').replace(/,/g, ';') : '';

                // Nutrition
                const nutOntbijt = nutritionArr[i] ? (nutritionArr[i].ontbijt || '').replace(/,/g, ';') : '';
                const nutTussen1 = nutritionArr[i] ? (nutritionArr[i].tussen1 || '').replace(/,/g, ';') : '';
                const nutLunch = nutritionArr[i] ? (nutritionArr[i].lunch || '').replace(/,/g, ';') : '';
                const nutTussen2 = nutritionArr[i] ? (nutritionArr[i].tussen2 || '').replace(/,/g, ';') : '';
                const nutDiner = nutritionArr[i] ? (nutritionArr[i].diner || '').replace(/,/g, ';') : '';
                const nutTussen3 = nutritionArr[i] ? (nutritionArr[i].tussen3 || '').replace(/,/g, ';') : '';

                // Drinks
                const drinkCoffee = day.drinks[i] ? day.drinks[i].coffee : '';
                const drinkDecaf = day.drinks[i] ? day.drinks[i].decaf : '';
                const drinkAlcohol = day.drinks[i] ? (day.drinks[i].alcohol ? 'Ja' : 'Nee') : '';
                const drinkAlcoholGlasses = day.drinks[i] && day.drinks[i].alcohol ? (day.drinks[i].alcoholGlasses || 0) : '';
                const drinkAlcoholNote = day.drinks[i] && day.drinks[i].alcohol ? (day.drinks[i].alcoholNote || '').replace(/,/g, ';') : '';
                const drinkWaterRaw = day.drinks[i] ? (day.drinks[i].waterAmount != null ? day.drinks[i].waterAmount : (day.drinks[i].water2L ? 2 : 0)) : '';
                const drinkWater = drinkWaterRaw !== '' ? drinkWaterRaw + 'L' : '';

                // Only show date, workout and notes on the first row
                const dateCol = i === 0 ? day.date : '';
                const wo = i === 0 ? workoutStr : '';
                const n = i === 0 ? notes : '';

                lines.push(`${dateCol},${weight},${sys},${dia},${pulse},${moment},${sleepHours},${sleepInterrupted},${sleepLocation},${sleepNote},${gymType},${gymDuration},${gymKm},${gymNote},${nutOntbijt},${nutTussen1},${nutLunch},${nutTussen2},${nutDiner},${nutTussen3},${drinkCoffee},${drinkDecaf},${drinkAlcohol},${drinkAlcoholGlasses},${drinkAlcoholNote},${drinkWater},${wo},${n}`);
            }
        }

        return lines.join('\n');
    }

    // --- CSV: Workout detail ---
    function generateWorkoutCSV(sessions) {
        const lines = ['Datum,Template,Oefening,Set,Reps,Gewicht (kg)'];

        for (const session of sessions) {
            for (const ex of session.exercises) {
                const exWeight = ex.weightKg != null ? ex.weightKg : null;
                for (const set of ex.sets) {
                    const reps = set.reps != null ? set.reps : '';
                    const w = exWeight != null ? exWeight : (set.weightKg != null ? set.weightKg : null);
                    const weight = w != null ? Number(w).toFixed(1) : '';
                    lines.push(`${session.date},${session.templateName},${ex.name},${set.setNumber},${reps},${weight}`);
                }
            }
        }

        return lines.join('\n');
    }

    // --- CSV: Habits ---
    function generateHabitsCSV(startDate, endDate) {
        const habits = _getHabitsData().filter(h => !h.archived);
        const completions = _getCompletionsData();
        const dates = _dateRange(startDate, endDate);

        const lines = ['Datum,Habit,Categorie,Status'];

        for (const dateStr of dates) {
            const dayCompletions = completions[dateStr] || [];
            for (const habit of habits) {
                const habitCompletions = dayCompletions.filter(c => c.habitId === habit.id);
                let status = '';
                if (habitCompletions.length > 0) {
                    const last = habitCompletions[habitCompletions.length - 1];
                    status = last.status === 'skipped' ? 'Overgeslagen' : 'Gedaan';
                }
                if (status) {
                    lines.push(`${dateStr},${_csvSafe(habit.name)},${_csvSafe(habit.category)},${status}`);
                }
            }
        }

        return lines.join('\n');
    }

    // --- CSV: Journal (5MJ + Daily Review) ---
    function generateJournalCSV(startDate, endDate) {
        const fiveMJ = _get5MJData();
        const dailyReview = _getDRData();
        const dates = _dateRange(startDate, endDate);

        // 5MJ section
        const mjLines = ['Datum,Dankbaar,Geweldig 1,Geweldig 2,Geweldig 3,Affirmaties'];
        for (const dateStr of dates) {
            const entry = fiveMJ[dateStr];
            if (entry && (entry.grateful || entry.great1 || entry.great2 || entry.great3 || entry.affirmations)) {
                mjLines.push(`${dateStr},${_csvSafe(entry.grateful)},${_csvSafe(entry.great1)},${_csvSafe(entry.great2)},${_csvSafe(entry.great3)},${_csvSafe(entry.affirmations)}`);
            }
        }

        // Daily Review section
        const drLines = ['Datum,Dag,Energie+,Energie-,Hoogtepunt 1,Hoogtepunt 2,Hoogtepunt 3'];
        for (const dateStr of dates) {
            const entry = dailyReview[dateStr];
            if (entry && (entry.dag || entry.energiePlus || entry.energieMin || entry.hoogtepunt1 || entry.hoogtepunt2 || entry.hoogtepunt3)) {
                drLines.push(`${dateStr},${_csvSafe(entry.dag)},${_csvSafe(entry.energiePlus)},${_csvSafe(entry.energieMin)},${_csvSafe(entry.hoogtepunt1)},${_csvSafe(entry.hoogtepunt2)},${_csvSafe(entry.hoogtepunt3)}`);
            }
        }

        let csv = '';
        if (mjLines.length > 1) {
            csv += mjLines.join('\n');
        }
        if (drLines.length > 1) {
            if (csv) csv += '\n\n';
            csv += drLines.join('\n');
        }
        return csv;
    }

    // --- CSV: Week Summaries ---
    function generateWeekSummaryCSV(startDate, endDate) {
        const summaries = _getWeekSummaries();
        const keys = Object.keys(summaries).sort();

        // Filter summaries that overlap with the export period
        const relevantKeys = keys.filter(k => {
            const s = summaries[k];
            return s.weekStart <= endDate && s.weekEnd >= startDate;
        });

        if (relevantKeys.length === 0) return '';

        const lines = ['Week,Periode,Gem. gewicht,Gem. bloeddruk,Gem. slaap,Gym,Koffie,Alcohol dagen,Alcohol glazen,Gem. water,Habits score,5MJ dagen,DR dagen,Workouts'];

        for (const key of relevantKeys) {
            const s = summaries[key];
            const h = s.health || {};
            const d = s.drinks || {};
            const hab = s.habits || {};
            const j = s.journal || {};
            const w = s.workouts || {};

            const period = `${s.weekStart} - ${s.weekEnd}`;
            const bp = h.avgSystolic ? `${h.avgSystolic}/${h.avgDiastolic}` : '';

            lines.push(`${key},${period},${h.avgWeight || ''},${bp},${h.avgSleep || ''},${h.gymCount || 0},${d.totalCoffee || 0},${d.alcoholDays || 0},${d.totalAlcoholGlasses || 0},${d.avgWater || ''},${hab.overallPct || 0}%,${j.fiveMJDays || 0}/7,${j.dailyReviewDays || 0}/7,${w.count || 0}`);
        }

        return lines.join('\n');
    }

    // --- Full CSV export ---
    function exportCSV(startDate, endDate, includeWorkouts, includeHabits, includeJournal, includeWeekSummary) {
        const days = DB.getDaysInRange(startDate, endDate);
        const sessions = DB.getSessionsInRange(startDate, endDate);

        let csv = generateDailyCSV(days, sessions);

        if (includeWorkouts && sessions.length > 0) {
            csv += '\n\n--- WORKOUTS ---\n\n';
            csv += generateWorkoutCSV(sessions);
        }

        if (includeHabits) {
            const habitsCSV = generateHabitsCSV(startDate, endDate);
            if (habitsCSV) {
                csv += '\n\n--- HABITS ---\n\n';
                csv += habitsCSV;
            }
        }

        if (includeJournal) {
            const journalCSV = generateJournalCSV(startDate, endDate);
            if (journalCSV) {
                csv += '\n\n--- JOURNAL ---\n\n';
                csv += journalCSV;
            }
        }

        if (includeWeekSummary) {
            const weekCSV = generateWeekSummaryCSV(startDate, endDate);
            if (weekCSV) {
                csv += '\n\n--- WEEKOVERZICHTEN ---\n\n';
                csv += weekCSV;
            }
        }

        downloadFile(csv, 'RHLOS_Export.csv', 'text/csv');
    }

    // --- PDF export (simple HTML-based) ---
    function exportPDF(startDate, endDate, includeWorkouts, includeHabits, includeJournal, includeWeekSummary) {
        const days = DB.getDaysInRange(startDate, endDate);
        const sessions = DB.getSessionsInRange(startDate, endDate);

        let html = `
        <html><head>
        <meta charset="utf-8">
        <title>RHLOS Export</title>
        <style>
            body { font-family: -apple-system, Arial, sans-serif; padding: 20px; color: #1a1a1a; }
            h1 { font-size: 22px; margin-bottom: 4px; }
            h2 { font-size: 16px; margin-top: 24px; color: #555; }
            .period { font-size: 13px; color: #888; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
            th { background: #f0f0f0; text-align: left; padding: 6px 8px; border-bottom: 2px solid #ddd; }
            td { padding: 5px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
            tr:nth-child(even) { background: #fafafa; }
            td.empty { color: #ccc; }
            .no-print { margin-top: 24px; }
            @media print { .no-print { display: none; } }
        </style>
        </head><body>
        <h1>RHLOS Export</h1>
        <div class="period">Periode: ${formatDateNL(startDate, true)} – ${formatDateNL(endDate, true)}</div>

        <h2>Dagelijks Overzicht</h2>
        <table>
            <tr><th>Datum</th><th>Gewicht</th><th>Bloeddruk</th><th>Pols</th><th>Slaap</th><th>Locatie</th><th>Onderbroken</th><th>Slaap notitie</th><th>Gym</th><th>Voeding</th><th>Drankjes</th><th>Workout</th></tr>`;

        for (const day of days) {
            // Collect all values as arrays
            const weightStrs = day.weights.map(w => w.kg.toFixed(1) + ' kg');
            const bpStrs = day.bloodPressure.map(b => b.skipped ? `Niet gemeten (${b.moment})` : `${b.systolic}/${b.diastolic} (${b.moment})`);
            const pulseStrs = day.bloodPressure.filter(b => !b.skipped).map(b => b.pulse);
            const sleepStrs = day.sleepEntries.map(s => `${s.hours}u`);
            const sleepLocationStrs = day.sleepEntries.map(s => s.location || '–');
            const sleepInterruptedStrs = day.sleepEntries.map(s => s.interrupted ? 'Ja' : 'Nee');
            const sleepNoteStrs = day.sleepEntries.map(s => s.note || '–');
            const gymStrs = day.gymSessions.map(g => {
                let str = `${g.type} (${g.durationMinutes}m`;
                if (g.km) str += `, ${g.km}km`;
                str += ')';
                return str;
            });
            const drinksStrs = day.drinks.map(d => {
                const parts = [];
                if (d.coffee > 0 || d.decaf > 0) parts.push(`☕${d.coffee}+${d.decaf}d`);
                if (d.alcohol) parts.push(`🍷${d.alcoholGlasses || 0}`);
                const pdfWater = d.waterAmount != null ? d.waterAmount : (d.water2L ? 2 : 0);
                parts.push('💧' + pdfWater + 'L');
                return parts.join(' ');
            });

            // Nutrition
            const nutritionArr = day.nutrition || [];
            const nutritionStrs = nutritionArr.map(n => {
                const meals = [n.ontbijt, n.tussen1, n.lunch, n.tussen2, n.diner, n.tussen3];
                const filled = meals.filter(m => m && m.trim()).length;
                return `${filled}/6`;
            });

            const weight = weightStrs.length > 0 ? weightStrs.join(', ') : '–';
            const bp = bpStrs.length > 0 ? bpStrs.join(', ') : '–';
            const pulse = pulseStrs.length > 0 ? pulseStrs.join(', ') : '–';
            const sleep = sleepStrs.length > 0 ? sleepStrs.join(', ') : '–';
            const sleepLocation = sleepLocationStrs.length > 0 ? sleepLocationStrs.join(', ') : '–';
            const sleepInterrupted = sleepInterruptedStrs.length > 0 ? sleepInterruptedStrs.join(', ') : '–';
            const sleepNote = sleepNoteStrs.length > 0 ? sleepNoteStrs.join(', ') : '–';
            const gym = gymStrs.length > 0 ? gymStrs.join(', ') : '–';
            const nutritionSummary = nutritionStrs.length > 0 ? nutritionStrs.join(', ') : '–';
            const drinks = drinksStrs.length > 0 ? drinksStrs.join(', ') : '–';
            const daySessions = sessions.filter(s => s.date === day.date);
            const workout = daySessions.length > 0 ? daySessions.map(s => s.templateName).join(', ') : '–';

            html += `<tr><td>${formatDateNL(day.date, true)}</td><td>${weight}</td><td>${bp}</td><td>${pulse}</td><td>${sleep}</td><td>${sleepLocation}</td><td>${sleepInterrupted}</td><td>${sleepNote}</td><td>${gym}</td><td>${nutritionSummary}</td><td>${drinks}</td><td>${workout}</td></tr>`;
        }

        html += '</table>';

        if (includeWorkouts && sessions.length > 0) {
            html += `<h2>Workouts</h2>
            <table>
                <tr><th>Datum</th><th>Template</th><th>Oefening</th><th>Sets</th></tr>`;

            for (const session of sessions) {
                for (const ex of session.exercises) {
                    const exWeight = ex.weightKg != null ? ex.weightKg : null;
                    const weightStr = exWeight != null ? Number(exWeight).toFixed(1) + 'kg' : null;
                    const setsStr = ex.sets.map(s => {
                        const r = s.reps != null ? s.reps : '–';
                        const w = weightStr || (s.weightKg != null ? s.weightKg.toFixed(1) + 'kg' : '–');
                        return `${r}×${w}`;
                    }).join(', ');

                    html += `<tr><td>${formatDateNL(session.date, true)}</td><td>${session.templateName}</td><td>${ex.name}</td><td>${setsStr}</td></tr>`;
                }
            }

            html += '</table>';
        }

        // --- Habits PDF section ---
        if (includeHabits) {
            const habits = _getHabitsData().filter(h => !h.archived);
            const completions = _getCompletionsData();
            const dates = _dateRange(startDate, endDate);

            // Build a summary: per habit, count done/skipped/missed
            const habitRows = [];
            for (const habit of habits) {
                let done = 0, skipped = 0, missed = 0;
                for (const dateStr of dates) {
                    const dayComps = (completions[dateStr] || []).filter(c => c.habitId === habit.id);
                    if (dayComps.length === 0) {
                        missed++;
                    } else {
                        const last = dayComps[dayComps.length - 1];
                        if (last.status === 'skipped') skipped++;
                        else done++;
                    }
                }
                const total = dates.length;
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                habitRows.push({ name: habit.name, icon: habit.icon, category: habit.category, done, skipped, missed, pct });
            }

            if (habitRows.length > 0) {
                html += `<h2>Habits</h2>
                <table>
                    <tr><th>Habit</th><th>Categorie</th><th>Gedaan</th><th>Overgeslagen</th><th>Gemist</th><th>Score</th></tr>`;

                for (const row of habitRows) {
                    html += `<tr><td>${row.icon} ${row.name}</td><td>${row.category || '–'}</td><td>${row.done}</td><td>${row.skipped}</td><td>${row.missed}</td><td>${row.pct}%</td></tr>`;
                }

                html += '</table>';
            }
        }

        // --- Journal PDF section ---
        if (includeJournal) {
            const fiveMJ = _get5MJData();
            const dailyReview = _getDRData();
            const dates = _dateRange(startDate, endDate);

            // 5MJ entries
            const mjEntries = dates.filter(d => {
                const e = fiveMJ[d];
                return e && (e.grateful || e.great1 || e.great2 || e.great3 || e.affirmations);
            });

            if (mjEntries.length > 0) {
                html += `<h2>5-Minute Journal</h2>
                <table>
                    <tr><th>Datum</th><th>Dankbaar</th><th>Geweldig 1</th><th>Geweldig 2</th><th>Geweldig 3</th><th>Affirmaties</th></tr>`;

                for (const dateStr of mjEntries) {
                    const e = fiveMJ[dateStr];
                    html += `<tr><td>${formatDateNL(dateStr, true)}</td><td>${e.grateful || '–'}</td><td>${e.great1 || '–'}</td><td>${e.great2 || '–'}</td><td>${e.great3 || '–'}</td><td>${e.affirmations || '–'}</td></tr>`;
                }

                html += '</table>';
            }

            // Daily Review entries
            const drEntries = dates.filter(d => {
                const e = dailyReview[d];
                return e && (e.dag || e.energiePlus || e.energieMin || e.hoogtepunt1 || e.hoogtepunt2 || e.hoogtepunt3);
            });

            if (drEntries.length > 0) {
                html += `<h2>Daily Review</h2>
                <table>
                    <tr><th>Datum</th><th>Dag</th><th>Energie+</th><th>Energie-</th><th>Hoogtepunt 1</th><th>Hoogtepunt 2</th><th>Hoogtepunt 3</th></tr>`;

                for (const dateStr of drEntries) {
                    const e = dailyReview[dateStr];
                    html += `<tr><td>${formatDateNL(dateStr, true)}</td><td>${e.dag || '–'}</td><td>${e.energiePlus || '–'}</td><td>${e.energieMin || '–'}</td><td>${e.hoogtepunt1 || '–'}</td><td>${e.hoogtepunt2 || '–'}</td><td>${e.hoogtepunt3 || '–'}</td></tr>`;
                }

                html += '</table>';
            }
        }

        // --- Week Summary PDF section ---
        if (includeWeekSummary) {
            const summaries = _getWeekSummaries();
            const keys = Object.keys(summaries).sort();
            const relevantKeys = keys.filter(k => {
                const s = summaries[k];
                return s.weekStart <= endDate && s.weekEnd >= startDate;
            });

            if (relevantKeys.length > 0) {
                html += `<h2>Weekoverzichten</h2>
                <table>
                    <tr><th>Week</th><th>Periode</th><th>Gewicht</th><th>Bloeddruk</th><th>Slaap</th><th>Gym</th><th>Koffie</th><th>Alcohol</th><th>Water</th><th>Habits</th><th>5MJ</th><th>DR</th><th>Workouts</th></tr>`;

                for (const key of relevantKeys) {
                    const s = summaries[key];
                    const h = s.health || {};
                    const d = s.drinks || {};
                    const hab = s.habits || {};
                    const j = s.journal || {};
                    const w = s.workouts || {};

                    const period = formatDateNL(s.weekStart, true) + ' – ' + formatDateNL(s.weekEnd, true);
                    const weight = h.avgWeight ? h.avgWeight + ' kg' : '–';
                    const bp = h.avgSystolic ? h.avgSystolic + '/' + h.avgDiastolic : '–';
                    const sleep = h.avgSleep ? h.avgSleep + 'u' : '–';
                    const gym = h.gymCount > 0 ? h.gymCount + 'x' : '–';
                    const coffee = d.totalCoffee > 0 ? d.totalCoffee + ' koppen' : '–';
                    const alcohol = d.alcoholDays > 0 ? d.alcoholDays + 'd / ' + d.totalAlcoholGlasses + 'gl' : 'Geen';
                    const water = d.avgWater ? d.avgWater + ' L/dag' : '–';
                    const habits = (hab.overallPct || 0) + '%';
                    const fivemj = (j.fiveMJDays || 0) + '/7';
                    const dr = (j.dailyReviewDays || 0) + '/7';
                    const workouts = (w.count || 0) + 'x';

                    html += `<tr><td>${key}</td><td>${period}</td><td>${weight}</td><td>${bp}</td><td>${sleep}</td><td>${gym}</td><td>${coffee}</td><td>${alcohol}</td><td>${water}</td><td>${habits}</td><td>${fivemj}</td><td>${dr}</td><td>${workouts}</td></tr>`;
                }

                html += '</table>';
            }
        }

        html += `
        <div class="no-print">
            <button onclick="window.print()">Print / Save as PDF</button>
        </div>
        </body></html>`;

        // Open in new window for print
        const w = window.open('', '_blank');
        w.document.write(html);
        w.document.close();
    }

    // --- Download helper ---
    function downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    return { exportCSV, exportPDF };
})();
