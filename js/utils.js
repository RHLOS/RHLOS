// ============================================================
// utils.js — Shared utility functions
// ============================================================

const Utils = (() => {

    /**
     * Format a Date object (or date-string) as 'YYYY-MM-DD'.
     * If a string is passed, it is returned as-is.
     */
    function dateKey(date) {
        if (typeof date === 'string') return date;
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    /**
     * Generate an array of 'YYYY-MM-DD' strings from startStr to endStr (inclusive).
     * Both parameters should be 'YYYY-MM-DD' strings.
     */
    function dateRange(startStr, endStr) {
        const dates = [];
        const current = new Date(startStr + 'T00:00:00');
        const end = new Date(endStr + 'T00:00:00');
        while (current <= end) {
            dates.push(dateKey(current));
            current.setDate(current.getDate() + 1);
        }
        return dates;
    }

    return { dateKey, dateRange };
})();
