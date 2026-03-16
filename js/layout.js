// ============================================================
// layout.js — Launcher-based navigation controller for RHLOS
// ============================================================

const Layout = (() => {

    let currentApp = null;

    function openApp(appName) {
        currentApp = appName;

        // Hide launcher, show app view container
        document.getElementById('launcher').classList.remove('active');
        document.getElementById('app-container').classList.add('active');

        // Show only the selected panel
        document.querySelectorAll('.app-panel').forEach(p => p.classList.remove('active'));
        document.getElementById('panel-' + appName).classList.add('active');

        // Highlight active nav button
        document.querySelectorAll('.app-nav-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.app === appName);
        });

        // Re-render the app panel if needed
        if (appName === 'habits') HabitsApp.renderCurrentPage();
        if (appName === '5mj') FiveMJ.showPage('home');
        if (appName === 'health') App.showPage('home');
        if (appName === 'work') WorkQuickAdd.render();
        if (appName === 'ov') OVApp.render();

        // Scroll to top
        window.scrollTo(0, 0);
    }

    function goHome() {
        // Stop OV auto-refresh when leaving
        if (currentApp === 'ov' && typeof OVApp !== 'undefined') OVApp.destroy();
        currentApp = null;

        // Hide app view container, show launcher
        document.getElementById('app-container').classList.remove('active');
        document.querySelectorAll('.app-panel').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.app-nav-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('launcher').classList.add('active');

        // Scroll to top
        window.scrollTo(0, 0);
    }

    // Kept for backward compatibility
    function showApp(appName) {
        openApp(appName);
    }

    function init() {
        // Initialize Firebase first
        if (typeof initializeFirebase === 'function') {
            initializeFirebase();
        }

        // Initialize Auth (listens for sign-in state)
        if (typeof Auth !== 'undefined' && Auth.init) {
            Auth.init();
        }

        goHome();
        App.init();
        HabitsApp.init();
        WeeklyReview.autoGenerateIfNeeded(); // Auto-generate week summary on Mondays
        WeeklyReview.render();
        FiveMJ.init();
        WorkQuickAdd.init();
        OVApp.init();
        Homepage.init();

        // Register Service Worker for PWA
        registerServiceWorker();
    }

    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js')
                .then((registration) => {
                    console.log('[PWA] Service Worker registered:', registration.scope);

                    // Check for updates periodically (every 5 minutes)
                    setInterval(() => registration.update(), 5 * 60 * 1000);

                    // Check for updates
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                // New version available — activate it
                                console.log('[PWA] New version available, activating...');
                                newWorker.postMessage({ type: 'SKIP_WAITING' });
                            }
                        });
                    });

                    // Reload page when new SW takes control
                    navigator.serviceWorker.addEventListener('controllerchange', () => {
                        console.log('[PWA] New version active, reloading...');
                        window.location.reload();
                    });
                })
                .catch((error) => {
                    console.log('[PWA] Service Worker registration failed:', error);
                });
        }
    }

    return { init, openApp, goHome, showApp };
})();

document.addEventListener('DOMContentLoaded', Layout.init);
