/* ===================================================================
   OV Vertrektijden – Real-time departure board
   Bos en Lommerplein, Amsterdam
   Uses OVapi (v0.ovapi.nl) – free, no key required
   =================================================================== */

const OVApp = (() => {

    // ── Config ──────────────────────────────────────────────────────
    const STOPS = ['30003167', '30003061', '30003060'];
    const API_URL = `https://v0.ovapi.nl/tpc/${STOPS.join(',')}/departures`;
    const REFRESH_INTERVAL = 30000; // 30 seconds
    const MAX_DEPARTURES = 3;       // per line+direction

    // Lines we care about
    const LINES = {
        '7':  { type: 'TRAM', icon: '🚊', label: 'Tram 7' },
        '15': { type: 'BUS',  icon: '🚌', label: 'Bus 15' },
        '21': { type: 'BUS',  icon: '🚌', label: 'Bus 21' }
    };

    // Friendly direction names
    const DIRECTIONS = {
        '7_1':  'Mauritskade',
        '7_2':  'Slotermeer',
        '15_1': 'Station Zuid',
        '15_2': 'Station Sloterdijk',
        '21_1': 'Geuzenveld',
        '21_2': 'Centraal Station'
    };

    let _timer = null;
    let _countdownTimer = null;
    let _lastFetch = null;
    let _departures = [];   // processed departures cache

    // ── Public ──────────────────────────────────────────────────────

    function init() {
        // Nothing heavy on app boot; we fetch when opened
    }

    function render() {
        _showLoading();
        _fetchDepartures();
        _startAutoRefresh();
    }

    function destroy() {
        _stopAutoRefresh();
    }

    // ── Fetch & Parse ───────────────────────────────────────────────

    async function _fetchDepartures() {
        const container = document.getElementById('ov-departures');
        if (!container) return;

        try {
            const resp = await fetch(API_URL);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();

            _departures = _parseDepartures(data);
            _lastFetch = new Date();
            _render(container);
        } catch (err) {
            console.warn('[OV] Fetch failed:', err.message);
            _showError(container);
        }
    }

    function _parseDepartures(data) {
        const results = [];

        // data is keyed by TPC code
        for (const tpc of Object.keys(data)) {
            const passes = data[tpc] || {};
            for (const passId of Object.keys(passes)) {
                const p = passes[passId];
                const line = p.LinePublicNumber;
                if (!LINES[line]) continue; // skip lines we don't care about

                const dir = p.LineDirection;
                const key = `${line}_${dir}`;
                const expected = p.ExpectedDepartureTime || p.TargetDepartureTime;
                const target   = p.TargetDepartureTime;

                if (!expected) continue;

                const expectedDate = _parseTime(expected);
                const targetDate   = _parseTime(target);
                if (!expectedDate) continue;

                // Skip if already departed
                if (expectedDate < new Date()) continue;

                const delaySec = targetDate
                    ? Math.round((expectedDate - targetDate) / 1000)
                    : 0;

                results.push({
                    line,
                    direction: dir,
                    key,
                    destination: DIRECTIONS[key] || p.DestinationName50 || '?',
                    expectedDate,
                    targetDate,
                    delaySec,
                    status: p.TripStopStatus || 'PLANNED',
                    lineInfo: LINES[line]
                });
            }
        }

        // Sort by expected time
        results.sort((a, b) => a.expectedDate - b.expectedDate);
        return results;
    }

    function _parseTime(str) {
        if (!str) return null;
        // OVapi returns "2026-02-12T16:29:30" (local time, no timezone)
        const d = new Date(str);
        return isNaN(d.getTime()) ? null : d;
    }

    // ── Render ──────────────────────────────────────────────────────

    function _render(container) {
        if (!_departures.length) {
            container.innerHTML = `
                <div class="ov-empty">
                    <div class="ov-empty-icon">🌙</div>
                    <p>Geen vertrektijden beschikbaar</p>
                </div>`;
            _renderTimestamp();
            return;
        }

        // Group by line, then direction
        const grouped = {};
        for (const dep of _departures) {
            if (!grouped[dep.line]) grouped[dep.line] = {};
            if (!grouped[dep.line][dep.direction]) grouped[dep.line][dep.direction] = [];
            if (grouped[dep.line][dep.direction].length < MAX_DEPARTURES) {
                grouped[dep.line][dep.direction].push(dep);
            }
        }

        // Render order: 7, 15, 21
        const lineOrder = ['7', '15', '21'];
        let html = '';

        for (const line of lineOrder) {
            const dirs = grouped[line];
            if (!dirs) continue;

            const info = LINES[line];
            html += `<div class="ov-line-group">`;
            html += `<div class="ov-line-header">
                        <span class="ov-line-icon">${info.icon}</span>
                        <span class="ov-line-name">${info.label}</span>
                     </div>`;

            // Sort directions: 1 then 2
            const dirKeys = Object.keys(dirs).sort();
            for (const dir of dirKeys) {
                const deps = dirs[dir];
                if (!deps.length) continue;

                html += `<div class="ov-direction">`;
                html += `<div class="ov-direction-label">→ ${deps[0].destination}</div>`;
                html += `<div class="ov-times">`;

                for (const dep of deps) {
                    const mins = _minutesUntil(dep.expectedDate);
                    const timeStr = _formatTime(dep.expectedDate);
                    const statusClass = _getStatusClass(dep.delaySec);
                    const statusLabel = _getStatusLabel(dep.delaySec);
                    const minsDisplay = mins <= 0 ? 'Nu' : `${mins} min`;

                    html += `<div class="ov-departure ${statusClass}">
                                <span class="ov-dep-countdown">${minsDisplay}</span>
                                <span class="ov-dep-time">${timeStr}</span>
                                ${statusLabel ? `<span class="ov-dep-status">${statusLabel}</span>` : ''}
                             </div>`;
                }

                html += `</div></div>`; // .ov-times, .ov-direction
            }

            html += `</div>`; // .ov-line-group
        }

        container.innerHTML = html;
        _renderTimestamp();
    }

    function _renderTimestamp() {
        const el = document.getElementById('ov-timestamp');
        if (!el || !_lastFetch) return;
        el.textContent = `Bijgewerkt: ${_formatTime(_lastFetch)}`;
    }

    function _showLoading() {
        const container = document.getElementById('ov-departures');
        if (!container) return;
        container.innerHTML = `
            <div class="ov-loading">
                <div class="ov-loading-spinner"></div>
                <p>Vertrektijden ophalen…</p>
            </div>`;
    }

    function _showError(container) {
        container.innerHTML = `
            <div class="ov-error">
                <div class="ov-error-icon">⚠️</div>
                <p>Kan vertrektijden niet ophalen</p>
                <button class="ov-retry-btn" onclick="OVApp.retry()">Opnieuw proberen</button>
            </div>`;
        _renderTimestamp();
    }

    // ── Helpers ─────────────────────────────────────────────────────

    function _minutesUntil(date) {
        return Math.round((date - new Date()) / 60000);
    }

    function _formatTime(date) {
        return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    function _getStatusClass(delaySec) {
        if (delaySec <= -30) return 'ov-early';     // >30s early
        if (delaySec <= 120) return 'ov-on-time';    // on time or <2min late
        return 'ov-delayed';                          // >2min late
    }

    function _getStatusLabel(delaySec) {
        if (delaySec <= -30) {
            const mins = Math.abs(Math.round(delaySec / 60));
            return mins > 0 ? `${mins} min vroeg` : '';
        }
        if (delaySec > 120) {
            const mins = Math.round(delaySec / 60);
            return `+${mins} min`;
        }
        return ''; // on time, no label
    }

    // ── Auto-refresh ────────────────────────────────────────────────

    function _startAutoRefresh() {
        _stopAutoRefresh();
        _timer = setInterval(() => {
            _fetchDepartures();
        }, REFRESH_INTERVAL);

        // Update countdown every 10 seconds (re-render with fresh minute calcs)
        _countdownTimer = setInterval(() => {
            const container = document.getElementById('ov-departures');
            if (container && _departures.length) {
                _render(container);
            }
        }, 10000);
    }

    function _stopAutoRefresh() {
        if (_timer) { clearInterval(_timer); _timer = null; }
        if (_countdownTimer) { clearInterval(_countdownTimer); _countdownTimer = null; }
    }

    function retry() {
        _showLoading();
        _fetchDepartures();
    }

    // ── Public API ──────────────────────────────────────────────────

    return { init, render, destroy, retry };

})();
