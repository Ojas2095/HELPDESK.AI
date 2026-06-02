/**
 * Unified Date Utility for HELPDESK.AI
 * Fixes timezone shift issues by explicitly forcing local display.
 */

export const toSafariSafeDate = (dateStr) => {
    if (!dateStr) return null;

    const hasUtcSuffix = /(Z|[+-]\d{2}(?::?\d{2})?)$/.test(dateStr);

    let sanitized = dateStr;
    if (!hasUtcSuffix) {
        sanitized = sanitized.replace(/\.\d+/u, '');
        sanitized += 'Z';
    }

    const date = new Date(sanitized);
    if (Number.isNaN(date.getTime())) return null;

    return date;
};

export const formatTimelineDate = (dateStr) => {
    let date = toSafariSafeDate(dateStr);
    if (!date) return new Date().toLocaleString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });

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
    return `${formatted} (${getTimeZoneAbbr()})`;
};
