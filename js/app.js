// ============================================================
// app.js — RHLOS single-page app controller
// ============================================================

const App = (() => {

    let currentPage = 'home';
    let currentDayDetail = null;    // date string for day detail view
    let currentSessionId = null;    // session id for workout log view
    let homeDate = new Date();      // date for home view navigation

    // --- Navigation ---
    function showPage(pageId) {
        const panel = document.getElementById('panel-health');
        panel.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('#health-tab-bar button').forEach(b => b.classList.remove('active'));

        const page = document.getElementById('page-' + pageId);
        const tab = document.getElementById('tab-' + pageId);
        if (page) page.classList.add('active');
        if (tab) tab.classList.add('active');

        currentPage = pageId;
        renderPage(pageId);
    }

    function renderPage(pageId) {
        switch (pageId) {
            case 'home': renderHome(); break;
            case 'history': renderHistory(); break;
            case 'export': renderExport(); break;
            case 'settings': renderSettings(); break;
        }
    }

    // ============================================================
    // HOME
    // ============================================================
    function homeDateKey() {
        const y = homeDate.getFullYear();
        const m = String(homeDate.getMonth() + 1).padStart(2, '0');
        const d = String(homeDate.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function isHomeToday() {
        const today = new Date();
        return homeDate.getFullYear() === today.getFullYear() &&
               homeDate.getMonth() === today.getMonth() &&
               homeDate.getDate() === today.getDate();
    }

    function homePrevDay() {
        homeDate.setDate(homeDate.getDate() - 1);
        renderHome();
    }

    function homeNextDay() {
        homeDate.setDate(homeDate.getDate() + 1);
        renderHome();
    }

    function homeGoToToday() {
        homeDate = new Date();
        renderHome();
    }

    function renderHome() {
        const dayData = DB.getDay(homeDateKey()) || { weights: [], bloodPressure: [], sleepEntries: [], gymSessions: [], drinks: [], nutrition: [] };
        const sessions = DB.getSessionsForDate(homeDateKey());

        // Weight: show latest entry
        const weightVal = dayData.weights.length > 0
            ? dayData.weights[dayData.weights.length - 1].kg.toFixed(1) + ' kg'
            : '–';

        // BP: show latest entry
        let bpVal = '–';
        if (dayData.bloodPressure.length > 0) {
            const lastBP = dayData.bloodPressure[dayData.bloodPressure.length - 1];
            bpVal = lastBP.skipped ? 'Niet gemeten' : `${lastBP.systolic}/${lastBP.diastolic}`;
        }

        // Sleep: show latest entry
        let sleepVal = '–';
        if (dayData.sleepEntries.length > 0) {
            const lastSleep = dayData.sleepEntries[dayData.sleepEntries.length - 1];
            sleepVal = `${lastSleep.hours}u` + (lastSleep.interrupted ? ' ⚡' : '');
        }

        // Workouts
        const workoutVal = sessions.length > 0 ? `${sessions.length} sessie(s)` : '–';

        // Gym: show count or latest
        let gymVal = '–';
        if (dayData.gymSessions.length > 0) {
            if (dayData.gymSessions.length === 1) {
                const g = dayData.gymSessions[0];
                if (g.type === 'Niet gegaan') {
                    gymVal = 'Niet gegaan';
                } else {
                    gymVal = `${g.type} · ${g.durationMinutes}m`;
                    if (g.km) gymVal += ` · ${g.km}km`;
                }
            } else {
                gymVal = `${dayData.gymSessions.length} sessies`;
            }
        }

        // Drinks: show summary of latest entry
        let drinksVal = '–';
        if (dayData.drinks.length > 0) {
            const d = dayData.drinks[dayData.drinks.length - 1];
            const parts = [];
            if (d.coffee > 0 || d.decaf > 0) {
                let coffeePart = '';
                if (d.coffee > 0) coffeePart += `${d.coffee}☕`;
                if (d.decaf > 0) coffeePart += (coffeePart ? '+' : '') + `${d.decaf}decaf`;
                parts.push(coffeePart);
            }
            if (d.alcohol) parts.push(`🍷${d.alcoholGlasses || 0}`);
            const waterAmt = d.waterAmount != null ? d.waterAmount : (d.water2L ? 2 : 0);
            parts.push('💧' + waterAmt + 'L');
            drinksVal = parts.join(' ');
        }

        // Nutrition: show count of filled meals
        let nutritionVal = '–';
        if (dayData.nutrition.length > 0) {
            const last = dayData.nutrition[dayData.nutrition.length - 1];
            const meals = [last.ontbijt, last.tussen1, last.lunch, last.tussen2, last.diner, last.tussen3];
            const filledCount = meals.filter(m => m && m.trim()).length;
            nutritionVal = `${filledCount}/6 maaltijden`;
        }

        // Update date display with navigation context
        const dateLabel = isHomeToday() ? formatFullDate(homeDate) : formatFullDate(homeDate);
        document.getElementById('home-date').textContent = dateLabel;
        document.getElementById('card-weight-val').textContent = weightVal;
        document.getElementById('card-bp-val').textContent = bpVal;
        document.getElementById('card-sleep-val').textContent = sleepVal;
        document.getElementById('card-workout-val').textContent = workoutVal;
        document.getElementById('card-gym-val').textContent = gymVal;
        document.getElementById('card-drinks-val').textContent = drinksVal;
        document.getElementById('card-nutrition-val').textContent = nutritionVal;

        // Show counts when multiple entries exist
        const weightCount = dayData.weights.length > 1 ? ` (${dayData.weights.length}×)` : '';
        const bpCount = dayData.bloodPressure.length > 1 ? ` (${dayData.bloodPressure.length}×)` : '';
        const sleepCount = dayData.sleepEntries.length > 1 ? ` (${dayData.sleepEntries.length}×)` : '';

        if (weightCount) document.getElementById('card-weight-val').textContent += weightCount;
        if (bpCount) document.getElementById('card-bp-val').textContent += bpCount;
        if (sleepCount) document.getElementById('card-sleep-val').textContent += sleepCount;

        // Sessions list for selected day
        const list = document.getElementById('home-sessions');
        const sessionsLabel = isHomeToday() ? 'Vandaag getraind' : 'Getraind op deze dag';
        if (sessions.length === 0) {
            list.innerHTML = '';
        } else {
            list.innerHTML = `<div class="section-title">${sessionsLabel}</div><div class="list">` +
                sessions.map(s => `
                    <div class="list-item" onclick="App.openSession('${s.id}')">
                        <span class="item-icon">🏋️</span>
                        <div class="item-content">
                            <div class="item-title">${escapeHtml(s.templateName)}</div>
                            <div class="item-subtitle">${formatTime(s.startedAt)}</div>
                        </div>
                        <span class="item-badge ${s.completedAt ? 'badge-green' : 'badge-orange'}">
                            ${s.completedAt ? 'Afgerond' : 'Bezig'}
                        </span>
                        <span class="item-chevron">›</span>
                    </div>
                `).join('') + '</div>';
        }
    }

    // ============================================================
    // MODALS
    // ============================================================
    function openModal(id) {
        document.getElementById(id).classList.add('open');
    }
    function closeModal(id) {
        document.getElementById(id).classList.remove('open');
    }
    function onOverlayClick(event, id) {
        if (event.target === event.currentTarget) {
            closeModal(id);
        }
    }

    // --- Weight ---
    function openWeightModal() {
        const input = document.getElementById('input-weight');
        input.value = '';
        openModal('modal-weight');
        input.focus();
    }
    function saveWeight() {
        const val = document.getElementById('input-weight').value.replace(',', '.');
        const kg = parseFloat(val);
        if (isNaN(kg) || kg <= 0) return;
        DB.addWeight(homeDateKey(), kg);
        closeModal('modal-weight');
        renderHome();
    }

    // --- Blood Pressure ---
    function openBPModal() {
        document.getElementById('input-bp-sys').value = '';
        document.getElementById('input-bp-dia').value = '';
        document.getElementById('input-bp-pulse').value = '';
        setBPMoment(new Date().getHours() < 12 ? 'AM' : 'PM');
        openModal('modal-bp');
        document.getElementById('input-bp-sys').focus();
    }
    let bpMoment = 'AM';
    function setBPMoment(m) {
        bpMoment = m;
        document.querySelectorAll('#bp-moment-seg button').forEach(b => {
            b.classList.toggle('active', b.dataset.val === m);
        });
    }
    function saveBP() {
        const sys = parseInt(document.getElementById('input-bp-sys').value);
        const dia = parseInt(document.getElementById('input-bp-dia').value);
        const pulse = parseInt(document.getElementById('input-bp-pulse').value);
        if (isNaN(sys) || isNaN(dia) || isNaN(pulse)) return;
        DB.addBloodPressure(homeDateKey(), sys, dia, pulse, bpMoment);
        closeModal('modal-bp');
        renderHome();
    }
    function skipBP() {
        DB.addBloodPressureSkipped(homeDateKey(), bpMoment);
        closeModal('modal-bp');
        renderHome();
    }

    // --- Sleep ---
    let sleepInterrupted = false;
    function openSleepModal() {
        const input = document.getElementById('input-sleep-hours');
        const noteInput = document.getElementById('input-sleep-note');
        input.value = '';
        sleepInterrupted = false;
        noteInput.value = '';
        document.getElementById('input-sleep-location').value = 'Thuis';
        document.getElementById('input-sleep-custom-location').value = '';
        document.getElementById('sleep-custom-location-group').classList.add('hidden');
        setSleepInterrupted(false);
        openModal('modal-sleep');
    }
    function onSleepLocationChange() {
        const val = document.getElementById('input-sleep-location').value;
        const customGroup = document.getElementById('sleep-custom-location-group');
        if (val === 'Anders') {
            customGroup.classList.remove('hidden');
            document.getElementById('input-sleep-custom-location').focus();
        } else {
            customGroup.classList.add('hidden');
            document.getElementById('input-sleep-custom-location').value = '';
        }
    }
    function setSleepInterrupted(val) {
        sleepInterrupted = val;
        document.querySelectorAll('#sleep-interrupted-seg button').forEach(b => {
            b.classList.toggle('active', (b.dataset.val === 'yes') === val);
        });
    }
    function saveSleep() {
        const hoursRaw = document.getElementById('input-sleep-hours').value.replace(',', '.');
        const hours = parseFloat(hoursRaw);
        if (isNaN(hours) || hours <= 0) return;
        const note = document.getElementById('input-sleep-note').value.trim();
        let location = document.getElementById('input-sleep-location').value;
        if (location === 'Anders') {
            location = document.getElementById('input-sleep-custom-location').value.trim();
            if (!location) location = 'Anders';
        }
        DB.addSleep(homeDateKey(), hours, sleepInterrupted, note, location);
        closeModal('modal-sleep');
        renderHome();
    }

    // --- Gym ---
    let gymAttended = null; // null = not chosen, true = yes, false = no
    function openGymModal() {
        gymAttended = null;
        // Reset yes-section fields
        document.getElementById('input-gym-type').value = 'Krachttraining';
        document.getElementById('input-gym-custom-type').value = '';
        document.getElementById('input-gym-km').value = '';
        document.getElementById('input-gym-duration').value = '';
        document.getElementById('input-gym-note').value = '';
        // Reset no-section fields
        document.getElementById('input-gym-reason').value = '';
        // Hide both sections
        document.getElementById('gym-yes-section').classList.add('hidden');
        document.getElementById('gym-no-section').classList.add('hidden');
        // Reset button states
        document.getElementById('gym-btn-yes').classList.remove('btn-selected');
        document.getElementById('gym-btn-no').classList.remove('btn-selected');
        onGymTypeChange();
        openModal('modal-gym');
    }
    function onGymAttendance(attended) {
        gymAttended = attended;
        const yesSection = document.getElementById('gym-yes-section');
        const noSection = document.getElementById('gym-no-section');
        const btnYes = document.getElementById('gym-btn-yes');
        const btnNo = document.getElementById('gym-btn-no');
        if (attended) {
            yesSection.classList.remove('hidden');
            noSection.classList.add('hidden');
            btnYes.classList.add('btn-selected');
            btnNo.classList.remove('btn-selected');
            document.getElementById('input-gym-duration').focus();
        } else {
            noSection.classList.remove('hidden');
            yesSection.classList.add('hidden');
            btnNo.classList.add('btn-selected');
            btnYes.classList.remove('btn-selected');
            document.getElementById('input-gym-reason').focus();
        }
    }
    function onGymTypeChange() {
        const typeVal = document.getElementById('input-gym-type').value;
        const isAnders = typeVal === 'Anders';
        const isWandelen = typeVal === 'Wandelen';
        const customGroup = document.getElementById('gym-custom-type-group');
        const kmGroup = document.getElementById('gym-km-group');
        if (isAnders) {
            customGroup.classList.remove('hidden');
            document.getElementById('input-gym-custom-type').focus();
        } else {
            customGroup.classList.add('hidden');
        }
        if (isWandelen) {
            kmGroup.classList.remove('hidden');
        } else {
            kmGroup.classList.add('hidden');
            document.getElementById('input-gym-km').value = '';
        }
    }
    function autoCheckMovementHabit(status) {
        const todayStr = HabitsDB.todayKey();
        const habits = HabitsDB.getHabits();
        const movementHabit = habits.find(h => h.name === 'Movement');
        if (!movementHabit) return;
        // Remove existing completion for today first so we always set the latest status
        const completions = HabitsDB.getCompletionsForHabit(movementHabit.id, todayStr);
        for (const c of completions) {
            HabitsDB.removeCompletion(todayStr, c.id);
        }
        HabitsDB.addCompletion(todayStr, movementHabit.id, '', status);
    }
    function saveGym() {
        if (gymAttended === null) return;
        if (!gymAttended) {
            // Nee-flow: sla reden op
            const reason = document.getElementById('input-gym-reason').value.trim();
            DB.addGym(homeDateKey(), 'Niet gegaan', 0, reason, null);
            autoCheckMovementHabit('skipped');
            closeModal('modal-gym');
            renderHome();
            return;
        }
        // Ja-flow: bestaande logica
        let type = document.getElementById('input-gym-type').value;
        if (type === 'Anders') {
            type = document.getElementById('input-gym-custom-type').value.trim();
            if (!type) return;
        }
        const duration = parseInt(document.getElementById('input-gym-duration').value);
        if (isNaN(duration) || duration <= 0) return;
        const note = document.getElementById('input-gym-note').value.trim();
        const kmRaw = document.getElementById('input-gym-km').value.replace(',', '.');
        const km = parseFloat(kmRaw);
        DB.addGym(homeDateKey(), type, duration, note, isNaN(km) ? null : km);
        autoCheckMovementHabit('done');
        closeModal('modal-gym');
        renderHome();
    }

    // --- Drinks ---
    let drinksAlcohol = false;
    function openDrinksModal() {
        document.getElementById('input-drinks-coffee').value = '';
        document.getElementById('input-drinks-decaf').value = '';
        document.getElementById('input-drinks-alcohol-glasses').value = '';
        document.getElementById('input-drinks-alcohol-note').value = '';
        document.getElementById('input-drinks-water').value = '';
        drinksAlcohol = false;
        setDrinksAlcohol(false);
        openModal('modal-drinks');
        document.getElementById('input-drinks-coffee').focus();
    }
    function setDrinksAlcohol(val) {
        drinksAlcohol = val;
        document.querySelectorAll('#drinks-alcohol-seg button').forEach(b => {
            b.classList.toggle('active', (b.dataset.val === 'yes') === val);
        });
        const details = document.getElementById('drinks-alcohol-details');
        if (val) {
            details.classList.remove('hidden');
        } else {
            details.classList.add('hidden');
            document.getElementById('input-drinks-alcohol-glasses').value = '';
            document.getElementById('input-drinks-alcohol-note').value = '';
        }
    }
    function saveDrinks() {
        const coffee = parseInt(document.getElementById('input-drinks-coffee').value) || 0;
        const decaf = parseInt(document.getElementById('input-drinks-decaf').value) || 0;
        const alcoholGlasses = parseInt(document.getElementById('input-drinks-alcohol-glasses').value) || 0;
        const alcoholNote = document.getElementById('input-drinks-alcohol-note').value.trim();
        const waterAmount = parseFloat(document.getElementById('input-drinks-water').value) || 0;
        DB.addDrinks(homeDateKey(), coffee, decaf, drinksAlcohol, alcoholGlasses, alcoholNote, waterAmount);
        closeModal('modal-drinks');
        renderHome();
    }

    // --- Nutrition ---
    function openNutritionModal() {
        const existing = DB.getNutrition(homeDateKey());
        document.getElementById('input-nutrition-ontbijt').value = existing ? existing.ontbijt : '';
        document.getElementById('input-nutrition-tussen1').value = existing ? existing.tussen1 : '';
        document.getElementById('input-nutrition-lunch').value = existing ? existing.lunch : '';
        document.getElementById('input-nutrition-tussen2').value = existing ? existing.tussen2 : '';
        document.getElementById('input-nutrition-diner').value = existing ? existing.diner : '';
        document.getElementById('input-nutrition-tussen3').value = existing ? existing.tussen3 : '';
        openModal('modal-nutrition');
    }
    function saveNutrition() {
        const ontbijt = document.getElementById('input-nutrition-ontbijt').value.trim();
        const tussen1 = document.getElementById('input-nutrition-tussen1').value.trim();
        const lunch = document.getElementById('input-nutrition-lunch').value.trim();
        const tussen2 = document.getElementById('input-nutrition-tussen2').value.trim();
        const diner = document.getElementById('input-nutrition-diner').value.trim();
        const tussen3 = document.getElementById('input-nutrition-tussen3').value.trim();
        if (!ontbijt && !tussen1 && !lunch && !tussen2 && !diner && !tussen3) return;
        DB.upsertNutrition(homeDateKey(), ontbijt, tussen1, lunch, tussen2, diner, tussen3);
        closeModal('modal-nutrition');
        renderHome();
    }

    // --- Workout Picker ---
    function openWorkoutPicker() {
        const templates = DB.getTemplates();
        const list = document.getElementById('template-list');
        list.innerHTML = templates.map(t => `
            <div class="list-item" onclick="App.startWorkout('${t.id}')">
                <span class="item-icon">📋</span>
                <div class="item-content">
                    <div class="item-title">${escapeHtml(t.name)}</div>
                    <div class="item-subtitle">${t.exercises.length} oefeningen</div>
                </div>
                <span class="item-chevron">›</span>
            </div>
        `).join('');
        openModal('modal-workout-picker');
    }

    function startWorkout(templateId) {
        const session = DB.startSession(templateId);
        closeModal('modal-workout-picker');
        openSession(session.id);
    }

    // ============================================================
    // WORKOUT LOG (sub-page within home or workouts)
    // ============================================================
    function openSession(sessionId) {
        currentSessionId = sessionId;
        const session = DB.getSession(sessionId);
        if (!session) return;

        // Hide tab pages, show workout log page
        const panel = document.getElementById('panel-health');
        panel.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('page-workout-log').classList.add('active');

        renderWorkoutLog(session);
    }

    function renderWorkoutLog(session) {
        document.getElementById('wl-title').textContent = session.templateName;
        document.getElementById('wl-time').textContent = 'Gestart: ' + formatTime(session.startedAt);

        const completeBtn = document.getElementById('wl-complete-btn');
        const deleteBtn = document.getElementById('wl-delete-btn');
        if (session.completedAt) {
            completeBtn.classList.add('hidden');
            deleteBtn.classList.add('hidden');
            document.getElementById('wl-completed-msg').textContent = 'Afgerond om ' + formatTime(session.completedAt);
            document.getElementById('wl-completed-msg').classList.remove('hidden');
        } else {
            completeBtn.classList.remove('hidden');
            deleteBtn.classList.remove('hidden');
            document.getElementById('wl-completed-msg').classList.add('hidden');
        }

        const container = document.getElementById('wl-exercises');
        container.innerHTML = session.exercises.map((ex, exIdx) => {
            // Use weightKg from exercise level, fallback to first set for backward compatibility
            const currentWeight = ex.weightKg != null ? ex.weightKg : (ex.sets[0] && ex.sets[0].weightKg != null ? ex.sets[0].weightKg : '');
            return `
            <div class="exercise-section">
                <div class="exercise-header">
                    <span class="exercise-name">${ex.order}. ${escapeHtml(ex.name)}</span>
                    <div class="exercise-weight">
                        <input type="number" inputmode="decimal" step="0.5"
                            class="set-input" placeholder="Kg"
                            value="${currentWeight}"
                            onchange="App.updateExerciseWeight('${session.id}', ${exIdx}, this.value)">
                        <span class="set-unit">kg</span>
                    </div>
                </div>
                ${ex.sets.map((set, setIdx) => `
                    <div class="set-row">
                        <span class="set-label">Set ${set.setNumber}</span>
                        <input type="number" inputmode="numeric" pattern="[0-9]*"
                            class="set-input" placeholder="Reps"
                            value="${set.reps != null ? set.reps : ''}"
                            onchange="App.updateSet('${session.id}', ${exIdx}, ${setIdx}, 'reps', this.value)">
                        <span class="set-unit">reps</span>
                    </div>
                `).join('')}
            </div>
        `}).join('');
    }

    function updateExerciseWeight(sessionId, exIdx, value) {
        const session = DB.getSession(sessionId);
        if (!session) return;
        const parsed = parseFloat(String(value).replace(',', '.'));
        session.exercises[exIdx].weightKg = isNaN(parsed) ? null : parsed;
        DB.saveSession(session);
    }

    function updateSet(sessionId, exIdx, setIdx, field, value) {
        const session = DB.getSession(sessionId);
        if (!session) return;

        if (field === 'reps') {
            session.exercises[exIdx].sets[setIdx].reps = value ? parseInt(value) : null;
        }

        DB.saveSession(session);
    }

    function completeWorkout() {
        if (!currentSessionId) return;
        if (!confirm('Weet je zeker dat je deze workout wilt afronden?')) return;
        DB.completeSession(currentSessionId);
        const session = DB.getSession(currentSessionId);
        renderWorkoutLog(session);
    }

    function deleteWorkout() {
        if (!currentSessionId) return;
        if (!confirm('Weet je zeker dat je deze workout wilt verwijderen?')) return;
        DB.deleteSession(currentSessionId);
        currentSessionId = null;
        showPage('home');
    }

    function backFromWorkoutLog() {
        currentSessionId = null;
        showPage('home');
    }

    // ============================================================
    // HISTORY
    // ============================================================
    let historyDate = new Date();

    function renderHistory() {
        const year = historyDate.getFullYear();
        const month = historyDate.getMonth() + 1;

        document.getElementById('history-month').textContent = formatMonthYear(historyDate);

        const days = DB.getDaysForMonth(year, month);
        const container = document.getElementById('history-list');

        if (days.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-icon">📅</div><p>Geen gegevens deze maand</p></div>';
            return;
        }

        const sessions = DB.getRecentSessions(100);

        container.innerHTML = '<div class="list">' + days.map(day => {
            // Weight badge
            const weight = day.weights.length > 0
                ? `⚖️ ${day.weights[day.weights.length - 1].kg.toFixed(1)}` + (day.weights.length > 1 ? ` (${day.weights.length}×)` : '')
                : '';

            // BP badge
            let bp = '';
            if (day.bloodPressure.length > 0) {
                const lastBP = day.bloodPressure[day.bloodPressure.length - 1];
                bp = lastBP.skipped
                    ? '❤️ Niet gemeten'
                    : `❤️ ${lastBP.systolic}/${lastBP.diastolic}`;
                if (day.bloodPressure.length > 1) bp += ` (${day.bloodPressure.length}×)`;
            }

            // Sleep badge
            let sleep = '';
            if (day.sleepEntries.length > 0) {
                const lastSleep = day.sleepEntries[day.sleepEntries.length - 1];
                sleep = `🌙 ${lastSleep.hours}u` + (lastSleep.interrupted ? ' ⚡' : '');
                if (day.sleepEntries.length > 1) sleep += ` (${day.sleepEntries.length}×)`;
            }

            // Gym badge
            let gym = '';
            if (day.gymSessions.length > 0) {
                const lastGym = day.gymSessions[day.gymSessions.length - 1];
                if (lastGym.type === 'Niet gegaan') {
                    gym = '💪 Niet gegaan';
                } else {
                    gym = `💪 ${escapeHtml(lastGym.type)}`;
                    if (lastGym.km) gym += ` ${lastGym.km}km`;
                }
                if (day.gymSessions.length > 1) gym += ` (${day.gymSessions.length}×)`;
            }

            // Drinks badge
            let drinks = '';
            if (day.drinks.length > 0) {
                const lastDrink = day.drinks[day.drinks.length - 1];
                const dParts = [];
                if (lastDrink.coffee > 0) dParts.push(`☕${lastDrink.coffee}`);
                if (lastDrink.alcohol) dParts.push(`🍷${lastDrink.alcoholGlasses || 0}`);
                const histWater = lastDrink.waterAmount != null ? lastDrink.waterAmount : (lastDrink.water2L ? 2 : 0);
                dParts.push('💧' + histWater + 'L');
                drinks = dParts.join(' ');
            }

            // Nutrition badge
            let nutrition = '';
            if (day.nutrition.length > 0) {
                const lastN = day.nutrition[day.nutrition.length - 1];
                const meals = [lastN.ontbijt, lastN.tussen1, lastN.lunch, lastN.tussen2, lastN.diner, lastN.tussen3];
                const filled = meals.filter(m => m && m.trim()).length;
                nutrition = `🍲 ${filled}/6`;
            }

            // Workout badge
            const dayWorkouts = sessions.filter(s => s.date === day.date);
            const workout = dayWorkouts.length > 0 ? `🏋️ ${dayWorkouts.length}` : '';
            const notesFlag = day.notes ? '📝' : '';
            const badges = [weight, bp, sleep, gym, nutrition, drinks, workout, notesFlag].filter(Boolean).join('  ');

            return `
                <div class="list-item" onclick="App.openDayDetail('${day.date}')">
                    <div class="item-content">
                        <div class="item-title">${formatDayOfWeek(day.date)}</div>
                        <div class="item-subtitle">${badges || 'Geen data'}</div>
                    </div>
                    <span class="item-chevron">›</span>
                </div>
            `;
        }).join('') + '</div>';
    }

    function historyPrev() {
        historyDate.setMonth(historyDate.getMonth() - 1);
        renderHistory();
    }
    function historyNext() {
        historyDate.setMonth(historyDate.getMonth() + 1);
        renderHistory();
    }

    // ============================================================
    // DAY DETAIL (sub-page)
    // ============================================================
    function openDayDetail(dateStr) {
        currentDayDetail = dateStr;
        const panel = document.getElementById('panel-health');
        panel.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('page-day-detail').classList.add('active');
        renderDayDetail();
    }

    function renderDayDetail() {
        const dateStr = currentDayDetail;
        const day = DB.getDay(dateStr);
        const sessions = DB.getSessionsForDate(dateStr);

        document.getElementById('dd-title').textContent = formatDateNL(dateStr);

        const container = document.getElementById('dd-content');
        let html = '';

        // Weight
        html += '<div class="section-title">Gewicht</div><div class="list">';
        if (day && day.weights.length > 0) {
            for (const w of day.weights) {
                html += `<div class="detail-row">
                    <span class="detail-icon">⚖️</span>
                    <div class="detail-content">
                        <div class="detail-value">${w.kg.toFixed(1)} kg</div>
                        <div class="detail-label">${formatTime(w.timestamp)}</div>
                    </div>
                    <div class="detail-actions">
                        <button class="btn-small btn-danger" onclick="App.deleteWeight('${dateStr}', '${w.id}')">✕</button>
                    </div>
                </div>`;
            }
        } else {
            html += '<div class="detail-row"><span class="text-muted">Geen gewicht</span></div>';
        }
        html += '</div>';

        // Blood pressure
        html += '<div class="section-title">Bloeddruk</div><div class="list">';
        if (day && day.bloodPressure.length > 0) {
            for (const bp of day.bloodPressure) {
                if (bp.skipped) {
                    html += `<div class="detail-row">
                        <span class="detail-icon">❤️</span>
                        <div class="detail-content">
                            <div class="detail-value">Niet gemeten</div>
                            <div class="detail-label">${bp.moment} · ${formatTime(bp.timestamp)}</div>
                        </div>
                        <div class="detail-actions">
                            <button class="btn-small btn-danger" onclick="App.deleteBP('${dateStr}', '${bp.id}')">✕</button>
                        </div>
                    </div>`;
                } else {
                    html += `<div class="detail-row">
                        <span class="detail-icon">❤️</span>
                        <div class="detail-content">
                            <div class="detail-value">${bp.systolic}/${bp.diastolic}</div>
                            <div class="detail-label">Pols: ${bp.pulse} bpm · ${bp.moment} · ${formatTime(bp.timestamp)}</div>
                        </div>
                        <div class="detail-actions">
                            <button class="btn-small btn-danger" onclick="App.deleteBP('${dateStr}', '${bp.id}')">✕</button>
                        </div>
                    </div>`;
                }
            }
        } else {
            html += '<div class="detail-row"><span class="text-muted">Geen bloeddruk</span></div>';
        }
        html += '</div>';

        // Sleep
        html += '<div class="section-title">Slaap</div><div class="list">';
        if (day && day.sleepEntries.length > 0) {
            for (const s of day.sleepEntries) {
                const interruptedLabel = s.interrupted ? 'Ja' : 'Nee';
                const locationLabel = s.location ? `Locatie: ${escapeHtml(s.location)} · ` : '';
                html += `<div class="detail-row">
                    <span class="detail-icon">🌙</span>
                    <div class="detail-content">
                        <div class="detail-value">${s.hours} uur</div>
                        <div class="detail-label">${locationLabel}Onderbroken: ${interruptedLabel} · ${formatTime(s.timestamp)}</div>
                        ${s.note ? `<div class="detail-label" style="margin-top:4px;font-style:italic;">${escapeHtml(s.note)}</div>` : ''}
                    </div>
                    <div class="detail-actions">
                        <button class="btn-small btn-danger" onclick="App.deleteSleep('${dateStr}', '${s.id}')">✕</button>
                    </div>
                </div>`;
            }
        } else {
            html += '<div class="detail-row"><span class="text-muted">Geen slaapdata</span></div>';
        }
        html += '</div>';

        // Gym
        html += '<div class="section-title">Gym</div><div class="list">';
        if (day && day.gymSessions.length > 0) {
            for (const g of day.gymSessions) {
                if (g.type === 'Niet gegaan') {
                    html += `<div class="detail-row">
                        <span class="detail-icon">💪</span>
                        <div class="detail-content">
                            <div class="detail-value">Niet gegaan</div>
                            <div class="detail-label">${formatTime(g.timestamp)}</div>
                            ${g.note ? `<div class="detail-label" style="margin-top:4px;font-style:italic;">${escapeHtml(g.note)}</div>` : ''}
                        </div>
                        <div class="detail-actions">
                            <button class="btn-small btn-danger" onclick="App.deleteGym('${dateStr}', '${g.id}')">✕</button>
                        </div>
                    </div>`;
                } else {
                    const kmLabel = g.km ? ` · ${g.km} km` : '';
                    html += `<div class="detail-row">
                        <span class="detail-icon">💪</span>
                        <div class="detail-content">
                            <div class="detail-value">${escapeHtml(g.type)}</div>
                            <div class="detail-label">${g.durationMinutes} minuten${kmLabel} · ${formatTime(g.timestamp)}</div>
                            ${g.note ? `<div class="detail-label" style="margin-top:4px;font-style:italic;">${escapeHtml(g.note)}</div>` : ''}
                        </div>
                        <div class="detail-actions">
                            <button class="btn-small btn-danger" onclick="App.deleteGym('${dateStr}', '${g.id}')">✕</button>
                        </div>
                    </div>`;
                }
            }
        } else {
            html += '<div class="detail-row"><span class="text-muted">Geen gym sessie</span></div>';
        }
        html += '</div>';

        // Drinks
        html += '<div class="section-title">Drankjes</div><div class="list">';
        if (day && day.drinks.length > 0) {
            for (const d of day.drinks) {
                const coffeeLine = (d.coffee > 0 || d.decaf > 0)
                    ? `Koffie: ${d.coffee}, Decaf: ${d.decaf}`
                    : 'Geen koffie';
                let alcoholLine = 'Alcohol: Nee';
                if (d.alcohol) {
                    alcoholLine = `Alcohol: Ja · ${d.alcoholGlasses || 0} glazen`;
                    if (d.alcoholNote) alcoholLine += ` · ${escapeHtml(d.alcoholNote)}`;
                }
                const detailWater = d.waterAmount != null ? d.waterAmount : (d.water2L ? 2 : 0);
                const waterLine = 'Water: ' + detailWater + ' liter';
                html += `<div class="detail-row">
                    <span class="detail-icon">☕</span>
                    <div class="detail-content">
                        <div class="detail-value">${coffeeLine}</div>
                        <div class="detail-label">${alcoholLine}</div>
                        <div class="detail-label">${waterLine}</div>
                        <div class="detail-label" style="margin-top:2px;color:var(--text2);">${formatTime(d.timestamp)}</div>
                    </div>
                    <div class="detail-actions">
                        <button class="btn-small btn-danger" onclick="App.deleteDrinks('${dateStr}', '${d.id}')">✕</button>
                    </div>
                </div>`;
            }
        } else {
            html += '<div class="detail-row"><span class="text-muted">Geen drankjes data</span></div>';
        }
        html += '</div>';

        // Nutrition
        html += '<div class="section-title">Voeding</div><div class="list">';
        if (day && day.nutrition.length > 0) {
            for (const n of day.nutrition) {
                const mealLabels = [
                    { label: 'Ontbijt', val: n.ontbijt },
                    { label: 'Tussendoor 1', val: n.tussen1 },
                    { label: 'Lunch', val: n.lunch },
                    { label: 'Tussendoor 2', val: n.tussen2 },
                    { label: 'Diner', val: n.diner },
                    { label: 'Tussendoor 3', val: n.tussen3 },
                ];
                const filledMeals = mealLabels.filter(m => m.val && m.val.trim());
                const mealsHtml = filledMeals.map(m =>
                    `<div class="detail-label"><strong>${m.label}:</strong> ${escapeHtml(m.val)}</div>`
                ).join('');
                html += `<div class="detail-row">
                    <span class="detail-icon">🍲</span>
                    <div class="detail-content">
                        <div class="detail-value">${filledMeals.length}/6 maaltijden</div>
                        ${mealsHtml}
                        <div class="detail-label" style="margin-top:2px;color:var(--text2);">${formatTime(n.timestamp)}</div>
                    </div>
                    <div class="detail-actions">
                        <button class="btn-small btn-danger" onclick="App.deleteNutrition('${dateStr}', '${n.id}')">✕</button>
                    </div>
                </div>`;
            }
        } else {
            html += '<div class="detail-row"><span class="text-muted">Geen voedingsdata</span></div>';
        }
        html += '</div>';

        // Workouts
        html += '<div class="section-title">Workouts</div>';
        if (sessions.length === 0) {
            html += '<div class="list"><div class="detail-row"><span class="text-muted">Geen workouts</span></div></div>';
        } else {
            html += '<div class="list">' + sessions.map(s => `
                <div class="list-item" onclick="App.openSession('${s.id}')">
                    <span class="item-icon">🏋️</span>
                    <div class="item-content">
                        <div class="item-title">${escapeHtml(s.templateName)}</div>
                        <div class="item-subtitle">${formatTime(s.startedAt)}</div>
                    </div>
                    <span class="item-badge ${s.completedAt ? 'badge-green' : 'badge-orange'}">
                        ${s.completedAt ? 'Afgerond' : 'Bezig'}
                    </span>
                    <span class="item-chevron">›</span>
                </div>
            `).join('') + '</div>';
        }

        // Notes
        const notesVal = (day && day.notes) ? day.notes : '';
        html += '<div class="section-title">Notities</div>';
        html += `<div class="list" style="padding: 12px 16px;">
            <textarea id="dd-notes" rows="3" class="form-textarea" placeholder="Notities voor deze dag...">${escapeHtml(notesVal)}</textarea>
            <button class="btn btn-primary btn-small mt-8" onclick="App.saveDayNotes()">Bewaar notitie</button>
        </div>`;

        container.innerHTML = html;
    }

    function saveDayNotes() {
        if (!currentDayDetail) return;
        const notes = document.getElementById('dd-notes').value.trim();
        DB.saveNotes(currentDayDetail, notes);
    }

    // --- Delete handlers for day detail ---
    function deleteWeight(dateStr, weightId) {
        if (!confirm('Gewicht meting verwijderen?')) return;
        DB.deleteWeight(dateStr, weightId);
        renderDayDetail();
    }

    function deleteBP(dateStr, bpId) {
        if (!confirm('Bloeddruk meting verwijderen?')) return;
        DB.deleteBloodPressure(dateStr, bpId);
        renderDayDetail();
    }

    function deleteSleep(dateStr, sleepId) {
        if (!confirm('Slaap registratie verwijderen?')) return;
        DB.deleteSleep(dateStr, sleepId);
        renderDayDetail();
    }

    function deleteGym(dateStr, gymId) {
        if (!confirm('Gym sessie verwijderen?')) return;
        DB.deleteGym(dateStr, gymId);
        renderDayDetail();
    }

    function deleteDrinks(dateStr, drinksId) {
        if (!confirm('Drankjes registratie verwijderen?')) return;
        DB.deleteDrinks(dateStr, drinksId);
        renderDayDetail();
    }

    function deleteNutrition(dateStr, nutritionId) {
        if (!confirm('Voeding registratie verwijderen?')) return;
        DB.deleteNutrition(dateStr, nutritionId);
        renderDayDetail();
    }

    function backFromDayDetail() {
        currentDayDetail = null;
        showPage('history');
    }

    // ============================================================
    // EXPORT
    // ============================================================
    function renderExport() {
        // Set default dates if empty
        const start = document.getElementById('export-start');
        const end = document.getElementById('export-end');
        if (!start.value) {
            const d = new Date();
            d.setMonth(d.getMonth() - 1);
            start.value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        }
        if (!end.value) {
            end.value = DB.todayKey();
        }
    }

    function doExport(type) {
        const start = document.getElementById('export-start').value;
        const end = document.getElementById('export-end').value;
        const includeWorkouts = document.getElementById('export-workouts').checked;
        const includeHabits = document.getElementById('export-habits').checked;
        const includeJournal = document.getElementById('export-journal').checked;
        const includeWeekSummary = document.getElementById('export-weeksummary').checked;

        if (!start || !end) {
            alert('Kies een begin- en einddatum.');
            return;
        }

        if (type === 'csv') {
            ExportService.exportCSV(start, end, includeWorkouts, includeHabits, includeJournal, includeWeekSummary);
        } else {
            ExportService.exportPDF(start, end, includeWorkouts, includeHabits, includeJournal, includeWeekSummary);
        }
    }

    // ============================================================
    // SETTINGS
    // ============================================================
    function renderSettings() {
        // Nothing dynamic for now
    }

    function clearAllData() {
        if (!confirm('Weet je zeker dat je ALLE gegevens wilt wissen? Dit kan niet ongedaan worden.')) return;
        if (!confirm('Laatste kans: alle data wordt permanent verwijderd.')) return;
        localStorage.removeItem('hl_days');
        localStorage.removeItem('hl_sessions');
        localStorage.removeItem('hl_templates');
        renderHome();
        alert('Alle gegevens zijn gewist.');
    }

    // ============================================================
    // HELPERS
    // ============================================================
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ============================================================
    // DATE FORMATTING
    // ============================================================
    function formatFullDate(date) {
        return date.toLocaleDateString('nl-NL', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
    }
    function formatDayOfWeek(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        const weekday = d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
        return weekday.charAt(0).toUpperCase() + weekday.slice(1);
    }
    function formatMonthYear(date) {
        const str = date.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' });
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
    function formatTime(isoStr) {
        return new Date(isoStr).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    }

    // ============================================================
    // INIT
    // ============================================================
    function init() {
        showPage('home');
    }

    // ============================================================
    // PUBLIC API
    // ============================================================
    return {
        init,
        showPage,
        // Home date navigation
        homePrevDay,
        homeNextDay,
        homeGoToToday,
        // Modals
        openModal,
        closeModal,
        onOverlayClick,
        openWeightModal,
        saveWeight,
        openBPModal,
        setBPMoment,
        saveBP,
        skipBP,
        openSleepModal,
        saveSleep,
        setSleepInterrupted,
        onSleepLocationChange,
        openGymModal,
        onGymAttendance,
        onGymTypeChange,
        saveGym,
        openDrinksModal,
        setDrinksAlcohol,
        saveDrinks,
        openNutritionModal,
        saveNutrition,
        openWorkoutPicker,
        startWorkout,
        // Workout log
        openSession,
        updateExerciseWeight,
        updateSet,
        completeWorkout,
        deleteWorkout,
        backFromWorkoutLog,
        // History
        historyPrev,
        historyNext,
        openDayDetail,
        backFromDayDetail,
        // Day detail delete actions
        deleteWeight,
        deleteBP,
        deleteSleep,
        deleteGym,
        deleteDrinks,
        deleteNutrition,
        saveDayNotes,
        // Export
        doExport,
        // Settings
        clearAllData,
    };
})();

// Init is now called by Layout.init()
