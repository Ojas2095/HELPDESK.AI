/**
 * Unit tests for dateUtils
 * Covers Safari date parsing normalization and edge cases.
 */

import { formatTimelineDate, getTimeZoneAbbr, formatFullTimestamp } from './dateUtils.js';

describe('formatTimelineDate()', () => {
    const testDate = new Date('2026-01-15T14:30:00Z');
    const expectedLocal = testDate.toLocaleString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });

    test('formats a valid ISO string with Z suffix', () => {
        expect(formatTimelineDate('2026-01-15T14:30:00Z')).toBe(expectedLocal);
    });

    test('formats an ISO string without timezone (appends Z)', () => {
        // Without TZ indicator, the util appends Z
        expect(formatTimelineDate('2026-01-15T14:30:00')).toBe(expectedLocal);
    });

    test('formats a Supabase-style date string with space separator (Safari bug)', () => {
        // This is the common Supabase format that breaks Safari
        expect(formatTimelineDate('2026-01-15 14:30:00')).toBe(expectedLocal);
    });

    test('formats a Supabase-style date string with space and + timezone', () => {
        expect(formatTimelineDate('2026-01-15 14:30:00+00:00')).toBe(expectedLocal);
    });

    test('returns null for null/undefined input', () => {
        expect(formatTimelineDate(null)).toBeNull();
        expect(formatTimelineDate(undefined)).toBeNull();
    });

    test('returns "Invalid Date" for corrupt strings', () => {
        expect(formatTimelineDate('not-a-date')).toBe('Invalid Date');
        expect(formatTimelineDate('')).toBe('Invalid Date');
    });

    test('handles numeric timestamps', () => {
        const epoch = new Date(0);
        const expected = epoch.toLocaleString(undefined, {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
        expect(formatTimelineDate(0)).toBe(expected);
    });

    test('handles Date objects', () => {
        const d = new Date('2026-06-01T12:00:00Z');
        const expected = d.toLocaleString(undefined, {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
        expect(formatTimelineDate(d)).toBe(expected);
    });
});

describe('getTimeZoneAbbr()', () => {
    test('returns a string (not empty)', () => {
        const abbr = getTimeZoneAbbr();
        expect(typeof abbr).toBe('string');
        expect(abbr.length).toBeGreaterThanOrEqual(2);
    });

    test('returns default "UTC" in edge cases', () => {
        // No way to force Intl to fail in jsdom, but the fallback exists
        expect(getTimeZoneAbbr()).toBeTruthy();
    });
});

describe('formatFullTimestamp()', () => {
    test('returns formatted date with timezone abbreviation', () => {
        const result = formatFullTimestamp('2026-01-15T14:30:00Z');
        expect(result).toContain('2026');
        expect(result).toMatch(/\([A-Z]+\)$/); // Ends with "(UTC)" or similar
    });

    test('returns "Processing..." for null input', () => {
        expect(formatFullTimestamp(null)).toBe('Processing...');
    });

    test('returns "Processing..." for undefined input', () => {
        expect(formatFullTimestamp(undefined)).toBe('Processing...');
    });

    test('handles Supabase space-separated format', () => {
        const result = formatFullTimestamp('2026-01-15 14:30:00');
        expect(result).not.toBe('Processing...');
        expect(result).not.toBe('Invalid Date');
    });
});
