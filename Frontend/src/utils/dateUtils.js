/**
 * Unified Date Utility for HELPDESK.AI
 * Fixes timezone shift issues by explicitly forcing local display.
 * Now also fixes Safari date parsing by normalizing ISO-8601 separators.
 */

export const formatTimelineDate = (dateStr) => {
    if (!dateStr) return null;
    
    let date;
    if (typeof dateStr === 'string') {
        // Normalize: Replace ' ' with 'T' for Safari compatibility (Safari cannot parse '2024-01-15 14:30:00')
        const normalized = dateStr.replace(' ', 'T');
        
        if (!normalized.includes('Z') && !normalized.includes('+')) {
            // If it's a raw string without TZ, assume it was intended as UTC from our backend
            date = new Date(normalized + 'Z');
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
        .find(part => part.type === 'timeZoneName')?.value || 'UTC';
    } catch (_e) {
        return 'UTC';
    }
};

export const formatFullTimestamp = (dateStr) => {
    const formatted = formatTimelineDate(dateStr);
    if (!formatted) return 'Processing...';
    return `${formatted} (${getTimeZoneAbbr()})`;
};
