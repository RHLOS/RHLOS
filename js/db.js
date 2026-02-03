// ============================================================
// db.js — LocalStorage data layer for RHLOS
// ============================================================
// Keys:
//   hl_days        -> { "2025-01-30": DayEntry, ... }
//   hl_sessions    -> [ WorkoutSession, ... ]
//   hl_templates   -> [ WorkoutTemplate, ... ]  (seeded once)
// ============================================================

const DB = (() => {

    // --- helpers ---
    function _get(key) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            console.error('DB._get fout bij key:', key, e);
            return null;
        }
    }
    function _set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error('DB._set fout bij key:', key, e);
        }
    }
    function todayKey() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    // ============================================================
    // TEMPLATES (seeded on first load)
    // ============================================================
    const DEFAULT_TEMPLATES = [
        {
            id: 'tpl_a',
            name: 'Workout A',
            exercises: [
                { name: 'Pull down',                order: 1, defaultSets: 3 },
                { name: 'Chest Fly',                order: 2, defaultSets: 3 },
                { name: 'Leg curl',                 order: 3, defaultSets: 3 },
                { name: 'Leg extension',            order: 4, defaultSets: 3 },
                { name: 'Shoulder press (machine)', order: 5, defaultSets: 3 },
                { name: 'Bicep curl (bar)',         order: 6, defaultSets: 3 },
                { name: 'Calf raise',               order: 7, defaultSets: 3 },
            ]
        },
        {
            id: 'tpl_b',
            name: 'Workout B',
            exercises: [
                { name: 'Rows',                     order: 1, defaultSets: 3 },
                { name: 'Chest press',              order: 2, defaultSets: 3 },
                { name: 'Hip raise',                order: 3, defaultSets: 3 },
                { name: 'Leg press',                order: 4, defaultSets: 3 },
                { name: 'Shoulder press (plate)',   order: 5, defaultSets: 3 },
                { name: 'Bicep curl (cable)',       order: 6, defaultSets: 3 },
                { name: 'Tricep (cable)',           order: 7, defaultSets: 3 },
            ]
        }
    ];

    function seedTemplates() {
        if (!_get('hl_templates')) {
            _set('hl_templates', DEFAULT_TEMPLATES);
        }
    }

    function getTemplates() {
        seedTemplates();
        return _get('hl_templates');
    }

    function getTemplate(id) {
        return getTemplates().find(t => t.id === id) || null;
    }

    // ============================================================
    // DAY ENTRIES
    // ============================================================
    // DayEntry shape (v3 — all arrays):
    // {
    //   date: "2025-01-30",
    //   weights: [ { id, kg, timestamp } ],
    //   bloodPressure: [ { id, systolic, diastolic, pulse, moment, timestamp } ],
    //   sleepEntries: [ { id, hours, interrupted, note, location?, timestamp } ],
    //   gymSessions: [ { id, type, durationMinutes, note, km?, timestamp } ],
    //   drinks: [ { id, coffee, decaf, alcohol, alcoholGlasses?, alcoholNote?, water2L?, waterAmount?, timestamp } ],
    //   nutrition: [ { id, ontbijt, tussen1, lunch, tussen2, diner, tussen3, timestamp } ],
    //   notes: ""
    // }

    function _getDays() {
        return _get('hl_days') || {};
    }
    function _saveDays(days) {
        _set('hl_days', days);
    }

    // --- Migration: convert old single-value fields to arrays ---
    function _migrateDay(day) {
        let changed = false;

        // weight (object) -> weights (array)
        if (day.weight && !day.weights) {
            day.weights = [{ id: generateId(), ...day.weight }];
            delete day.weight;
            changed = true;
        }
        if (!day.weights) {
            day.weights = [];
            changed = true;
        }

        // sleep (object) -> sleepEntries (array)
        if (day.sleep && !day.sleepEntries) {
            day.sleepEntries = [{ id: generateId(), ...day.sleep }];
            delete day.sleep;
            changed = true;
        }
        if (!day.sleepEntries) {
            day.sleepEntries = [];
            changed = true;
        }

        // gym (object) -> gymSessions (array)
        if (day.gym && !day.gymSessions) {
            day.gymSessions = [{ id: generateId(), ...day.gym }];
            delete day.gym;
            changed = true;
        }
        if (!day.gymSessions) {
            day.gymSessions = [];
            changed = true;
        }

        // bloodPressure should already be array
        if (!day.bloodPressure) {
            day.bloodPressure = [];
            changed = true;
        }

        // drinks array
        if (!day.drinks) {
            day.drinks = [];
            changed = true;
        }

        // nutrition array
        if (!day.nutrition) {
            day.nutrition = [];
            changed = true;
        }

        return changed;
    }

    function getDay(dateStr) {
        const days = _getDays();
        const day = days[dateStr] || null;
        if (day) {
            if (_migrateDay(day)) {
                days[dateStr] = day;
                _saveDays(days);
            }
        }
        return day;
    }

    function getOrCreateDay(dateStr) {
        const days = _getDays();
        if (!days[dateStr]) {
            days[dateStr] = {
                date: dateStr,
                weights: [],
                bloodPressure: [],
                sleepEntries: [],
                gymSessions: [],
                drinks: [],
                nutrition: [],
                notes: ''
            };
            _saveDays(days);
        } else {
            if (_migrateDay(days[dateStr])) {
                _saveDays(days);
            }
        }
        return days[dateStr];
    }

    function getToday() {
        return getOrCreateDay(todayKey());
    }

    function saveDay(dayEntry) {
        const days = _getDays();
        days[dayEntry.date] = dayEntry;
        _saveDays(days);
    }

    function getAllDays() {
        return _getDays();
    }

    function getDaysInRange(startDate, endDate) {
        const days = _getDays();
        const result = [];
        for (const [key, entry] of Object.entries(days)) {
            if (key >= startDate && key <= endDate) {
                _migrateDay(entry);
                result.push(entry);
            }
        }
        result.sort((a, b) => a.date.localeCompare(b.date));
        return result;
    }

    function getDaysForMonth(year, month) {
        const prefix = `${year}-${String(month).padStart(2, '0')}`;
        const days = _getDays();
        const result = [];
        for (const [key, entry] of Object.entries(days)) {
            if (key.startsWith(prefix)) {
                _migrateDay(entry);
                result.push(entry);
            }
        }
        result.sort((a, b) => b.date.localeCompare(a.date));
        return result;
    }

    // --- Weight ---
    function addWeight(dateStr, kg) {
        const parsed = parseFloat(kg);
        if (isNaN(parsed) || parsed <= 0) { console.error('addWeight: ongeldig gewicht', kg); return null; }
        const day = getOrCreateDay(dateStr);
        day.weights.push({
            id: generateId(),
            kg: parsed,
            timestamp: new Date().toISOString()
        });
        saveDay(day);
        return day;
    }

    function deleteWeight(dateStr, weightId) {
        const day = getDay(dateStr);
        if (!day) return;
        day.weights = day.weights.filter(w => w.id !== weightId);
        saveDay(day);
        return day;
    }

    // --- Blood Pressure ---
    function addBloodPressure(dateStr, systolic, diastolic, pulse, moment) {
        const s = parseInt(systolic), d = parseInt(diastolic), p = parseInt(pulse);
        if (isNaN(s) || isNaN(d) || isNaN(p)) { console.error('addBloodPressure: ongeldige waarden', systolic, diastolic, pulse); return null; }
        const day = getOrCreateDay(dateStr);
        day.bloodPressure.push({
            id: generateId(),
            systolic: s,
            diastolic: d,
            pulse: p,
            moment: moment,
            timestamp: new Date().toISOString()
        });
        saveDay(day);
        return day;
    }

    function addBloodPressureSkipped(dateStr, moment) {
        const day = getOrCreateDay(dateStr);
        day.bloodPressure.push({
            id: generateId(),
            skipped: true,
            moment: moment,
            timestamp: new Date().toISOString()
        });
        saveDay(day);
        return day;
    }

    function deleteBloodPressure(dateStr, bpId) {
        const day = getDay(dateStr);
        if (!day) return;
        day.bloodPressure = day.bloodPressure.filter(bp => bp.id !== bpId);
        saveDay(day);
        return day;
    }

    // --- Sleep ---
    function addSleep(dateStr, hours, interrupted, note, location) {
        const parsed = parseFloat(hours);
        if (isNaN(parsed) || parsed <= 0) { console.error('addSleep: ongeldige uren', hours); return null; }
        const day = getOrCreateDay(dateStr);
        day.sleepEntries.push({
            id: generateId(),
            hours: parsed,
            interrupted: !!interrupted,
            note: note || '',
            location: location || 'Thuis',
            timestamp: new Date().toISOString()
        });
        saveDay(day);
        return day;
    }

    function deleteSleep(dateStr, sleepId) {
        const day = getDay(dateStr);
        if (!day) return;
        day.sleepEntries = day.sleepEntries.filter(s => s.id !== sleepId);
        saveDay(day);
        return day;
    }

    // --- Gym ---
    function addGym(dateStr, type, durationMinutes, note, km) {
        const dur = parseInt(durationMinutes);
        if (!type) { console.error('addGym: geen type opgegeven'); return null; }
        if (type !== 'Niet gegaan' && (isNaN(dur) || dur <= 0)) { console.error('addGym: ongeldige duur', durationMinutes); return null; }
        const day = getOrCreateDay(dateStr);
        const entry = {
            id: generateId(),
            type: type,
            durationMinutes: dur || 0,
            note: note || '',
            timestamp: new Date().toISOString()
        };
        if (km != null && km > 0) {
            entry.km = parseFloat(km);
        }
        day.gymSessions.push(entry);
        saveDay(day);
        return day;
    }

    function deleteGym(dateStr, gymId) {
        const day = getDay(dateStr);
        if (!day) return;
        day.gymSessions = day.gymSessions.filter(g => g.id !== gymId);
        saveDay(day);
        return day;
    }

    // --- Drinks ---
    function addDrinks(dateStr, coffee, decaf, alcohol, alcoholGlasses, alcoholNote, waterAmount) {
        const day = getOrCreateDay(dateStr);
        const entry = {
            id: generateId(),
            coffee: parseInt(coffee) || 0,
            decaf: parseInt(decaf) || 0,
            alcohol: !!alcohol,
            waterAmount: parseFloat(waterAmount) || 0,
            water2L: (parseFloat(waterAmount) || 0) >= 2, // backward compatibility
            timestamp: new Date().toISOString()
        };
        if (entry.alcohol) {
            entry.alcoholGlasses = parseInt(alcoholGlasses) || 0;
            entry.alcoholNote = alcoholNote || '';
        }
        day.drinks.push(entry);
        saveDay(day);
        return day;
    }

    function deleteDrinks(dateStr, drinksId) {
        const day = getDay(dateStr);
        if (!day) return;
        day.drinks = day.drinks.filter(d => d.id !== drinksId);
        saveDay(day);
        return day;
    }

    // --- Nutrition ---
    function addNutrition(dateStr, ontbijt, tussen1, lunch, tussen2, diner, tussen3) {
        const day = getOrCreateDay(dateStr);
        day.nutrition.push({
            id: generateId(),
            ontbijt: ontbijt || '',
            tussen1: tussen1 || '',
            lunch: lunch || '',
            tussen2: tussen2 || '',
            diner: diner || '',
            tussen3: tussen3 || '',
            timestamp: new Date().toISOString()
        });
        saveDay(day);
        return day;
    }

    function getNutrition(dateStr) {
        const day = getDay(dateStr);
        if (!day || day.nutrition.length === 0) return null;
        return day.nutrition[day.nutrition.length - 1];
    }

    function upsertNutrition(dateStr, ontbijt, tussen1, lunch, tussen2, diner, tussen3) {
        const day = getOrCreateDay(dateStr);
        if (day.nutrition.length > 0) {
            const existing = day.nutrition[day.nutrition.length - 1];
            existing.ontbijt = ontbijt || '';
            existing.tussen1 = tussen1 || '';
            existing.lunch = lunch || '';
            existing.tussen2 = tussen2 || '';
            existing.diner = diner || '';
            existing.tussen3 = tussen3 || '';
            existing.timestamp = new Date().toISOString();
        } else {
            day.nutrition.push({
                id: generateId(),
                ontbijt: ontbijt || '',
                tussen1: tussen1 || '',
                lunch: lunch || '',
                tussen2: tussen2 || '',
                diner: diner || '',
                tussen3: tussen3 || '',
                timestamp: new Date().toISOString()
            });
        }
        saveDay(day);
        return day;
    }

    function deleteNutrition(dateStr, nutritionId) {
        const day = getDay(dateStr);
        if (!day) return;
        day.nutrition = day.nutrition.filter(n => n.id !== nutritionId);
        saveDay(day);
        return day;
    }

    // --- Notes ---
    function saveNotes(dateStr, notes) {
        const day = getOrCreateDay(dateStr);
        day.notes = notes;
        saveDay(day);
        return day;
    }

    // ============================================================
    // WORKOUT SESSIONS
    // ============================================================
    function _getSessions() {
        return _get('hl_sessions') || [];
    }
    function _saveSessions(sessions) {
        _set('hl_sessions', sessions);
    }

    function startSession(templateId) {
        const template = getTemplate(templateId);
        if (!template) return null;

        const session = {
            id: generateId(),
            templateId: template.id,
            templateName: template.name,
            date: todayKey(),
            startedAt: new Date().toISOString(),
            completedAt: null,
            exercises: template.exercises.map(ex => ({
                name: ex.name,
                order: ex.order,
                sets: Array.from({ length: ex.defaultSets }, (_, i) => ({
                    setNumber: i + 1,
                    reps: null,
                    weightKg: null
                }))
            }))
        };

        const sessions = _getSessions();
        sessions.push(session);
        _saveSessions(sessions);
        return session;
    }

    function getSession(id) {
        return _getSessions().find(s => s.id === id) || null;
    }

    function saveSession(session) {
        const sessions = _getSessions();
        const idx = sessions.findIndex(s => s.id === session.id);
        if (idx >= 0) {
            sessions[idx] = session;
        } else {
            sessions.push(session);
        }
        _saveSessions(sessions);
    }

    function completeSession(id) {
        const session = getSession(id);
        if (session) {
            session.completedAt = new Date().toISOString();
            saveSession(session);
        }
        return session;
    }

    function deleteSession(id) {
        const sessions = _getSessions().filter(s => s.id !== id);
        _saveSessions(sessions);
    }

    function getSessionsForDate(dateStr) {
        return _getSessions().filter(s => s.date === dateStr);
    }

    function getRecentSessions(limit = 20) {
        const sessions = _getSessions();
        sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
        return sessions.slice(0, limit);
    }

    function getSessionsInRange(startDate, endDate) {
        return _getSessions().filter(s => s.date >= startDate && s.date <= endDate)
            .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    }

    // ============================================================
    // PUBLIC API
    // ============================================================
    return {
        todayKey,
        generateId,
        // Templates
        getTemplates,
        getTemplate,
        // Days
        getDay,
        getOrCreateDay,
        getToday,
        saveDay,
        getAllDays,
        getDaysInRange,
        getDaysForMonth,
        // Weight
        addWeight,
        deleteWeight,
        // Blood Pressure
        addBloodPressure,
        addBloodPressureSkipped,
        deleteBloodPressure,
        // Sleep
        addSleep,
        deleteSleep,
        // Gym
        addGym,
        deleteGym,
        // Drinks
        addDrinks,
        deleteDrinks,
        // Nutrition
        addNutrition,
        getNutrition,
        upsertNutrition,
        deleteNutrition,
        // Notes
        saveNotes,
        // Sessions
        startSession,
        getSession,
        saveSession,
        completeSession,
        deleteSession,
        getSessionsForDate,
        getRecentSessions,
        getSessionsInRange,
    };
})();
