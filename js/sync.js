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

        // Check if this is the first sync (migration) or a returning user
        migrateIfNeeded()
            .then(() => {
                // Start listening for changes from Firestore
                setupRealtimeListeners();
                updateSyncStatus('synced');
            })
            .catch((error) => {
                console.error('[Sync] Initial sync failed:', error);
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

        const batch = db.batch();
        let operations = 0;

        // Health Days
        const healthDays = JSON.parse(localStorage.getItem('hl_days') || '{}');
        for (const [dateKey, dayData] of Object.entries(healthDays)) {
            const docRef = db.collection('users').doc(userId)
                .collection(COLLECTIONS.healthDays).doc(dateKey);
            batch.set(docRef, { ...dayData, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
            operations++;
        }

        // Health Sessions
        const healthSessions = JSON.parse(localStorage.getItem('hl_sessions') || '[]');
        for (const session of healthSessions) {
            const docRef = db.collection('users').doc(userId)
                .collection(COLLECTIONS.healthSessions).doc(session.id);
            batch.set(docRef, { ...session, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
            operations++;
        }

        // Health Templates
        const healthTemplates = JSON.parse(localStorage.getItem('hl_templates') || '[]');
        for (const template of healthTemplates) {
            const docRef = db.collection('users').doc(userId)
                .collection(COLLECTIONS.healthTemplates).doc(template.id);
            batch.set(docRef, { ...template, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
            operations++;
        }

        // Habits
        const habits = JSON.parse(localStorage.getItem('ht_habits') || '[]');
        for (const habit of habits) {
            const docRef = db.collection('users').doc(userId)
                .collection(COLLECTIONS.habits).doc(habit.id);
            batch.set(docRef, { ...habit, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
            operations++;
        }

        // Habits Completions
        const habitsCompletions = JSON.parse(localStorage.getItem('ht_completions') || '{}');
        for (const [dateKey, completions] of Object.entries(habitsCompletions)) {
            const docRef = db.collection('users').doc(userId)
                .collection(COLLECTIONS.habitsCompletions).doc(dateKey);
            batch.set(docRef, { completions, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
            operations++;
        }

        // Journal - 5MJ entries
        const journal5MJ = JSON.parse(localStorage.getItem('5mj_entries') || '{}');
        for (const [dateKey, entry] of Object.entries(journal5MJ)) {
            const docRef = db.collection('users').doc(userId)
                .collection(COLLECTIONS.journal).doc('5mj_' + dateKey);
            batch.set(docRef, { type: '5mj', date: dateKey, ...entry, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
            operations++;
        }

        // Journal - Daily Review entries
        const journalDR = JSON.parse(localStorage.getItem('dr_entries') || '{}');
        for (const [dateKey, entry] of Object.entries(journalDR)) {
            const docRef = db.collection('users').doc(userId)
                .collection(COLLECTIONS.journal).doc('dr_' + dateKey);
            batch.set(docRef, { type: 'daily_review', date: dateKey, ...entry, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
            operations++;
        }

        // Work Tasks
        const workTasks = JSON.parse(localStorage.getItem('wk_tasks') || '[]');
        for (const task of workTasks) {
            const docRef = db.collection('users').doc(userId)
                .collection(COLLECTIONS.workTasks).doc(task.id);
            batch.set(docRef, { ...task, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
            operations++;
        }

        // Work Clients
        const workClients = JSON.parse(localStorage.getItem('wk_clients') || '[]');
        for (const client of workClients) {
            const docRef = db.collection('users').doc(userId)
                .collection(COLLECTIONS.workClients).doc(client.id);
            batch.set(docRef, { ...client, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
            operations++;
        }

        // Work Projects
        const workProjects = JSON.parse(localStorage.getItem('wk_projects') || '[]');
        for (const project of workProjects) {
            const docRef = db.collection('users').doc(userId)
                .collection(COLLECTIONS.workProjects).doc(project.id);
            batch.set(docRef, { ...project, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
            operations++;
        }

        // Weekly Review — checklist, last completed, summaries
        const wrChecklist = localStorage.getItem('wr_checklist');
        if (wrChecklist) {
            const docRef = db.collection('users').doc(userId)
                .collection(COLLECTIONS.weeklyReview).doc('checklist');
            batch.set(docRef, { data: JSON.parse(wrChecklist), updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
            operations++;
        }
        const wrLastCompleted = localStorage.getItem('wr_last_completed');
        if (wrLastCompleted) {
            const docRef = db.collection('users').doc(userId)
                .collection(COLLECTIONS.weeklyReview).doc('last_completed');
            batch.set(docRef, { value: wrLastCompleted, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
            operations++;
        }
        const wrSummaries = JSON.parse(localStorage.getItem('wr_summaries') || '{}');
        for (const [weekKey, summary] of Object.entries(wrSummaries)) {
            const docRef = db.collection('users').doc(userId)
                .collection(COLLECTIONS.weeklyReview).doc('summary_' + weekKey);
            batch.set(docRef, { ...summary, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
            operations++;
        }

        if (operations > 0) {
            await batch.commit();
            console.log('[Sync] Uploaded', operations, 'items to Firestore');
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

    // Set up real-time listeners for Firestore changes
    function setupRealtimeListeners() {
        const db = getFirebaseDb();
        if (!db || !userId) return;

        // Health Days listener
        const healthDaysUnsub = db.collection('users').doc(userId)
            .collection(COLLECTIONS.healthDays)
            .onSnapshot((snapshot) => {
                const data = {};
                snapshot.forEach(doc => {
                    data[doc.id] = cleanDoc(doc.data());
                });
                localStorage.setItem('hl_days', JSON.stringify(data));
                console.log('[Sync] Health days updated from Firestore');
                if (typeof App !== 'undefined' && App.showPage) {
                    App.showPage('home');
                }
            });
        unsubscribers.push(healthDaysUnsub);

        // Health Sessions listener
        const healthSessionsUnsub = db.collection('users').doc(userId)
            .collection(COLLECTIONS.healthSessions)
            .onSnapshot((snapshot) => {
                const data = [];
                snapshot.forEach(doc => data.push(cleanDoc(doc.data())));
                localStorage.setItem('hl_sessions', JSON.stringify(data));
                console.log('[Sync] Health sessions updated from Firestore');
            });
        unsubscribers.push(healthSessionsUnsub);

        // Health Templates listener
        const healthTemplatesUnsub = db.collection('users').doc(userId)
            .collection(COLLECTIONS.healthTemplates)
            .onSnapshot((snapshot) => {
                const data = [];
                snapshot.forEach(doc => data.push(cleanDoc(doc.data())));
                localStorage.setItem('hl_templates', JSON.stringify(data));
                console.log('[Sync] Health templates updated from Firestore');
            });
        unsubscribers.push(healthTemplatesUnsub);

        // Habits listener
        const habitsUnsub = db.collection('users').doc(userId)
            .collection(COLLECTIONS.habits)
            .onSnapshot((snapshot) => {
                const data = [];
                snapshot.forEach(doc => data.push(cleanDoc(doc.data())));
                localStorage.setItem('ht_habits', JSON.stringify(data));
                console.log('[Sync] Habits updated from Firestore');
                if (typeof HabitsApp !== 'undefined') {
                    HabitsApp.renderCurrentPage();
                }
            });
        unsubscribers.push(habitsUnsub);

        // Habits Completions listener
        const habitsCompletionsUnsub = db.collection('users').doc(userId)
            .collection(COLLECTIONS.habitsCompletions)
            .onSnapshot((snapshot) => {
                const data = {};
                snapshot.forEach(doc => {
                    data[doc.id] = doc.data().completions;
                });
                localStorage.setItem('ht_completions', JSON.stringify(data));
                console.log('[Sync] Habits completions updated from Firestore');
                if (typeof HabitsApp !== 'undefined') {
                    HabitsApp.renderCurrentPage();
                }
            });
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
                localStorage.setItem('5mj_entries', JSON.stringify(data5mj));
                localStorage.setItem('dr_entries', JSON.stringify(dataDR));
                console.log('[Sync] Journal updated from Firestore');
            });
        unsubscribers.push(journalUnsub);

        // Work Tasks listener
        const workTasksUnsub = db.collection('users').doc(userId)
            .collection(COLLECTIONS.workTasks)
            .onSnapshot((snapshot) => {
                const data = [];
                snapshot.forEach(doc => data.push(cleanDoc(doc.data())));
                localStorage.setItem('wk_tasks', JSON.stringify(data));
                console.log('[Sync] Work tasks updated from Firestore');
            });
        unsubscribers.push(workTasksUnsub);

        // Work Clients listener
        const workClientsUnsub = db.collection('users').doc(userId)
            .collection(COLLECTIONS.workClients)
            .onSnapshot((snapshot) => {
                const data = [];
                snapshot.forEach(doc => data.push(cleanDoc(doc.data())));
                localStorage.setItem('wk_clients', JSON.stringify(data));
                console.log('[Sync] Work clients updated from Firestore');
            });
        unsubscribers.push(workClientsUnsub);

        // Work Projects listener
        const workProjectsUnsub = db.collection('users').doc(userId)
            .collection(COLLECTIONS.workProjects)
            .onSnapshot((snapshot) => {
                const data = [];
                snapshot.forEach(doc => data.push(cleanDoc(doc.data())));
                localStorage.setItem('wk_projects', JSON.stringify(data));
                console.log('[Sync] Work projects updated from Firestore');
            });
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
                    // Merge with existing summaries (don't overwrite if Firestore has fewer)
                    const existing = JSON.parse(localStorage.getItem('wr_summaries') || '{}');
                    Object.assign(existing, summaries);
                    localStorage.setItem('wr_summaries', JSON.stringify(existing));
                }
                console.log('[Sync] Weekly review updated from Firestore');
            });
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
