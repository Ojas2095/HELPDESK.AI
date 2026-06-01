/**
 * @file dateUtils.test.js
 * @description Unit tests for dateUtils.js — cross-browser date parsing utility.
 *
 * Covers the Safari-specific parsing failures described in Issue #912:
 *   - Space-separated timestamps ("2024-01-15 10:30:00")
 *   - Microsecond precision ("2024-01-15T10:30:00.123456+00:00")
 *   - Compact timezone offsets ("+0530")
 *   - Missing timezone indicator ("2024-01-15T10:30:00")
 *
 * Also covers general correctness, edge cases, and the safeParseDateForSort helper.
 */

import { describe, it, expect } from 'vitest';
import {
    formatTimelineDate,
    formatFullTimestamp,
    isValidDate,
    getRelativeTime,
    getTimeZoneAbbr,
    safeParseDateForSort,
} from './dateUtils';

// ---------------------------------------------------------------------------
// formatTimelineDate — happy path
// ---------------------------------------------------------------------------

describe('formatTimelineDate — valid inputs', () => {
    it('handles standard ISO-8601 with Z suffix', () => {
        const result = formatTimelineDate('2024-01-15T10:30:00Z');
        expect(result).not.toBe('Invalid Date');
        expect(result).toContain('Jan');
        expect(result).toContain('2024');
    });

    it('handles ISO-8601 without timezone (assumes UTC)', () => {
        const result = formatTimelineDate('2024-01-15T10:30:00');
        expect(result).not.toBe('Invalid Date');
    });

    it('handles ISO-8601 with milliseconds and Z', () => {
        const result = formatTimelineDate('2024-01-15T10:30:00.123Z');
        expect(result).not.toBe('Invalid Date');
    });

    it('handles ISO-8601 with positive timezone offset', () => {
        const result = formatTimelineDate('2024-01-15T10:30:00+05:30');
        expect(result).not.toBe('Invalid Date');
    });

    it('handles ISO-8601 with negative timezone offset', () => {
        const result = formatTimelineDate('2024-01-15T10:30:00-04:00');
        expect(result).not.toBe('Invalid Date');
    });

    it('handles slash-separated date format', () => {
        const result = formatTimelineDate('2024/01/15');
        expect(result).not.toBe('Invalid Date');
    });

    it('handles numeric epoch timestamp (milliseconds)', () => {
        const result = formatTimelineDate('1705312200000');
        expect(result).not.toBe('Invalid Date');
    });

    it('handles Date object input', () => {
        const result = formatTimelineDate(new Date('2024-01-15T10:30:00Z'));
        expect(result).not.toBe('Invalid Date');
    });
});

// ---------------------------------------------------------------------------
// formatTimelineDate — Safari-specific edge cases (Issue #912)
// ---------------------------------------------------------------------------

describe('formatTimelineDate — Safari-specific edge cases (Issue #912)', () => {
    it('handles space-separated timestamp (Safari rejects this natively)', () => {
        // Safari's Date constructor fails on "2024-01-15 10:30:00"
        const result = formatTimelineDate('2024-01-15 10:30:00');
        expect(result).not.toBe('Invalid Date');
    });

    it('handles space-separated timestamp with Z', () => {
        const result = formatTimelineDate('2024-01-15 10:30:00Z');
        expect(result).not.toBe('Invalid Date');
    });

    it('handles space-separated timestamp with timezone offset', () => {
        const result = formatTimelineDate('2024-01-15 10:30:00+05:30');
        expect(result).not.toBe('Invalid Date');
    });

    it('handles Supabase microsecond timestamp (6 decimal digits)', () => {
        // Supabase often returns "2024-01-15T10:30:00.123456+00:00"
        // Safari fails on 6-digit fractional seconds
        const result = formatTimelineDate('2024-01-15T10:30:00.123456+00:00');
        expect(result).not.toBe('Invalid Date');
    });

    it('handles Supabase timestamp with space and microseconds', () => {
        const result = formatTimelineDate('2024-01-15 10:30:00.654321+00:00');
        expect(result).not.toBe('Invalid Date');
    });

    it('handles compact timezone offset without colon (+0530)', () => {
        const result = formatTimelineDate('2024-01-15T10:30:00+0530');
        expect(result).not.toBe('Invalid Date');
    });

    it('handles compact negative timezone offset (-0430)', () => {
        const result = formatTimelineDate('2024-01-15T10:30:00-0430');
        expect(result).not.toBe('Invalid Date');
    });

    it('handles timestamp with no timezone and no T (full Safari problem case)', () => {
        // "2024-01-15 10:30:00" — the most common Supabase format that breaks Safari
        const result = formatTimelineDate('2024-01-15 10:30:00');
        expect(result).not.toBe('Invalid Date');
    });
});

// ---------------------------------------------------------------------------
// formatTimelineDate — invalid / empty inputs
// ---------------------------------------------------------------------------

describe('formatTimelineDate — invalid inputs', () => {
    it('returns Invalid Date for null', () => {
        expect(formatTimelineDate(null)).toBe('Invalid Date');
    });

    it('returns Invalid Date for undefined', () => {
        expect(formatTimelineDate(undefined)).toBe('Invalid Date');
    });

    it('returns Invalid Date for empty string', () => {
        expect(formatTimelineDate('')).toBe('Invalid Date');
    });

    it('returns Invalid Date for non-date string', () => {
        expect(formatTimelineDate('not-a-date')).toBe('Invalid Date');
    });

    it('returns Invalid Date for random alphanumeric string', () => {
        expect(formatTimelineDate('abc123xyz')).toBe('Invalid Date');
    });
});

