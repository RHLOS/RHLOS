// ============================================================
// auth.js — Firebase Authentication handler
// ============================================================

const Auth = (() => {
    let currentUser = null;
    let authStateListeners = [];

    function init() {
        const auth = getFirebaseAuth();
        if (!auth) {
            console.error('[Auth] Firebase Auth not available');
            return;
        }

        // Listen for auth state changes
        auth.onAuthStateChanged((user) => {
            currentUser = user;
            updateUI(user);
            notifyListeners(user);

            if (user) {
                console.log('[Auth] User signed in:', user.email);
                // Start syncing data
                Sync.startSync(user.uid);
            } else {
                console.log('[Auth] User signed out');
                Sync.stopSync();
            }
        });
    }

    function signInWithGoogle() {
        const auth = getFirebaseAuth();
        if (!auth) return Promise.reject('Auth not available');

        const provider = new firebase.auth.GoogleAuthProvider();

        // Use redirect on mobile, popup on desktop
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        if (isMobile) {
            return auth.signInWithRedirect(provider);
        } else {
            return auth.signInWithPopup(provider)
                .catch((error) => {
                    console.error('[Auth] Sign in failed:', error);
                    alert('Inloggen mislukt: ' + error.message);
                });
        }
    }

    function signOut() {
        const auth = getFirebaseAuth();
        if (!auth) return Promise.reject('Auth not available');

        return auth.signOut()
            .then(() => {
                console.log('[Auth] Signed out successfully');
            })
            .catch((error) => {
                console.error('[Auth] Sign out failed:', error);
            });
    }

    function getUser() {
        return currentUser;
    }

    function isSignedIn() {
        return currentUser !== null;
    }

    function onAuthStateChanged(callback) {
        authStateListeners.push(callback);
        // Immediately call with current state
        if (currentUser !== undefined) {
            callback(currentUser);
        }
    }

    function notifyListeners(user) {
        authStateListeners.forEach(callback => callback(user));
    }

    function updateUI(user) {
        const loginBtn = document.getElementById('login-btn');
        const logoutBtn = document.getElementById('logout-btn');
        const userInfo = document.getElementById('user-info');
        const userAvatar = document.getElementById('user-avatar');
        const userName = document.getElementById('user-name');
        const syncStatus = document.getElementById('sync-status');

        if (user) {
            // User is signed in
            if (loginBtn) loginBtn.classList.add('hidden');
            if (logoutBtn) logoutBtn.classList.remove('hidden');
            if (userInfo) userInfo.classList.remove('hidden');
            if (userAvatar) userAvatar.src = user.photoURL || '';
            if (userName) userName.textContent = user.displayName || user.email;
            if (syncStatus) syncStatus.classList.remove('hidden');
        } else {
            // User is signed out
            if (loginBtn) loginBtn.classList.remove('hidden');
            if (logoutBtn) logoutBtn.classList.add('hidden');
            if (userInfo) userInfo.classList.add('hidden');
            if (syncStatus) syncStatus.classList.add('hidden');
        }
    }

    return {
        init,
        signInWithGoogle,
        signOut,
        getUser,
        isSignedIn,
        onAuthStateChanged
    };
})();
