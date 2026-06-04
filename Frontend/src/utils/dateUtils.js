/**
 * Unified Date Utility for HELPDESK.AI
 * Fixes timezone shift issues by explicitly forcing local display.
 */

export const formatTimelineDate = (dateStr) => {
    if (!dateStr) return null;
    
    // Ensure the date string is interpreted as UTC if it's an ISO string from DB
    let date;
    if (typeof dateStr === 'string') {
        // Safari compatibility: replace hyphens with slashes for YYYY-MM-DD format
        const normalized = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr.replace(/-/g, '/') : dateStr;
        
        if (!normalized.includes('Z') && !normalized.includes('+')) {
            // Assume UTC if no timezone is provided
            date = new Date(normalized + (normalized.includes('/') ? ' UTC' : 'Z'));
        } else {
            date = new Date(normalized);
        }
    } else {
        date = new Date(dateStr);
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
