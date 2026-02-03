// ============================================================
// homepage.js — Homepage widgets: greeting, flip clock, weather
// ============================================================

const Homepage = (() => {

    // ---- Greeting ----

    function updateGreeting() {
        const hour = new Date().getHours();
        let greeting, theme;
        if (hour < 6)       { greeting = 'Goedenacht';    theme = 'night'; }
        else if (hour < 12) { greeting = 'Goedemorgen';   theme = 'morning'; }
        else if (hour < 18) { greeting = 'Goedemiddag';   theme = 'afternoon'; }
        else                { greeting = 'Goedenavond';   theme = 'evening'; }

        const el = document.getElementById('greeting-text');
        if (el) el.textContent = greeting;

        // Date line
        const dateEl = document.getElementById('greeting-date');
        if (dateEl) {
            const now = new Date();
            dateEl.textContent = now.toLocaleDateString('nl-NL', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
        }

        // Dynamic background theme
        updateBackground(theme);
    }

    function updateBackground(theme) {
        // Apply theme to body so it cascades to ALL layers (header, app views, tab bars)
        document.body.classList.remove('theme-night', 'theme-morning', 'theme-afternoon', 'theme-evening');
        document.body.classList.add('theme-' + theme);
    }

    // ---- Flip Clock ----

    let prevTime = { h1: '', h2: '', m1: '', m2: '', s1: '', s2: '' };

    function updateClock() {
        const now = new Date();
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        const s = String(now.getSeconds()).padStart(2, '0');

        const curr = { h1: h[0], h2: h[1], m1: m[0], m2: m[1], s1: s[0], s2: s[1] };

        Object.keys(curr).forEach(key => {
            if (curr[key] !== prevTime[key]) {
                const el = document.getElementById('flip-' + key);
                if (el) {
                    el.querySelector('span').textContent = curr[key];
                    el.classList.remove('flip-animate');
                    // Force reflow to restart animation
                    void el.offsetWidth;
                    el.classList.add('flip-animate');
                }
            }
        });

        prevTime = curr;
    }

    // ---- Weather ----

    const WEATHER_CACHE_KEY = 'weather_cache';
    const WEATHER_CACHE_TTL = 30 * 60 * 1000; // 30 minutes in ms

    function getCachedWeather() {
        try {
            const raw = localStorage.getItem(WEATHER_CACHE_KEY);
            if (!raw) return null;
            const cached = JSON.parse(raw);
            if (Date.now() - cached.timestamp > WEATHER_CACHE_TTL) return null;
            return cached;
        } catch { return null; }
    }

    function setCachedWeather(data, lat, lon, locationName) {
        const cache = {
            timestamp: Date.now(),
            data,
            lat,
            lon,
            locationName: locationName || ''
        };
        localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(cache));
    }

    const WMO_CODES = {
        0:  { desc: 'Onbewolkt',             icon: '\u2600\uFE0F' },
        1:  { desc: 'Overwegend helder',      icon: '\uD83C\uDF24\uFE0F' },
        2:  { desc: 'Gedeeltelijk bewolkt',   icon: '\u26C5' },
        3:  { desc: 'Bewolkt',                icon: '\u2601\uFE0F' },
        45: { desc: 'Mistig',                 icon: '\uD83C\uDF2B\uFE0F' },
        48: { desc: 'Rijpmist',               icon: '\uD83C\uDF2B\uFE0F' },
        51: { desc: 'Lichte motregen',        icon: '\uD83C\uDF26\uFE0F' },
        53: { desc: 'Motregen',               icon: '\uD83C\uDF26\uFE0F' },
        55: { desc: 'Zware motregen',         icon: '\uD83C\uDF27\uFE0F' },
        56: { desc: 'IJzige motregen',        icon: '\uD83C\uDF27\uFE0F' },
        57: { desc: 'Zware ijzige motregen',  icon: '\uD83C\uDF27\uFE0F' },
        61: { desc: 'Lichte regen',           icon: '\uD83C\uDF26\uFE0F' },
        63: { desc: 'Regen',                  icon: '\uD83C\uDF27\uFE0F' },
        65: { desc: 'Zware regen',            icon: '\uD83C\uDF27\uFE0F' },
        66: { desc: 'IJzige regen',           icon: '\uD83C\uDF27\uFE0F' },
        67: { desc: 'Zware ijzige regen',     icon: '\uD83C\uDF27\uFE0F' },
        71: { desc: 'Lichte sneeuw',          icon: '\uD83C\uDF28\uFE0F' },
        73: { desc: 'Sneeuw',                 icon: '\uD83C\uDF28\uFE0F' },
        75: { desc: 'Zware sneeuw',           icon: '\uD83C\uDF28\uFE0F' },
        77: { desc: 'Sneeuwkorrels',          icon: '\uD83C\uDF28\uFE0F' },
        80: { desc: 'Lichte buien',           icon: '\uD83C\uDF26\uFE0F' },
        81: { desc: 'Buien',                  icon: '\uD83C\uDF27\uFE0F' },
        82: { desc: 'Zware buien',            icon: '\uD83C\uDF27\uFE0F' },
        85: { desc: 'Lichte sneeuwbuien',     icon: '\uD83C\uDF28\uFE0F' },
        86: { desc: 'Zware sneeuwbuien',      icon: '\uD83C\uDF28\uFE0F' },
        95: { desc: 'Onweer',                 icon: '\u26C8\uFE0F' },
        96: { desc: 'Onweer met hagel',       icon: '\u26C8\uFE0F' },
        99: { desc: 'Zwaar onweer met hagel', icon: '\u26C8\uFE0F' }
    };

    function fetchWeather() {
        // Check cache first (30-min TTL)
        const cached = getCachedWeather();
        if (cached) {
            renderWeather(cached.data, cached.lat, cached.lon, cached.locationName);
            return;
        }

        if (!navigator.geolocation) {
            showWeatherError('Locatie niet beschikbaar');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            pos => {
                const lat = pos.coords.latitude.toFixed(4);
                const lon = pos.coords.longitude.toFixed(4);
                const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat +
                    '&longitude=' + lon +
                    '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m' +
                    '&timezone=auto';

                fetch(url)
                    .then(r => r.json())
                    .then(data => {
                        renderWeather(data, lat, lon);
                        // Fetch location name and cache everything
                        fetchLocationName(lat, lon, data);
                    })
                    .catch(() => showWeatherError('Weer ophalen mislukt'));
            },
            () => showWeatherError('Locatietoegang geweigerd'),
            { timeout: 10000 }
        );
    }

    function renderWeather(data, lat, lon, cachedLocationName) {
        const c = data.current;
        const wmo = WMO_CODES[c.weather_code] || { desc: 'Onbekend', icon: '\uD83C\uDF24\uFE0F' };

        document.getElementById('weather-icon').textContent = wmo.icon;
        document.getElementById('weather-temp').textContent = Math.round(c.temperature_2m) + '\u00B0';
        document.getElementById('weather-desc').textContent = wmo.desc;
        document.getElementById('weather-feel').textContent = 'Voelt als ' + Math.round(c.apparent_temperature) + '\u00B0';
        document.getElementById('weather-wind').textContent = 'Wind ' + Math.round(c.wind_speed_10m) + ' km/u';

        // Use cached location name if available
        if (cachedLocationName) {
            document.getElementById('weather-location').textContent = cachedLocationName;
        }

        document.getElementById('weather-loading').classList.add('hidden');
        document.getElementById('weather-content').classList.remove('hidden');
    }

    function fetchLocationName(lat, lon, weatherData) {
        const url = 'https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lon + '&zoom=10&accept-language=nl';
        fetch(url, { headers: { 'User-Agent': 'RHLOS-App/1.0' } })
            .then(r => r.json())
            .then(data => {
                const addr = data.address || {};
                const city = addr.city || addr.town || addr.village || addr.municipality || '';
                if (city) {
                    document.getElementById('weather-location').textContent = city;
                }
                // Cache weather + location name together
                setCachedWeather(weatherData, lat, lon, city);
            })
            .catch(() => {
                // Cache weather without location name
                setCachedWeather(weatherData, lat, lon, '');
            });
    }

    function showWeatherError(msg) {
        document.getElementById('weather-loading').classList.add('hidden');
        document.getElementById('weather-error').classList.remove('hidden');
        document.getElementById('weather-error-msg').textContent = msg;
    }

    // ---- Quote of the Day ----

    const QUOTE_CACHE_KEY = 'quote_cache';

    const FALLBACK_QUOTES = [
        { quote: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
        { quote: 'In the middle of difficulty lies opportunity.', author: 'Albert Einstein' },
        { quote: 'It does not matter how slowly you go as long as you do not stop.', author: 'Confucius' },
        { quote: 'What you get by achieving your goals is not as important as what you become by achieving your goals.', author: 'Zig Ziglar' },
        { quote: 'The best time to plant a tree was 20 years ago. The second best time is now.', author: 'Chinese Proverb' }
    ];

    function getCachedQuote() {
        try {
            const raw = localStorage.getItem(QUOTE_CACHE_KEY);
            if (!raw) return null;
            const cached = JSON.parse(raw);
            // Cache is valid for the current day
            const today = new Date().toDateString();
            if (cached.date !== today) return null;
            return cached;
        } catch { return null; }
    }

    function setCachedQuote(quote, author) {
        const cache = {
            date: new Date().toDateString(),
            quote,
            author
        };
        localStorage.setItem(QUOTE_CACHE_KEY, JSON.stringify(cache));
    }

    function renderQuote(text, author) {
        const el = document.getElementById('quote-text');
        if (el) {
            el.textContent = '"' + text + '"' + (author ? ' — ' + author : '');
        }
    }

    function getRandomFallback() {
        return FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)];
    }

    function fetchQuote() {
        // Check cache first (1 quote per day)
        const cached = getCachedQuote();
        if (cached) {
            renderQuote(cached.quote, cached.author);
            return;
        }

        fetchNewQuote();
    }

    function fetchNewQuote() {
        fetch('https://dummyjson.com/quotes/random')
            .then(r => r.json())
            .then(data => {
                if (data && data.quote) {
                    renderQuote(data.quote, data.author);
                    setCachedQuote(data.quote, data.author);
                } else {
                    const fb = getRandomFallback();
                    renderQuote(fb.quote, fb.author);
                }
            })
            .catch(() => {
                const fb = getRandomFallback();
                renderQuote(fb.quote, fb.author);
            });
    }

    function refreshQuote() {
        fetchNewQuote();
    }

    // ---- Init ----

    function init() {
        updateGreeting();
        updateClock();

        // Update clock every second
        setInterval(updateClock, 1000);

        // Update greeting every minute (in case time-of-day changes)
        setInterval(updateGreeting, 60000);

        // Fetch weather
        fetchWeather();

        // Fetch quote of the day
        fetchQuote();
    }

    return { init, refreshQuote };
})();
