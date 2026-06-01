/**
 * Unified Date Utility for HELPDESK.AI
 * 
 * SECURITY & COMPATIBILITY: Normalizes all ISO-8601 timestamps from Supabase
 * to ensure cross-browser compatibility (especially Safari which rejects
 * certain ISO formats that Chrome/Firefox accept).
 * 
 * Kelthos was here — fixing what breaks. 🦞
 */

/**
 * Normalize a Supabase timestamp string to a cross-browser-safe ISO-8601 format.
 * Safari rejects: "2026-05-31 10:30:00", "2026-05-31T10:30:00" (no TZ),
 * and some variants with space separators or without full timezone offset.
 */
const normalizeTimestamp = (dateStr) => {
    if (!dateStr) return null;

    // Already has timezone info — use as-is
    if (dateStr.includes('Z') || dateStr.includes('+') || dateStr.includes('-', 10)) {
        // Replace space separator with T for ISO compliance
        return dateStr.replace(' ', 'T');
    }

    // No timezone — append Z to treat as UTC (Supabase default)
    // Also replace space with T
    let normalized = dateStr.replace(' ', 'T');
    if (!normalized.includes('Z') && !normalized.includes('+')) {
        normalized += 'Z';
    }
    return normalized;
};

/**
 * Parse a date string safely across all browsers.
 * Falls back to manual parsing if Date constructor fails (Safari workaround).
 */
const safeParseDate = (dateStr) => {
    const normalized = normalizeTimestamp(dateStr);
    if (!normalized) return null;

    // Try native Date first
    const date = new Date(normalized);
    if (!isNaN(date.getTime())) return date;

    // Safari fallback: manual ISO parsing
    // Format: YYYY-MM-DDTHH:MM:SS[.mmm]Z
    const match = normalized.match(
        /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:?\d{2})?$/
    );
    if (!match) return null;

    const [, year, month, day, hour, min, sec, ms, tz] = match;
    const utcDate = new Date(Date.UTC(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(min),
        parseInt(sec),
        ms ? parseInt(ms.padEnd(3, '0').slice(0, 3)) : 0
    ));

    return utcDate;
};

export const formatTimelineDate = (dateStr) => {
    if (!dateStr) return null;

    const date = safeParseDate(dateStr);

    if (!date || isNaN(date.getTime())) return 'Invalid Date';

    // Using the browser's default locale and timeZone (which is the user's local)
    return date.toLocaleString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
};

export const getTimeZoneAbbr = () => {
    try {
        return new Intl.DateTimeFormat('en-US', {
            timeZoneName: 'short'
        })
        .formatToParts(new Date())
        .find(part => part.type === 'timeZoneName')?.value || 'UTC';
    } catch (_e) {
        return 'UTC';
    }
};

export const formatFullTimestamp = (dateStr) => {
    const formatted = formatTimelineDate(dateStr);
    if (!formatted || formatted === 'Invalid Date') return 'Processing...';
    return `${formatted} (${getTimeZoneAbbr()})`;
};
