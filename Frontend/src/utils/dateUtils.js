/**
 * Unified Date Utility for HELPDESK.AI
 * Fixes Safari/Firefox/Chrome ISO-8601 parsing differences and provides graceful fallbacks.
 */

export const normalizeIsoDateString = (rawValue) => {
    if (rawValue === undefined || rawValue === null || rawValue === '') return '';

    if (rawValue instanceof Date) {
        return rawValue.toISOString();
    }

    const trimmed = String(rawValue).trim();

    if (/^\d+$/.test(trimmed)) {
        const numericDate = new Date(Number(trimmed));
        return isNaN(numericDate.getTime()) ? '' : numericDate.toISOString();
    }

    let normalized = trimmed;

    // Convert date/time separator from space to `T` for Safari.
    normalized = normalized.replace(/^([0-9]{4}-[0-9]{2}-[0-9]{2})[ ]+([0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?)/, '$1T$2');

    // Remove whitespace before timezone offset.
    normalized = normalized.replace(/([0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?)[ ]+([+-][0-9]{2}:?[0-9]{2})$/, '$1$2');

    // Normalize timezone offsets like +0530 to +05:30.
    normalized = normalized.replace(/([+-][0-9]{2})([0-9]{2})$/, '$1:$2');

    // If a timestamp is present without any timezone marker, assume UTC.
    if (/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?$/.test(normalized)) {
        normalized += 'Z';
    }

    return normalized;
};

export const parseSafeDate = (value) => {
    if (value instanceof Date) {
        const date = new Date(value);
        return isNaN(date.getTime()) ? new Date() : date;
    }

    if (value === undefined || value === null || value === '') {
        return new Date();
    }

    if (typeof value === 'number' || /^\d+$/.test(String(value).trim())) {
        const numericDate = new Date(Number(value));
        return isNaN(numericDate.getTime()) ? new Date() : numericDate;
    }

    const normalized = normalizeIsoDateString(value);
    const date = new Date(normalized);
    return isNaN(date.getTime()) ? new Date() : date;
};

export const formatTimelineDate = (dateStr) => {
    const date = parseSafeDate(dateStr);

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
    return `${formatted} (${getTimeZoneAbbr()})`;
};
