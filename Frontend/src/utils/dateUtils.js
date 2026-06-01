/**
 * Unified Date Utility for HELPDESK.AI
 * Fixes timezone shift issues by explicitly forcing local display.
 * Handles Safari's strict ISO-8601 parsing requirements.
 */

const normalizeTimezone = (rawTimezone) => {
    if (!rawTimezone) return 'Z';
    if (rawTimezone === 'Z') return rawTimezone;
    return rawTimezone.includes(':')
        ? rawTimezone
        : `${rawTimezone.slice(0, 3)}:${rawTimezone.slice(3)}`;
};

/**
 * Normalize date input for cross-browser compatibility.
 * Safari rejects some timestamp shapes that Chrome accepts, especially
 * space-separated timestamps and high-precision Supabase microseconds.
 *
 * @param {string|number|Date} dateInput
 * @returns {Date|null}
 */
export const parseDate = (dateInput) => {
    if (!dateInput) return null;

    if (dateInput instanceof Date) {
        return Number.isNaN(dateInput.getTime()) ? null : dateInput;
    }

    if (typeof dateInput === 'number') {
        const epochDate = new Date(dateInput > 1e12 ? dateInput : dateInput * 1000);
        return Number.isNaN(epochDate.getTime()) ? null : epochDate;
    }

    const raw = String(dateInput).trim();
    if (!raw) return null;

    if (/^\d+$/.test(raw)) {
        const epoch = Number(raw);
        const epochDate = new Date(epoch > 1e12 ? epoch : epoch * 1000);
        return Number.isNaN(epochDate.getTime()) ? null : epochDate;
    }

    const isoLikeMatch = raw.match(
        /^(\d{4}-\d{2}-\d{2})(?:[T\s](\d{2}:\d{2}:\d{2})(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/
    );

    if (isoLikeMatch) {
        const [, datePart, timePart = '00:00:00', fraction = '', rawTimezone] = isoLikeMatch;
        const milliseconds = fraction
            ? `.${fraction.slice(1, 4).padEnd(3, '0')}`
            : '';
        const normalized = `${datePart}T${timePart}${milliseconds}${normalizeTimezone(rawTimezone)}`;
        const parsed = new Date(normalized);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const slashDateMatch = raw.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (slashDateMatch) {
        const [, year, month, day] = slashDateMatch;
        const normalized = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00.000Z`;
        const parsed = new Date(normalized);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const direct = new Date(raw);
    return Number.isNaN(direct.getTime()) ? null : direct;
};

export const formatTimelineDate = (dateStr) => {
    const date = parseDate(dateStr);
    if (!date) return 'Invalid Date';

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
                .find((part) => part.type === 'timeZoneName')?.value || 'UTC'
        );
    } catch (_e) {
        return 'UTC';
    }
};

export const formatFullTimestamp = (dateStr) => {
    const formatted = formatTimelineDate(dateStr);
    if (!formatted) return 'Processing...';
    return `${formatted} (${getTimeZoneAbbr()})`;
};

export const isValidDate = (dateStr) => parseDate(dateStr) !== null;

export const getRelativeTime = (dateStr) => {
    const date = parseDate(dateStr);
    if (!date) return 'Unknown';

    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
    if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
    if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;

    return formatTimelineDate(dateStr);
};
