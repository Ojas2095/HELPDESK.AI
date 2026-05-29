/**
 * Unified Date Utility for HELPDESK.AI
 *
 * Fixes two classes of issues:
 *  1. Safari ISO-8601 parsing failures — older Safari (pre-14 / WebKit < 602) rejects:
 *       • Space-separated datetimes:  "2024-01-15 10:30:00"
 *       • Milliseconds with no TZ:    "2024-01-15T10:30:00.123"
 *     Solution: normalize the string before constructing Date().
 *  2. Null / corrupt dates throwing page exceptions.
 *     Solution: always fall back to new Date() (current local time).
 */

// ─── Internal normalizer ──────────────────────────────────────────────────────

/**
 * Normalises a raw value from Supabase / any source into a valid Date object.
 *
 * Strategy (applied in order):
 *  1. Already a Date  → return as-is.
 *  2. Falsy / non-string → fall back to current time.
 *  3. Replace space separator with 'T'   (Safari requirement).
 *  4. Append 'Z' when no TZ indicator exists (UTC assumption for Supabase output).
 *  5. First parse attempt.
 *  6. If still NaN, strip sub-second precision and retry.
 *  7. If still NaN, fall back to current time (never throw, never show "Invalid Date").
 *
 * @param {string|Date|null|undefined} raw
 * @returns {Date}  Always a valid Date — never NaN.
 */
const safeParseDateStr = (raw) => {
    // 1. Already a native Date
    if (raw instanceof Date) {
        return isNaN(raw.getTime()) ? new Date() : raw;
    }

    // 2. Falsy or non-string guard
    if (!raw || typeof raw !== 'string') {
        return new Date();
    }

    // 3. Normalise: replace space separator with 'T'
    //    e.g. "2024-01-15 10:30:00" → "2024-01-15T10:30:00"
    let normalized = raw.trim().replace(' ', 'T');

    // 4. Append 'Z' only when no timezone indicator is present
    //    Detects: trailing 'Z', '+HH:MM', or '-HH:MM' (but not the date's '-')
    const hasTz = /Z$/i.test(normalized) || /[+-]\d{2}:\d{2}$/.test(normalized);
    if (!hasTz) {
        normalized += 'Z';
    }

    // 5. First parse attempt
    let date = new Date(normalized);
    if (!isNaN(date.getTime())) return date;

    // 6. Sub-second precision strip and retry
    //    e.g. "2024-01-15T10:30:00.123456Z" → "2024-01-15T10:30:00Z"
    const stripped = normalized.replace(/\.\d+(?=Z|[+-]\d{2}:\d{2}|$)/, '');
    date = new Date(stripped);
    if (!isNaN(date.getTime())) return date;

    // 7. Last resort: current time (never show a blank or crash)
    console.warn('[dateUtils] Could not parse date string, falling back to now:', raw);
    return new Date();
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Formats a date string (or Date object) for display in the Ticket Timeline.
 * Returns a human-readable localised string, or null if the input is falsy.
 *
 * @param {string|Date|null|undefined} dateStr
 * @returns {string|null}
 */
export const formatTimelineDate = (dateStr) => {
    if (!dateStr && dateStr !== 0) return null;

    const date = safeParseDateStr(dateStr);

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
 * Falls back to 'Local' when the Intl API is unavailable (very old browsers).
 *
 * @returns {string}
 */
export const getTimeZoneAbbr = () => {
    try {
        return (
            new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' })
                .formatToParts(new Date())
                .find((part) => part.type === 'timeZoneName')?.value || 'Local'
        );
    } catch (_e) {
        return 'Local';
    }
};

/**
 * Formats a date with its timezone abbreviation appended.
 * Falls back to 'Processing...' when dateStr is falsy.
 *
 * @param {string|Date|null|undefined} dateStr
 * @returns {string}
 */
export const formatFullTimestamp = (dateStr) => {
    const formatted = formatTimelineDate(dateStr);
    if (!formatted) return 'Processing...';
    return `${formatted} (${getTimeZoneAbbr()})`;
};
