/**
 * Unified Date Utility for HELPDESK.AI
 *
 * Fixes timezone shift issues by explicitly forcing local display.
 * Handles Safari's strict ISO-8601 parsing requirements.
 *
 * Root cause of Issue #912:
 * Safari's Date constructor is stricter than Chrome/Firefox. It rejects:
 *   - Timestamps with a space instead of 'T' (e.g. "2024-01-15 10:30:00")
 *   - Timestamps with microseconds (e.g. "2024-01-15T10:30:00.123456+00:00")
 *   - Compact timezone offsets without colon (e.g. "+0530")
 *   - Timestamps with no timezone indicator (ambiguous local vs UTC)
 *
 * All public functions route through `normalizeDateString` before constructing
 * a Date object, ensuring cross-browser compatibility.
 */

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Normalises a raw timestamp string (e.g. from Supabase) into a strict
 * ISO-8601 string that Safari's Date constructor can parse without errors.
 *
 * Transformations applied (in order):
 *  1. Trim surrounding whitespace.
 *  2. Replace space separator with 'T'.
 *  3. Truncate microseconds to milliseconds (6 digits → 3 digits).
 *  4. Insert colon in compact timezone offset (+0530 → +05:30).
 *  5. Append 'Z' when no timezone indicator is present.
 *
 * @private
 * @param {string} str - Raw date string from the database.
 * @returns {string} Safari-safe ISO-8601 string.
 */
const normalizeDateString = (str) => {
    let s = str.trim();

    // 1. Replace space between date and time with 'T'
    //    "2024-01-15 10:30:00" → "2024-01-15T10:30:00"
    s = s.replace(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/, '$1T$2');

    // 2. Truncate microseconds to milliseconds
    //    "2024-01-15T10:30:00.123456+00:00" → "2024-01-15T10:30:00.123+00:00"
    s = s.replace(/(\.\d{3})\d+/, '$1');

    // 3. Insert colon in compact timezone offset
    //    "+0530" → "+05:30"  |  "-0430" → "-04:30"
    s = s.replace(/([+-])(\d{2})(\d{2})$/, '$1$2:$3');

    // 4. Append 'Z' if there is no timezone indicator at all
    //    "2024-01-15T10:30:00" → "2024-01-15T10:30:00Z"
    if (!/Z|[+-]\d{2}:\d{2}$/.test(s)) {
        s += 'Z';
    }

    return s;
};

/**
 * Parses a raw date value into a valid Date object.
 * Returns null for any input that cannot be resolved to a valid date.
 *
 * Accepts:
 *  - Date instances (returned as-is if valid)
 *  - Numeric epoch timestamps (ms or s)
 *  - ISO-8601 strings (normalized before parsing)
 *  - Slash-separated date strings ("2024/01/15")
 *
 * @private
 * @param {string|number|Date|null|undefined} dateStr - Raw date value.
 * @returns {Date|null} Parsed Date or null.
 */
const parseDate = (dateStr) => {
    if (!dateStr) return null;

    // Already a Date object
    if (dateStr instanceof Date) {
        return isNaN(dateStr.getTime()) ? null : dateStr;
    }

    const str = String(dateStr).trim();
    if (!str) return null;

    // Numeric epoch timestamp (milliseconds or seconds)
    if (/^\d+$/.test(str)) {
        const num = parseInt(str, 10);
        const ms = num > 1e12 ? num : num * 1000;
        const epochDate = new Date(ms);
        return isNaN(epochDate.getTime()) ? null : epochDate;
    }

    // Slash-separated format: "2024/01/15" → "2024-01-15"
    const normalized = normalizeDateString(
        str.replace(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/, (_, y, m, d) =>
            `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
        )
    );

    const date = new Date(normalized);
    return isNaN(date.getTime()) ? null : date;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Formats a date value for display in ticket timelines.
 *
 * Returns a locale-formatted string such as "15 Jan 2024, 10:30 AM".
 * Returns 'Invalid Date' for any input that cannot be parsed.
 *
 * @param {string|number|Date|null|undefined} dateStr - Raw date value.
 * @returns {string} Formatted date string or 'Invalid Date'.
 */
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

/**
 * Returns the user's current timezone abbreviation (e.g. "IST", "PST").
 * Falls back to 'UTC' when the Intl API is unavailable (very old browsers).
 *
 * @returns {string} Timezone abbreviation.
 */
export const getTimeZoneAbbr = () => {
    try {
        return (
            new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' })
                .formatToParts(new Date())
                .find((part) => part.type === 'timeZoneName')?.value || 'UTC'
        );
    } catch (_e) {
        return 'UTC';
    }
};

/**
 * Formats a date with its timezone abbreviation appended.
 * Falls back to 'Processing...' when dateStr is falsy or invalid.
 *
 * @param {string|number|Date|null|undefined} dateStr - Raw date value.
 * @returns {string} Formatted timestamp with timezone, or 'Processing...'.
 */
export const formatFullTimestamp = (dateStr) => {
    const formatted = formatTimelineDate(dateStr);
    if (!formatted || formatted === 'Invalid Date') return 'Processing...';
    return `${formatted} (${getTimeZoneAbbr()})`;
};

/**
 * Checks whether a date string (or value) is valid and parseable.
 *
 * @param {string|number|Date|null|undefined} dateStr - Value to validate.
 * @returns {boolean} True if the value represents a valid date.
 */
export const isValidDate = (dateStr) => {
    return parseDate(dateStr) !== null;
};

/**
 * Returns a human-readable relative time string (e.g. "2 hours ago").
 * Falls back to a formatted date string for dates older than 7 days.
 * Returns 'Unknown' for invalid inputs.
 *
 * @param {string|number|Date|null|undefined} dateStr - Raw date value.
 * @returns {string} Relative time string or 'Unknown'.
 */
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

/**
 * Safari-safe wrapper around `new Date()` for use in sort comparators
 * and any other code that needs a raw Date object from a Supabase timestamp.
 *
 * Replaces direct `new Date(created_at)` calls that break on Safari.
 *
 * @param {string|number|Date|null|undefined} dateStr - Raw date value.
 * @returns {Date} Parsed Date, or `new Date(0)` (epoch) as a safe fallback.
 */
export const safeParseDateForSort = (dateStr) => {
    return parseDate(dateStr) ?? new Date(0);
};
