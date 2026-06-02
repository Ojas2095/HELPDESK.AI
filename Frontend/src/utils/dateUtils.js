/**
 * Unified Date Utility for HELPDESK.AI
 * Fixes timezone shift issues by explicitly forcing local display.
 * Safari-compatible ISO-8601 parsing with manual regex-based fallback.
 */

/**
 * Safely parse an ISO-8601 date string across all browsers including Safari.
 * Safari fails on certain ISO formats (e.g. "2024-01-15T10:30:00" without TZ)
 * that Chrome/Firefox accept — manual parsing ensures cross-browser consistency.
 */
export function parseISOSafely(dateStr) {
    if (!dateStr) return null;

    // 1. Manual ISO-8601 parse (Safari-safe)
    const match = dateStr.match(
        /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/
    );
    if (match) {
        const [, y, m, d, h, min, s, tz] = match;
        const ms = Date.UTC(+y, +m - 1, +d, +h, +min, +s);
        if (tz === 'Z') {
            return new Date(ms);
        }
        if (tz) {
            // Parse offset like "+05:30" or "+0530"
            const offsetStr = tz.replace(':', '');
            const offsetHours = +offsetStr.slice(0, 3);
            const offsetMins = +offsetStr.slice(3) || 0;
            const offsetMs = offsetHours * 3600000 + offsetMins * 60000;
            return new Date(ms - offsetMs); // Convert to UTC
        }
        // No timezone → assume UTC (Supabase convention)
        return new Date(ms);
    }

    // 2. Fallback: try native Date parsing
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;

    // 3. Final fallback: null for unparseable
    return null;
}

export const formatTimelineDate = (dateStr) => {
    const date = parseISOSafely(dateStr);
    if (!date) return null;

    // Using the browser's default locale and timeZone (which is the user's local)
    return date.toLocaleString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
};

export const getTimeZoneAbbr = () => {
    try {
        return (
            new Intl.DateTimeFormat('en-US', {
                timeZoneName: 'short',
            })
                .formatToParts(new Date())
                .find((part) => part.type === 'timeZoneName')?.value || 'IST'
        );
    } catch (_e) {
        return 'IST';
    }
};

export const formatFullTimestamp = (dateStr) => {
    const formatted = formatTimelineDate(dateStr);
    if (!formatted) return 'Processing...';
    return `${formatted} (${getTimeZoneAbbr()})`;
};