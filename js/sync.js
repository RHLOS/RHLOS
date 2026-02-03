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
        workTasks: 'work_tasks'
    };

    function startSync(uid) {
        if (isSyncing) return;

        userId = uid;
        isSyncing = true;
        console.log('[Sync] Starting sync for user:', uid);

        updateSyncStatus('syncing');

        // Upload local data first (one-time migration)
        uploadLocalData()
            .then(() => {
                // Then start listening for changes
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

    // Upload all local data to Firestore (migration)
    async function uploadLocalData() {
        const db = getFirebaseDb();
        if (!db || !userId) return;

        console.log('[Sync] Uploading local data...');

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
        const habits = JSON.parse(localStorage.getItem('habits_list') || '[]');
        for (const habit of habits) {
            const docRef = db.collection('users').doc(userId)
                .collection(COLLECTIONS.habits).doc(habit.id);
            batch.set(docRef, { ...habit, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
            operations++;
        }

        // Habits Completions
        const habitsCompletions = JSON.parse(localStorage.getItem('habits_completions') || '{}');
        for (const [dateKey, completions] of Object.entries(habitsCompletions)) {
            const docRef = db.collection('users').doc(userId)
                .collection(COLLECTIONS.habitsCompletions).doc(dateKey);
            batch.set(docRef, { completions, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
            operations++;
        }

        // Journal (5MJ + Daily Review)
        const journal = JSON.parse(localStorage.getItem('5mj_data') || '{}');
        for (const [dateKey, entry] of Object.entries(journal)) {
            const docRef = db.collection('users').doc(userId)
                .collection(COLLECTIONS.journal).doc(dateKey);
            batch.set(docRef, { ...entry, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
            operations++;
        }

        // Work Tasks
        const workTasks = JSON.parse(localStorage.getItem('work_tasks') || '[]');
        for (const task of workTasks) {
            const docRef = db.collection('users').doc(userId)
                .collection(COLLECTIONS.workTasks).doc(task.id);
            batch.set(docRef, { ...task, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
            operations++;
        }

        if (operations > 0) {
            await batch.commit();
            console.log('[Sync] Uploaded', operations, 'items to Firestore');
        } else {
            console.log('[Sync] No local data to upload');
        }
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
                    data[doc.id] = doc.data();
                });
                localStorage.setItem('hl_days', JSON.stringify(data));
                console.log('[Sync] Health days updated');
                // Trigger UI refresh if needed
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
                snapshot.forEach(doc => data.push(doc.data()));
                localStorage.setItem('hl_sessions', JSON.stringify(data));
                console.log('[Sync] Health sessions updated');
            });
        unsubscribers.push(healthSessionsUnsub);

        // Health Templates listener
        const healthTemplatesUnsub = db.collection('users').doc(userId)
            .collection(COLLECTIONS.healthTemplates)
            .onSnapshot((snapshot) => {
                const data = [];
                snapshot.forEach(doc => data.push(doc.data()));
                localStorage.setItem('hl_templates', JSON.stringify(data));
                console.log('[Sync] Health templates updated');
            });
        unsubscribers.push(healthTemplatesUnsub);

        // Habits listener
        const habitsUnsub = db.collection('users').doc(userId)
            .collection(COLLECTIONS.habits)
            .onSnapshot((snapshot) => {
                const data = [];
                snapshot.forEach(doc => data.push(doc.data()));
                localStorage.setItem('habits_list', JSON.stringify(data));
                console.log('[Sync] Habits updated');
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
                localStorage.setItem('habits_completions', JSON.stringify(data));
                console.log('[Sync] Habits completions updated');
                if (typeof HabitsApp !== 'undefined') {
                    HabitsApp.renderCurrentPage();
                }
            });
        unsubscribers.push(habitsCompletionsUnsub);

        // Journal listener
        const journalUnsub = db.collection('users').doc(userId)
            .collection(COLLECTIONS.journal)
            .onSnapshot((snapshot) => {
                const data = {};
                snapshot.forEach(doc => {
                    data[doc.id] = doc.data();
                });
                localStorage.setItem('5mj_data', JSON.stringify(data));
                console.log('[Sync] Journal updated');
            });
        unsubscribers.push(journalUnsub);

        // Work Tasks listener
        const workTasksUnsub = db.collection('users').doc(userId)
            .collection(COLLECTIONS.workTasks)
            .onSnapshot((snapshot) => {
                const data = [];
                snapshot.forEach(doc => data.push(doc.data()));
                localStorage.setItem('work_tasks', JSON.stringify(data));
                console.log('[Sync] Work tasks updated');
            });
        unsubscribers.push(workTasksUnsub);

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
