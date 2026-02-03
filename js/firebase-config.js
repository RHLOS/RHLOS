// ============================================================
// firebase-config.js — Firebase configuration and initialization
// ============================================================

const FirebaseConfig = {
    apiKey: "AIzaSyDjQCKsIYNOotoE9FPh3Fl5oyiZ4jXcAAg",
    authDomain: "rhlos-19b3f.firebaseapp.com",
    projectId: "rhlos-19b3f",
    storageBucket: "rhlos-19b3f.firebasestorage.app",
    messagingSenderId: "383011184731",
    appId: "1:383011184731:web:c6bd63a8abbf6889545f7e"
};

// Will be initialized after Firebase SDK loads
let firebaseApp = null;
let firebaseAuth = null;
let firebaseDb = null;

function initializeFirebase() {
    if (typeof firebase === 'undefined') {
        console.error('[Firebase] SDK not loaded');
        return false;
    }

    try {
        firebaseApp = firebase.initializeApp(FirebaseConfig);
        firebaseAuth = firebase.auth();
        firebaseDb = firebase.firestore();

        // Enable offline persistence
        firebaseDb.enablePersistence({ synchronizeTabs: true })
            .catch((err) => {
                if (err.code === 'failed-precondition') {
                    console.warn('[Firebase] Persistence failed: multiple tabs open');
                } else if (err.code === 'unimplemented') {
                    console.warn('[Firebase] Persistence not available in this browser');
                }
            });

        console.log('[Firebase] Initialized successfully');
        return true;
    } catch (error) {
        console.error('[Firebase] Initialization failed:', error);
        return false;
    }
}

function getFirebaseAuth() {
    return firebaseAuth;
}

function getFirebaseDb() {
    return firebaseDb;
}
