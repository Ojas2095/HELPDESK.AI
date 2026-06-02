/**
 * Unified Date Utility for HELPDESK.AI
 * Fixes timezone shift issues by explicitly forcing local display.
 * Safari-compatible: uses manual parsing instead of Date constructor quirks.
 */

/**
 * Parse ISO-8601 date string safely across all browsers.
 * Safari is strict about Date constructor - manual parsing avoids issues.
 * @param {string} dateStr - ISO-8601 date string
 * @returns {Date|null} Parsed Date object or null if invalid
 */
const parseDateSafe = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return null;

    // Trim whitespace
    const str = dateStr.trim();
    if (!str) return null;

    // Try ISO-8601 regex parsing (Safari-safe)
    // Matches: 2026-06-01T12:30:00Z, 2026-06-01T12:30:00+05:30, 2026-06-01 12:30:00
    const isoMatch = str.match(
        /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d+))?(Z|[+-]\d{2}:?\d{2})?$/
    );

    if (isoMatch) {
        const [, year, month, day, hour, minute, second, ms, tz] = isoMatch;
        let date;

        if (tz === 'Z' || tz === undefined) {
            // UTC or no timezone - treat as UTC from backend
            date = new Date(Date.UTC(
                parseInt(year), parseInt(month) - 1, parseInt(day),
                parseInt(hour), parseInt(minute), parseInt(second || 0),
                ms ? parseInt(ms.padEnd(3, '0').slice(0, 3)) : 0
            ));
        } else {
            // Has timezone offset like +05:30 or -0800
            const tzMatch = tz.match(/^([+-])(\d{2}):?(\d{2})$/);
            if (tzMatch) {
                const sign = tzMatch[1] === '+' ? 1 : -1;
                const tzHours = parseInt(tzMatch[2]);
                const tzMinutes = parseInt(tzMatch[3]);
                const offsetMs = (tzHours * 60 + tzMinutes) * 60 * 1000 * sign;

                // Create UTC date then adjust
                const utcDate = new Date(Date.UTC(
                    parseInt(year), parseInt(month) - 1, parseInt(day),
                    parseInt(hour), parseInt(minute), parseInt(second || 0),
                    ms ? parseInt(ms.padEnd(3, '0').slice(0, 3)) : 0
                ));
                date = new Date(utcDate.getTime() - offsetMs);
            }
        }

        if (date && !isNaN(date.getTime())) return date;
    }

    // Fallback: try native Date constructor (works in Chrome/Firefox)
    const nativeDate = new Date(str);
    if (!isNaN(nativeDate.getTime())) return nativeDate;

    // Fallback: try appending Z (for Chrome/Firefox compatibility)
    const withZ = new Date(str + 'Z');
    if (!isNaN(withZ.getTime())) return withZ;

    return null;
};

export const formatTimelineDate = (dateStr) => {
    const date = parseDateSafe(dateStr);
    if (!date) return null;

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