// ---------------------------------------------------------------------------
// isValidDate
// ---------------------------------------------------------------------------

describe('isValidDate', () => {
    it('returns true for valid ISO-8601 string', () => {
        expect(isValidDate('2024-01-15T10:30:00Z')).toBe(true);
    });

    it('returns true for date-only string', () => {
        expect(isValidDate('2024-01-15')).toBe(true);
    });

    it('returns true for slash-separated date', () => {
        expect(isValidDate('2024/01/15')).toBe(true);
    });

    it('returns true for space-separated Supabase timestamp', () => {
        expect(isValidDate('2024-01-15 10:30:00')).toBe(true);
    });

    it('returns true for Supabase microsecond timestamp', () => {
        expect(isValidDate('2024-01-15T10:30:00.123456+00:00')).toBe(true);
    });

    it('returns false for null', () => {
        expect(isValidDate(null)).toBe(false);
    });

    it('returns false for empty string', () => {
        expect(isValidDate('')).toBe(false);
    });

    it('returns false for non-date string', () => {
        expect(isValidDate('not-a-date')).toBe(false);
    });

    it('returns false for impossible date (month 13)', () => {
        expect(isValidDate('2024-13-45')).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// getRelativeTime
// ---------------------------------------------------------------------------

describe('getRelativeTime', () => {
    it('returns "Just now" for a date within the last minute', () => {
        const now = new Date();
        const result = getRelativeTime(now.toISOString());
        expect(result).toBe('Just now');
    });

    it('returns "X minutes ago" for a date 5 minutes ago', () => {
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
        const result = getRelativeTime(fiveMinAgo.toISOString());
        expect(result).toContain('minute');
        expect(result).toContain('ago');
    });

    it('returns "X hours ago" for a date 2 hours ago', () => {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        const result = getRelativeTime(twoHoursAgo.toISOString());
        expect(result).toContain('hour');
        expect(result).toContain('ago');
    });

    it('returns "X days ago" for a date 3 days ago', () => {
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
        const result = getRelativeTime(threeDaysAgo.toISOString());
        expect(result).toContain('day');
        expect(result).toContain('ago');
    });

    it('returns a formatted date string for dates older than 7 days', () => {
        const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const result = getRelativeTime(oldDate.toISOString());
        expect(result).not.toContain('ago');
        expect(result).not.toBe('Unknown');
    });

    it('returns "Unknown" for null input', () => {
        expect(getRelativeTime(null)).toBe('Unknown');
    });

    it('returns "Unknown" for invalid string', () => {
        expect(getRelativeTime('invalid')).toBe('Unknown');
    });
});

// ---------------------------------------------------------------------------
// getTimeZoneAbbr
// ---------------------------------------------------------------------------

describe('getTimeZoneAbbr', () => {
    it('returns a non-empty string', () => {
        const result = getTimeZoneAbbr();
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
    });
});

// ---------------------------------------------------------------------------
// formatFullTimestamp
// ---------------------------------------------------------------------------

describe('formatFullTimestamp', () => {
    it('includes timezone abbreviation in parentheses for valid date', () => {
        const result = formatFullTimestamp('2024-01-15T10:30:00Z');
        expect(result).toContain('(');
        expect(result).toContain(')');
    });

    it('returns "Processing..." for null', () => {
        expect(formatFullTimestamp(null)).toBe('Processing...');
    });

    it('returns "Processing..." for empty string', () => {
        expect(formatFullTimestamp('')).toBe('Processing...');
    });

    it('returns "Processing..." for invalid date string', () => {
        expect(formatFullTimestamp('invalid')).toBe('Processing...');
    });

    it('handles Supabase microsecond format without returning Processing...', () => {
        const result = formatFullTimestamp('2024-01-15T10:30:00.123456+00:00');
        expect(result).not.toBe('Processing...');
        expect(result).toContain('(');
    });
});

// ---------------------------------------------------------------------------
// safeParseDateForSort — used in sort comparators (Issue #912 adjacent fix)
// ---------------------------------------------------------------------------

describe('safeParseDateForSort', () => {
    it('returns a valid Date for a standard ISO string', () => {
        const result = safeParseDateForSort('2024-01-15T10:30:00Z');
        expect(result).toBeInstanceOf(Date);
        expect(isNaN(result.getTime())).toBe(false);
    });

    it('returns a valid Date for a space-separated Supabase timestamp', () => {
        const result = safeParseDateForSort('2024-01-15 10:30:00');
        expect(result).toBeInstanceOf(Date);
        expect(isNaN(result.getTime())).toBe(false);
    });

    it('returns epoch (new Date(0)) as fallback for null', () => {
        const result = safeParseDateForSort(null);
        expect(result).toBeInstanceOf(Date);
        expect(result.getTime()).toBe(0);
    });

    it('returns epoch as fallback for invalid string', () => {
        const result = safeParseDateForSort('not-a-date');
        expect(result).toBeInstanceOf(Date);
        expect(result.getTime()).toBe(0);
    });

    it('can be used safely in a sort comparator', () => {
        const items = [
            { created_at: '2024-03-01 08:00:00' },
            { created_at: '2024-01-15T10:30:00Z' },
            { created_at: null },
            { created_at: '2024-02-20 14:00:00.123456+00:00' },
        ];
        expect(() => {
            items.sort(
                (a, b) =>
                    safeParseDateForSort(a.created_at) -
                    safeParseDateForSort(b.created_at)
            );
        }).not.toThrow();
        // null falls back to epoch, so it should sort first
        expect(items[0].created_at).toBeNull();
    });
});
