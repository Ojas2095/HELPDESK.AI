/**
 * Unified Date Utility for HELPDESK.AI
 * Fixes timezone shift issues by explicitly forcing local display.
 * Safari-safe: normalizes ISO-8601 strings before parsing.
 */

/**
 * Normalize a date string so Safari (and all browsers) can parse it.
 * Safari rejects "YYYY-MM-DD HH:MM:SS" but accepts "YYYY-MM-DDTHH:MM:SSZ".
 */
function normalizeDateString(dateStr) {
    if (typeof dateStr !== 'string') return dateStr;
    // Replace a space between date and time with 'T' (Safari fix)
    let normalized = dateStr.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/, '$1T$2');
    // If no timezone info, assume UTC
    if (!normalized.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(normalized) && normalized.includes('T')) {
        normalized += 'Z';
    }
    return normalized;
}

export const formatTimelineDate = (dateStr) => {
    if (!dateStr) return null;
    
    let date;
    try {
        if (typeof dateStr === 'string') {
            const normalized = normalizeDateString(dateStr);
            date = new Date(normalized);
        } else {
            date = new Date(dateStr);
        }
    } catch (_e) {
        return 'Invalid Date';
    }

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
