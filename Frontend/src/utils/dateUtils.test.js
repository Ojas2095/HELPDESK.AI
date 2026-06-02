/**
 * Unit tests for dateUtils.js
 *
 * Covers:
 *  - Safari-specific ISO-8601 parsing edge cases
 *  - Cross-browser compatibility (Chrome, Firefox, Safari behavior simulation)
 *  - Graceful fallback behavior for invalid / empty / corrupt dates
 *  - Timezone configuration tests
 *  - Input validation and length limits (security)
 *  - Relative time calculations
 *
 * Issue #1174: Fix Ticket Timeline Date Parsing Discrepancies on Older Safari
 */

import {
    parseDate,
    formatTimelineDate,
    getTimeZoneAbbr,
    formatFullTimestamp,
    isValidDate,
    getRelativeTime,
    safeParseDateForSort,
} from './dateUtils.js';

// ---------------------------------------------------------------------------
// Helper: freeze time for deterministic relative-time tests
// ---------------------------------------------------------------------------
const MOCK_NOW = new Date('2024-06-15T12:00:00Z');

describe('dateUtils', () => {
    let originalDate;

    beforeAll(() => {
        // Save original Date constructor
        originalDate = global.Date;
        // Mock Date to freeze "now" but allow normal construction with args
        global.Date = class extends Date {
            constructor(arg) {
                if (arg === undefined) {
                    super(MOCK_NOW);
                } else {
                    super(arg);
                }
            }
            static now() {
                return MOCK_NOW.getTime();
            }
        };
        // Copy static methods from original
        Object.setPrototypeOf(global.Date, originalDate);
        global.Date.UTC = originalDate.UTC;
        global.Date.parse = originalDate.parse;
    });

    afterAll(() => {
        global.Date = originalDate;
    });

    // =====================================================================
    // parseDate
    // =====================================================================
    describe('parseDate', () => {
        it('returns null for falsy inputs', () => {
            expect(parseDate(null)).toBeNull();
            expect(parseDate(undefined)).toBeNull();
            expect(parseDate('')).toBeNull();
            expect(parseDate('   ')).toBeNull();
        });

        it('returns the same Date instance if valid', () => {
            const d = new Date('2024-01-15T10:30:00Z');
            expect(parseDate(d)).toEqual(d);
        });

        it('returns null for an invalid Date object', () => {
            expect(parseDate(new Date('not-a-date'))).toBeNull();
        });

        it('parses epoch timestamps in milliseconds', () => {
            const ms = new Date('2024-01-15T10:30:00Z').getTime();
            const result = parseDate(String(ms));
            expect(result.getTime()).toBe(ms);
        });

        it('parses epoch timestamps in seconds', () => {
            const s = Math.floor(new Date('2024-01-15T10:30:00Z').getTime() / 1000);
            const result = parseDate(String(s));
            expect(result.getTime()).toBe(s * 1000);
        });

        // Safari-specific edge cases
        it('parses ISO-8601 with space separator (Safari fix)', () => {
            const result = parseDate('2024-01-15 10:30:00');
            expect(result).toBeInstanceOf(Date);
            expect(isNaN(result.getTime())).toBe(false);
        });

        it('parses ISO-8601 with microseconds (Safari fix)', () => {
            const result = parseDate('2024-01-15T10:30:00.123456+00:00');
            expect(result).toBeInstanceOf(Date);
            expect(isNaN(result.getTime())).toBe(false);
        });

        it('parses ISO-8601 with compact timezone offset (Safari fix)', () => {
            const result = parseDate('2024-01-15T10:30:00+0530');
            expect(result).toBeInstanceOf(Date);
            expect(isNaN(result.getTime())).toBe(false);
        });

        it('parses ISO-8601 without timezone indicator (Safari fix)', () => {
            const result = parseDate('2024-01-15T10:30:00');
            expect(result).toBeInstanceOf(Date);
            expect(isNaN(result.getTime())).toBe(false);
        });

        it('parses slash-separated dates', () => {
            const result = parseDate('2024/01/15');
            expect(result).toBeInstanceOf(Date);
            expect(result.getUTCDate()).toBe(15);
        });

        it('returns null for strings exceeding max length (security)', () => {
            const longString = 'A'.repeat(201);
            expect(parseDate(longString)).toBeNull();
        });

        it('returns null for completely invalid strings', () => {
            expect(parseDate('not-a-date')).toBeNull();
            expect(parseDate('2024-99-99T99:99:99')).toBeNull();
        });
    });

    // =====================================================================
    // formatTimelineDate
    // =====================================================================
    describe('formatTimelineDate', () => {
        it('formats a valid ISO date string', () => {
            const formatted = formatTimelineDate('2024-01-15T10:30:00Z');
            // US locale: "Jan 15, 2024, 10:30 AM" or similar
            expect(formatted).toMatch(/Jan/);
            expect(formatted).toMatch(/2024/);
            expect(formatted).toMatch(/:30/);
        });

        it('returns current local time for null input (graceful fallback)', () => {
            const formatted = formatTimelineDate(null);
            expect(formatted).not.toBe('Invalid Date');
            expect(formatted).toMatch(/Jun/);  // Should show June (mocked now)
            expect(formatted).toMatch(/2024/);
        });

        it('returns current local time for invalid string (graceful fallback)', () => {
            const formatted = formatTimelineDate('garbage');
            expect(formatted).not.toBe('Invalid Date');
            expect(formatted).toMatch(/Jun/);
            expect(formatted).toMatch(/2024/);
        });

        it('returns current local time for empty string (graceful fallback)', () => {
            const formatted = formatTimelineDate('');
            expect(formatted).not.toBe('Invalid Date');
        });
    });

    // =====================================================================
    // getTimeZoneAbbr
    // =====================================================================
    describe('getTimeZoneAbbr', () => {
        it('returns a non-empty string', () => {
            const tz = getTimeZoneAbbr();
            expect(typeof tz).toBe('string');
            expect(tz.length).toBeGreaterThan(0);
        });

        it('returns "UTC" when Intl API is unavailable', () => {
            const originalIntl = global.Intl;
            global.Intl = undefined;
            expect(getTimeZoneAbbr()).toBe('UTC');
            global.Intl = originalIntl;
        });
    });

    // =====================================================================
    // formatFullTimestamp
    // =====================================================================
    describe('formatFullTimestamp', () => {
        it('formats a valid date with timezone', () => {
            const result = formatFullTimestamp('2024-01-15T10:30:00Z');
            expect(result).toMatch(/Jan/);
            expect(result).toMatch(/2024/);
            expect(result).toMatch(/\([A-Z]{2,5}\)/);
        });

        it('returns "Processing..." for invalid input', () => {
            expect(formatFullTimestamp(null)).toBe('Processing...');
            expect(formatFullTimestamp('bad')).toBe('Processing...');
        });
    });

    // =====================================================================
    // isValidDate
    // =====================================================================
    describe('isValidDate', () => {
        it('returns true for valid ISO strings', () => {
            expect(isValidDate('2024-01-15T10:30:00Z')).toBe(true);
        });

        it('returns false for invalid strings', () => {
            expect(isValidDate('nope')).toBe(false);
            expect(isValidDate('')).toBe(false);
        });

        it('returns false for overly long strings', () => {
            expect(isValidDate('X'.repeat(201))).toBe(false);
        });
    });

    // =====================================================================
    // getRelativeTime
    // =====================================================================
    describe('getRelativeTime', () => {
        it('returns "just now" for dates < 60 seconds ago', () => {
            const justNow = new Date(MOCK_NOW.getTime() - 30_000);
            expect(getRelativeTime(justNow.toISOString())).toBe('just now');
        });

        it('returns "X minutes ago" for dates < 1 hour ago', () => {
            const fiveMinAgo = new Date(MOCK_NOW.getTime() - 5 * 60_000);
            expect(getRelativeTime(fiveMinAgo.toISOString())).toBe('5 minutes ago');
        });

        it('returns "1 minute ago" for singular', () => {
            const oneMinAgo = new Date(MOCK_NOW.getTime() - 60_000);
            expect(getRelativeTime(oneMinAgo.toISOString())).toBe('1 minute ago');
        });

        it('returns "X hours ago" for dates < 24 hours ago', () => {
            const threeHoursAgo = new Date(MOCK_NOW.getTime() - 3 * 60 * 60_000);
            expect(getRelativeTime(threeHoursAgo.toISOString())).toBe('3 hours ago');
        });

        it('returns "1 hour ago" for singular', () => {
            const oneHourAgo = new Date(MOCK_NOW.getTime() - 60 * 60_000);
            expect(getRelativeTime(oneHourAgo.toISOString())).toBe('1 hour ago');
        });

        it('returns "X days ago" for dates < 7 days ago', () => {
            const twoDaysAgo = new Date(MOCK_NOW.getTime() - 2 * 24 * 60 * 60_000);
            expect(getRelativeTime(twoDaysAgo.toISOString())).toBe('2 days ago');
        });

        it('returns "1 day ago" for singular', () => {
            const oneDayAgo = new Date(MOCK_NOW.getTime() - 24 * 60 * 60_000);
            expect(getRelativeTime(oneDayAgo.toISOString())).toBe('1 day ago');
        });

        it('falls back to formatted date for dates older than 7 days', () => {
            const tenDaysAgo = new Date(MOCK_NOW.getTime() - 10 * 24 * 60 * 60_000);
            const result = getRelativeTime(tenDaysAgo.toISOString());
            expect(result).not.toBe('Unknown');
            expect(result).toMatch(/Jun/);
            expect(result).toMatch(/2024/);
        });

        it('returns "Unknown" for invalid input', () => {
            expect(getRelativeTime(null)).toBe('Unknown');
            expect(getRelativeTime('bad')).toBe('Unknown');
        });
    });

    // =====================================================================
    // safeParseDateForSort
    // =====================================================================
    describe('safeParseDateForSort', () => {
        it('returns a valid Date for parseable input', () => {
            const result = safeParseDateForSort('2024-01-15T10:30:00Z');
            expect(result).toBeInstanceOf(Date);
            expect(isNaN(result.getTime())).toBe(false);
        });

        it('returns epoch (new Date(0)) for invalid input', () => {
            const result = safeParseDateForSort('nope');
            expect(result).toEqual(new Date(0));
        });

        it('returns epoch for null input', () => {
            expect(safeParseDateForSort(null)).toEqual(new Date(0));
        });
    });

    // =====================================================================
    // Cross-browser / timezone configuration tests
    // =====================================================================
    describe('cross-browser timezone compatibility', () => {
        it('parses UTC timestamps consistently', () => {
            const utc = '2024-01-15T10:30:00.000Z';
            const parsed = parseDate(utc);
            expect(parsed.toISOString()).toBe('2024-01-15T10:30:00.000Z');
        });

        it('parses positive offset timestamps', () => {
            const plusFive = '2024-01-15T10:30:00+05:30';
            const parsed = parseDate(plusFive);
            expect(parsed).toBeInstanceOf(Date);
            expect(isNaN(parsed.getTime())).toBe(false);
        });

        it('parses negative offset timestamps', () => {
            const minusFour = '2024-01-15T10:30:00-04:00';
            const parsed = parseDate(minusFour);
            expect(parsed).toBeInstanceOf(Date);
            expect(isNaN(parsed.getTime())).toBe(false);
        });

        it('handles compact offset without colon (Safari edge case)', () => {
            const compact = '2024-01-15T10:30:00+0530';
            const parsed = parseDate(compact);
            expect(parsed).toBeInstanceOf(Date);
            expect(isNaN(parsed.getTime())).toBe(false);
        });
    });
});
