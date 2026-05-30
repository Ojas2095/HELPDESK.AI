/**
 * Unified Date Utility for HELPDESK.AI
 * Fixes timezone shift and Safari parsing issues by normalizing
 * ISO-8601 timestamps before passing to the Date constructor.
 */

/**
 * Normalize a date string for cross-browser (Safari/Firefox/Chrome) compatibility.
 *
 * Safari fails to parse ISO-8601 strings that use a space instead of 'T'
 * between date and time, or strings with trailing 'Z' + space, or certain
 * fractional second formats. This function normalizes to a format that
 * every modern browser understands.
 */
const normalizeDateString = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return dateStr;

    let normalized = dateStr.trim();

    // Replace space separator with 'T' (Safari fails on space-separated ISO)
    // e.g., "2024-01-15 10:30:00" → "2024-01-15T10:30:00"
    if (normalized.includes(' ') && !normalized.includes('T')) {
        normalized = normalized.replace(' ', 'T');
    }

    // Ensure timezone info: if no timezone suffix, assume UTC
    // ISO strings from Supabase often arrive as without TZ
    const hasTZ = /[Z+-]\d{0,2}(:\d{2})?$/.test(normalized);
    if (!hasTZ) {
        normalized += 'Z';
    }

    return normalized;
};

export const formatTimelineDate = (dateStr) => {
    if (!dateStr) return null;

    const normalized = normalizeDateString(dateStr);
    const date = new Date(normalized);

    if (isNaN(date.getTime())) return 'Invalid Date';

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
        .find(part => part.type === 'timeZoneName')?.value || 'IST';
    } catch (_e) {
        return 'IST';
    }
};

export const formatFullTimestamp = (dateStr) => {
    const formatted = formatTimelineDate(dateStr);
    if (!formatted) return 'Processing...';
    return `${formatted} (${getTimeZoneAbbr()})`;
};
