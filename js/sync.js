// ============================================================
// sync.js — Firestore data synchronization
// ============================================================

const Sync = (() => {
    let userId = null;
    let unsubscribers = [];
    let isSyncing = false;

    // Collection names in Firestore
    const COLLECTIONS = {
        healthDays: 'health_days',
        healthSessions: 'health_sessions',
        healthTemplates: 'health_templates',
        habits: 'habits',
        habitsCompletions: 'habits_completions',
        journal: 'journal',
        workTasks: 'work_tasks',
        workClients: 'work_clients',
        workProjects: 'work_projects',
        weeklyReview: 'weekly_review'
    };

    function startSync(uid) {
        if (isSyncing) return;

        userId = uid;
        isSyncing = true;
        console.log('[Sync] Starting sync for user:', uid);

        updateSyncStatus('syncing');

        // Always set up listeners, even if migration fails
        migrateIfNeeded()
            .catch((error) => {
                console.warn('[Sync] Migration check failed (non-fatal):', error);
            })
            .then(() => {
                // Start listening for changes from Firestore regardless
                setupRealtimeListeners();
                updateSyncStatus('synced');
            })
            .catch((error) => {
                console.error('[Sync] Listener setup failed:', error);
                updateSyncStatus('error');
            });
    }

    function stopSync() {
        isSyncing = false;
        userId = null;

        // Unsubscribe from all listeners
        unsubscribers.forEach(unsub => unsub());
        unsubscribers = [];

        console.log('[Sync] Stopped syncing');
        updateSyncStatus('offline');
    }

    function updateSyncStatus(status) {
        const statusEl = document.getElementById('sync-status');
        const statusIcon = document.getElementById('sync-icon');
        const statusText = document.getElementById('sync-text');

        if (!statusEl) return;

        const states = {
            syncing: { icon: '🔄', text: 'Synchroniseren...', class: 'syncing' },
            synced: { icon: '✓', text: 'Gesynchroniseerd', class: 'synced' },
            error: { icon: '⚠', text: 'Sync fout', class: 'error' },
            offline: { icon: '○', text: 'Offline', class: 'offline' }
        };

        const state = states[status] || states.offline;
        if (statusIcon) statusIcon.textContent = state.icon;
        if (statusText) statusText.textContent = state.text;
        statusEl.className = 'sync-status ' + state.class;
    }

    // Check if Firestore already has data; if not, upload local data (one-time migration)
    async function migrateIfNeeded() {
        const db = getFirebaseDb();
        if (!db || !userId) return;

        // Check if user already has data in Firestore by looking at the habits collection
        const existingHabits = await db.collection('users').doc(userId)
            .collection(COLLECTIONS.habits).limit(1).get();

        if (!existingHabits.empty) {
            console.log('[Sync] Firestore already has data, skipping migration');
            return;
        }

        console.log('[Sync] First sync — uploading local data to Firestore...');
        await uploadLocalData();
    }

    // Upload all local data to Firestore (one-time migration only)
    async function uploadLocalData() {
        const db = getFirebaseDb();
        if (!db || !userId) return;

        // Firestore batch limit is 500 operations, so we split into multiple batches
        let batches = [];
        let currentBatch = db.batch();
        let operations = 0;
        let batchOps = 0;
        const BATCH_LIMIT = 450; // leave some margin

        function addToBatch(docRef, data) {
            if (batchOps >= BATCH_LIMIT) {
                batches.push(currentBatch);
                currentBatch = db.batch();
                batchOps = 0;
            }
            currentBatch.set(docRef, data, { merge: true });
            batchOps++;
            operations++;
        }

        const ts = firebase.firestore.FieldValue.serverTimestamp();

        // Health Days
        const healthDays = JSON.parse(localStorage.getItem('hl_days') || '{}');
        for (const [dateKey, dayData] of Object.entries(healthDays)) {
            const docRef = db.collection('users').doc(userId)
                .collection(COLLECTIONS.healthDays).doc(dateKey);
            addToBatch(docRef, { ...dayData, updatedAt: ts });
        }

        // Health Sessions
        const healthSessions = JSON.parse(localStorage.getItem('hl_sessions') || '[]');
        for (const session of healthSessions) {
            const docRef = db.collection('users').doc(userId)
                .collection(COLLECTIONS.healthSessions).doc(session.id);
            addToBatch(docRef, { ...session, updatedAt: ts });
        }

        // Health Templates
        const healthTemplates = JSON.parse(localStorage.getItem('hl_templates') || '[]');
        for (const template of healthTemplates) {
            const docRef = db.collection('users').doc(userId)
                .collection(COLLECTIONS.healthTemplates).doc(template.id);
            addToBatch(docRef, { ...template, updatedAt: ts });
        }

        // Habits
        const habits = JSON.parse(localStorage.getItem('ht_habits') || '[]');
        for (const habit of habits) {
            const docRef = db.collection('users').doc(userId)
                .collection(COLLECTIONS.habits).doc(habit.id);
            addToBatch(docRef, { ...habit, updatedAt: ts });
        }

        // Habits Completions
        const habitsCompletions = JSON.parse(localStorage.getItem('ht_completions') || '{}');
        for (const [dateKey, completions] of Object.entries(habitsCompletions)) {
            const docRef = db.collection('users').doc(userId)
                .collection(COLLECTIONS.habitsCompletions).doc(dateKey);
            addToBatch(docRef, { completions, updatedAt: ts });
        }

        // Journal - 5MJ entries
        const journal5MJ = JSON.parse(localStorage.getItem('5mj_entries') || '{}');
        for (const [dateKey, entry] of Object.entries(journal5MJ)) {
            const docRef = db.collection('users').doc(userId)
                .collection(COLLECTIONS.journal).doc('5mj_' + dateKey);
            addToBatch(docRef, { type: '5mj', date: dateKey, ...entry, updatedAt: ts });
        }

        // Journal - Daily Review entries
        const journalDR = JSON.parse(localStorage.getItem('dr_entries') || '{}');
        for (const [dateKey, entry] of Object.entries(journalDR)) {
            const docRef = db.collection('users').doc(userId)
                .collection(COLLECTIONS.journal).doc('dr_' + dateKey);
            addToBatch(docRef, { type: 'daily_review', date: dateKey, ...entry, updatedAt: ts });
        }

        // Work Tasks
        const workTasks = JSON.parse(localStorage.getItem('wk_tasks') || '[]');
        for (const task of workTasks) {
            const docRef = db.collection('users').doc(userId)
                .collection(COLLECTIONS.workTasks).doc(task.id);
            addToBatch(docRef, { ...task, updatedAt: ts });
        }

        // Work Clients
        const workClients = JSON.parse(localStorage.getItem('wk_clients') || '[]');
        for (const client of workClients) {
            const docRef = db.collection('users').doc(userId)
                .collection(COLLECTIONS.workClients).doc(client.id);
            addToBatch(docRef, { ...client, updatedAt: ts });
        }

        // Work Projects
        const workProjects = JSON.parse(localStorage.getItem('wk_projects') || '[]');
        for (const project of workProjects) {
            const docRef = db.collection('users').doc(userId)
                .collection(COLLECTIONS.workProjects).doc(project.id);
            addToBatch(docRef, { ...project, updatedAt: ts });
        }

        // Weekly Review — checklist, last completed, summaries
        const wrChecklist = localStorage.getItem('wr_checklist');
        if (wrChecklist) {
            const docRef = db.collection('users').doc(userId)
                .collection(COLLECTIONS.weeklyReview).doc('checklist');
            addToBatch(docRef, { data: JSON.parse(wrChecklist), updatedAt: ts });
        }
        const wrLastCompleted = localStorage.getItem('wr_last_completed');
        if (wrLastCompleted) {
            const docRef = db.collection('users').doc(userId)
                .collection(COLLECTIONS.weeklyReview).doc('last_completed');
            addToBatch(docRef, { value: wrLastCompleted, updatedAt: ts });
        }
        const wrSummaries = JSON.parse(localStorage.getItem('wr_summaries') || '{}');
        for (const [weekKey, summary] of Object.entries(wrSummaries)) {
            const docRef = db.collection('users').doc(userId)
                .collection(COLLECTIONS.weeklyReview).doc('summary_' + weekKey);
            addToBatch(docRef, { ...summary, updatedAt: ts });
        }

        if (operations > 0) {
            // Commit the last batch
            batches.push(currentBatch);
            for (const b of batches) {
                await b.commit();
            }
            console.log('[Sync] Uploaded', operations, 'items in', batches.length, 'batch(es) to Firestore');
        } else {
            console.log('[Sync] No local data to upload');
        }
    }

    // Remove Firestore metadata fields before storing in localStorage
    function cleanDoc(data) {
        const cleaned = { ...data };
        delete cleaned.updatedAt;
        return cleaned;
    }

    // Don't overwrite non-empty local data with empty Firestore data
    // This protects against data loss when Firestore is empty but localStorage has data
    function safeSetLocal(key, newData, format) {
        const isEmpty = format === 'array' ? newData.length === 0 : Object.keys(newData).length === 0;
        if (isEmpty) {
            const existing = localStorage.getItem(key);
            if (existing) {
                const parsed = JSON.parse(existing);
                const localHasData = format === 'array' ? parsed.length > 0 : Object.keys(parsed).length > 0;
                if (localHasData) {
                    console.warn('[Sync] Firestore empty for', key, '— keeping local data and uploading to Firestore');
                    // Upload local data to Firestore instead of overwriting
                    uploadCollectionFromLocal(key);
                    return false; // signal: did NOT overwrite
                }
            }
        }
        localStorage.setItem(key, JSON.stringify(newData));
        return true;
    }

    // Re-upload a single localStorage collection to Firestore
    function uploadCollectionFromLocal(key) {
        const db = getFirebaseDb();
        if (!db || !userId) return;

        const ts = firebase.firestore.FieldValue.serverTimestamp();

        if (key === 'ht_habits') {
            const habits = JSON.parse(localStorage.getItem(key) || '[]');
            habits.forEach(h => {
                db.collection('users').doc(userId)
                    .collection(COLLECTIONS.habits).doc(h.id)
                    .set({ ...h, updatedAt: ts }, { merge: true })
                    .catch(e => console.error('[Sync] Upload failed:', e));
            });
        } else if (key === 'ht_completions') {
            const completions = JSON.parse(localStorage.getItem(key) || '{}');
            for (const [dateKey, comps] of Object.entries(completions)) {
                db.collection('users').doc(userId)
                    .collection(COLLECTIONS.habitsCompletions).doc(dateKey)
                    .set({ completions: comps, updatedAt: ts }, { merge: true })
                    .catch(e => console.error('[Sync] Upload failed:', e));
            }
        } else if (key === 'hl_days') {
            const days = JSON.parse(localStorage.getItem(key) || '{}');
            for (const [dateKey, dayData] of Object.entries(days)) {
                db.collection('users').doc(userId)
                    .collection(COLLECTIONS.healthDays).doc(dateKey)
                    .set({ ...dayData, updatedAt: ts }, { merge: true })
                    .catch(e => console.error('[Sync] Upload failed:', e));
            }
        } else if (key === 'hl_sessions') {
            const sessions = JSON.parse(localStorage.getItem(key) || '[]');
            sessions.forEach(s => {
                db.collection('users').doc(userId)
                    .collection(COLLECTIONS.healthSessions).doc(s.id)
                    .set({ ...s, updatedAt: ts }, { merge: true })
                    .catch(e => console.error('[Sync] Upload failed:', e));
            });
        } else if (key === 'hl_templates') {
            const templates = JSON.parse(localStorage.getItem(key) || '[]');
            templates.forEach(t => {
                db.collection('users').doc(userId)
                    .collection(COLLECTIONS.healthTemplates).doc(t.id)
                    .set({ ...t, updatedAt: ts }, { merge: true })
                    .catch(e => console.error('[Sync] Upload failed:', e));
            });
        } else if (key === '5mj_entries' || key === 'dr_entries') {
            const entries = JSON.parse(localStorage.getItem(key) || '{}');
            const prefix = key === '5mj_entries' ? '5mj_' : 'dr_';
            const type = key === '5mj_entries' ? '5mj' : 'daily_review';
            for (const [dateKey, entry] of Object.entries(entries)) {
                db.collection('users').doc(userId)
                    .collection(COLLECTIONS.journal).doc(prefix + dateKey)
                    .set({ type, date: dateKey, ...entry, updatedAt: ts }, { merge: true })
                    .catch(e => console.error('[Sync] Upload failed:', e));
            }
        } else if (key === 'wk_tasks') {
            const tasks = JSON.parse(localStorage.getItem(key) || '[]');
            tasks.forEach(t => {
                db.collection('users').doc(userId)
                    .collection(COLLECTIONS.workTasks).doc(t.id)
                    .set({ ...t, updatedAt: ts }, { merge: true })
                    .catch(e => console.error('[Sync] Upload failed:', e));
            });
        } else if (key === 'wk_clients') {
            const clients = JSON.parse(localStorage.getItem(key) || '[]');
            clients.forEach(c => {
                db.collection('users').doc(userId)
                    .collection(COLLECTIONS.workClients).doc(c.id)
                    .set({ ...c, updatedAt: ts }, { merge: true })
                    .catch(e => console.error('[Sync] Upload failed:', e));
            });
        } else if (key === 'wk_projects') {
            const projects = JSON.parse(localStorage.getItem(key) || '[]');
            projects.forEach(p => {
                db.collection('users').doc(userId)
                    .collection(COLLECTIONS.workProjects).doc(p.id)
                    .set({ ...p, updatedAt: ts }, { merge: true })
                    .catch(e => console.error('[Sync] Upload failed:', e));
            });
        }
    }

    // Set up real-time listeners for Firestore changes
    function setupRealtimeListeners() {
        const db = getFirebaseDb();
        if (!db || !userId) return;

        function onError(name) {
            return (error) => console.error('[Sync] Listener error (' + name + '):', error);
        }

        // Health Days listener
        const healthDaysUnsub = db.collection('users').doc(userId)
            .collection(COLLECTIONS.healthDays)
            .onSnapshot((snapshot) => {
                const data = {};
                snapshot.forEach(doc => {
                    data[doc.id] = cleanDoc(doc.data());
                });
                if (safeSetLocal('hl_days', data, 'object')) {
                    console.log('[Sync] Health days updated from Firestore');
                    if (typeof App !== 'undefined' && App.showPage) {
                        App.showPage('home');
                    }
                }
            }, onError('healthDays'));
        unsubscribers.push(healthDaysUnsub);

        // Health Sessions listener
        const healthSessionsUnsub = db.collection('users').doc(userId)
            .collection(COLLECTIONS.healthSessions)
            .onSnapshot((snapshot) => {
                const data = [];
                snapshot.forEach(doc => data.push(cleanDoc(doc.data())));
                safeSetLocal('hl_sessions', data, 'array');
                console.log('[Sync] Health sessions updated from Firestore');
            }, onError('healthSessions'));
        unsubscribers.push(healthSessionsUnsub);

        // Health Templates listener
        const healthTemplatesUnsub = db.collection('users').doc(userId)
            .collection(COLLECTIONS.healthTemplates)
            .onSnapshot((snapshot) => {
                const data = [];
                snapshot.forEach(doc => data.push(cleanDoc(doc.data())));
                safeSetLocal('hl_templates', data, 'array');
                console.log('[Sync] Health templates updated from Firestore');
            }, onError('healthTemplates'));
        unsubscribers.push(healthTemplatesUnsub);

        // Habits listener
        const habitsUnsub = db.collection('users').doc(userId)
            .collection(COLLECTIONS.habits)
            .onSnapshot((snapshot) => {
                const data = [];
                snapshot.forEach(doc => data.push(cleanDoc(doc.data())));
                if (safeSetLocal('ht_habits', data, 'array')) {
                    console.log('[Sync] Habits updated from Firestore');
                    if (typeof HabitsApp !== 'undefined') {
                        HabitsApp.renderCurrentPage();
                    }
                }
            }, onError('habits'));
        unsubscribers.push(habitsUnsub);

        // Habits Completions listener
        const habitsCompletionsUnsub = db.collection('users').doc(userId)
            .collection(COLLECTIONS.habitsCompletions)
            .onSnapshot((snapshot) => {
                const data = {};
                snapshot.forEach(doc => {
                    data[doc.id] = doc.data().completions;
                });
                if (safeSetLocal('ht_completions', data, 'object')) {
                    console.log('[Sync] Habits completions updated from Firestore');
                    if (typeof HabitsApp !== 'undefined') {
                        HabitsApp.renderCurrentPage();
                    }
                }
            }, onError('habitsCompletions'));
        unsubscribers.push(habitsCompletionsUnsub);

        // Journal listener
        const journalUnsub = db.collection('users').doc(userId)
            .collection(COLLECTIONS.journal)
            .onSnapshot((snapshot) => {
                const data5mj = {};
                const dataDR = {};
                snapshot.forEach(doc => {
                    const docData = cleanDoc(doc.data());
                    if (docData.type === '5mj' && docData.date) {
                        data5mj[docData.date] = docData;
                    } else if (docData.type === 'daily_review' && docData.date) {
                        dataDR[docData.date] = docData;
                    }
                });
                safeSetLocal('5mj_entries', data5mj, 'object');
                safeSetLocal('dr_entries', dataDR, 'object');
                console.log('[Sync] Journal updated from Firestore');
            }, onError('journal'));
        unsubscribers.push(journalUnsub);

        // Work Tasks listener
        const workTasksUnsub = db.collection('users').doc(userId)
            .collection(COLLECTIONS.workTasks)
            .onSnapshot((snapshot) => {
                const data = [];
                snapshot.forEach(doc => data.push(cleanDoc(doc.data())));
                safeSetLocal('wk_tasks', data, 'array');
                console.log('[Sync] Work tasks updated from Firestore');
            }, onError('workTasks'));
        unsubscribers.push(workTasksUnsub);

        // Work Clients listener
        const workClientsUnsub = db.collection('users').doc(userId)
            .collection(COLLECTIONS.workClients)
            .onSnapshot((snapshot) => {
                const data = [];
                snapshot.forEach(doc => data.push(cleanDoc(doc.data())));
                safeSetLocal('wk_clients', data, 'array');
                console.log('[Sync] Work clients updated from Firestore');
            }, onError('workClients'));
        unsubscribers.push(workClientsUnsub);

        // Work Projects listener
        const workProjectsUnsub = db.collection('users').doc(userId)
            .collection(COLLECTIONS.workProjects)
            .onSnapshot((snapshot) => {
                const data = [];
                snapshot.forEach(doc => data.push(cleanDoc(doc.data())));
                safeSetLocal('wk_projects', data, 'array');
                console.log('[Sync] Work projects updated from Firestore');
            }, onError('workProjects'));
        unsubscribers.push(workProjectsUnsub);

        // Weekly Review listener
        const weeklyReviewUnsub = db.collection('users').doc(userId)
            .collection(COLLECTIONS.weeklyReview)
            .onSnapshot((snapshot) => {
                const summaries = {};
                snapshot.forEach(doc => {
                    const data = cleanDoc(doc.data());
                    if (doc.id === 'checklist') {
                        localStorage.setItem('wr_checklist', JSON.stringify(data.data || {}));
                    } else if (doc.id === 'last_completed') {
                        localStorage.setItem('wr_last_completed', data.value || '');
                    } else if (doc.id.startsWith('summary_')) {
                        const weekKey = doc.id.replace('summary_', '');
                        summaries[weekKey] = data;
                    }
                });
                if (Object.keys(summaries).length > 0) {
                    const existing = JSON.parse(localStorage.getItem('wr_summaries') || '{}');
                    Object.assign(existing, summaries);
                    localStorage.setItem('wr_summaries', JSON.stringify(existing));
                }
                console.log('[Sync] Weekly review updated from Firestore');
            }, onError('weeklyReview'));
        unsubscribers.push(weeklyReviewUnsub);

        console.log('[Sync] Real-time listeners active');
    }

    // Save a single document to Firestore (called by DB modules)
    function saveDocument(collection, docId, data) {
        if (!isSyncing || !userId) return Promise.resolve();

        const db = getFirebaseDb();
        if (!db) return Promise.resolve();

        return db.collection('users').doc(userId)
            .collection(collection).doc(docId)
            .set({ ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true })
            .then(() => {
                console.log('[Sync] Saved to', collection, docId);
            })
            .catch((error) => {
                console.error('[Sync] Failed to save:', error);
            });
    }

    // Delete a document from Firestore
    function deleteDocument(collection, docId) {
        if (!isSyncing || !userId) return Promise.resolve();

        const db = getFirebaseDb();
        if (!db) return Promise.resolve();

        return db.collection('users').doc(userId)
            .collection(collection).doc(docId)
            .delete()
            .then(() => {
                console.log('[Sync] Deleted from', collection, docId);
            })
            .catch((error) => {
                console.error('[Sync] Failed to delete:', error);
            });
    }

    return {
        startSync,
        stopSync,
        saveDocument,
        deleteDocument,
        COLLECTIONS
    };
})();
