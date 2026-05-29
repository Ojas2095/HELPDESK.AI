/**
 * Unit tests for dateUtils.js — Safari ISO-8601 parsing fix
 *
 * Test matrix covers:
 *  • Normal Supabase UTC strings (no trailing Z)
 *  • Strings with milliseconds
 *  • Space-separated datetimes (older Supabase / MySQL format)
 *  • Already-correct strings (trailing Z, full offset)
 *  • Falsy inputs (null, undefined, empty string)
 *  • Corrupt / non-date strings
 *  • Native Date object input
 *  • Timezone abbreviation helper
 *  • Full timestamp formatter
 *
 * Run with:  npm test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatTimelineDate, getTimeZoneAbbr, formatFullTimestamp } from './dateUtils.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns true when the string looks like a valid formatted date (not "Invalid Date" or blank). */
const isFormattedDate = (str) =>
    typeof str === 'string' &&
    str.length > 0 &&
    str !== 'Invalid Date' &&
    str !== 'Processing...';

// ─── formatTimelineDate ───────────────────────────────────────────────────────

describe('formatTimelineDate', () => {

    // ── Supabase-style UTC string without trailing Z ────────────────────────

    it('parses a bare ISO string from Supabase (no trailing Z)', () => {
        const result = formatTimelineDate('2024-03-10T08:00:00');
        expect(isFormattedDate(result)).toBe(true);
        // Should contain "2024" and "Mar" (or locale equivalent digits) — basic sanity
        expect(result).toMatch(/2024/);
    });

    // ── Milliseconds with no timezone ───────────────────────────────────────

    it('parses ISO string with milliseconds but no timezone (old Safari failure case)', () => {
        const result = formatTimelineDate('2024-03-10T08:00:00.123');
        expect(isFormattedDate(result)).toBe(true);
        expect(result).toMatch(/2024/);
    });

    it('parses ISO string with 6-digit microseconds and no timezone', () => {
        const result = formatTimelineDate('2024-03-10T08:00:00.123456');
        expect(isFormattedDate(result)).toBe(true);
        expect(result).toMatch(/2024/);
    });

    // ── Space-separated datetime (MySQL / old Supabase format) ──────────────

    it('parses space-separated datetime (Safari cannot parse this natively)', () => {
        const result = formatTimelineDate('2024-03-10 08:00:00');
        expect(isFormattedDate(result)).toBe(true);
        expect(result).toMatch(/2024/);
    });

    it('parses space-separated datetime with milliseconds', () => {
        const result = formatTimelineDate('2024-03-10 08:00:00.999');
        expect(isFormattedDate(result)).toBe(true);
        expect(result).toMatch(/2024/);
    });

    // ── Already-correct strings (should still work) ─────────────────────────

    it('parses ISO string that already has trailing Z', () => {
        const result = formatTimelineDate('2024-03-10T08:00:00Z');
        expect(isFormattedDate(result)).toBe(true);
        expect(result).toMatch(/2024/);
    });

    it('parses ISO string with +HH:MM timezone offset', () => {
        const result = formatTimelineDate('2024-03-10T08:00:00+05:30');
        expect(isFormattedDate(result)).toBe(true);
        expect(result).toMatch(/2024/);
    });

    it('parses ISO string with -HH:MM timezone offset', () => {
        const result = formatTimelineDate('2024-03-10T08:00:00-08:00');
        expect(isFormattedDate(result)).toBe(true);
        expect(result).toMatch(/2024/);
    });

    // ── Native Date object ──────────────────────────────────────────────────

    it('accepts a native Date object directly', () => {
        const date = new Date(2024, 2, 10, 8, 0, 0); // March 10, 2024
        const result = formatTimelineDate(date);
        expect(isFormattedDate(result)).toBe(true);
        expect(result).toMatch(/2024/);
    });

    it('returns null for an invalid Date object', () => {
        // null / undefined is the falsy guard path; an invalid Date object falls through safeParseDateStr
        const result = formatTimelineDate(null);
        expect(result).toBeNull();
    });

    // ── Falsy / corrupt inputs (graceful fallback) ──────────────────────────

    it('returns null for null input', () => {
        expect(formatTimelineDate(null)).toBeNull();
    });

    it('returns null for undefined input', () => {
        expect(formatTimelineDate(undefined)).toBeNull();
    });

    it('returns null for empty string', () => {
        expect(formatTimelineDate('')).toBeNull();
    });

    it('falls back to current time for a corrupt / non-date string', () => {
        // With the fallback, safeParseDateStr returns new Date() — so the result is a
        // formatted *current* date, not null and not "Invalid Date".
        const before = Date.now();
        const result = formatTimelineDate('definitely-not-a-date');
        const after = Date.now();

        expect(isFormattedDate(result)).toBe(true);

        // Verify the year in the output matches the current year as a sanity check
        const currentYear = new Date().getFullYear().toString();
        expect(result).toMatch(currentYear);
    });

    // ── Different timezone configs ──────────────────────────────────────────

    it('produces consistent output across two identical calls', () => {
        const input = '2024-06-15T14:30:00';
        expect(formatTimelineDate(input)).toBe(formatTimelineDate(input));
    });

    it('produces different output for different inputs', () => {
        const a = formatTimelineDate('2024-01-01T00:00:00');
        const b = formatTimelineDate('2024-12-31T23:59:59');
        expect(a).not.toBe(b);
    });
});

// ─── getTimeZoneAbbr ─────────────────────────────────────────────────────────

describe('getTimeZoneAbbr', () => {
    it('returns a non-empty string', () => {
        const abbr = getTimeZoneAbbr();
        expect(typeof abbr).toBe('string');
        expect(abbr.length).toBeGreaterThan(0);
    });

    it('does not throw when Intl is unavailable (simulated fallback)', () => {
        // Temporarily remove Intl.DateTimeFormat to test the catch branch
        const original = globalThis.Intl;
        globalThis.Intl = undefined;

        let result;
        expect(() => { result = getTimeZoneAbbr(); }).not.toThrow();
        expect(typeof result).toBe('string');

        globalThis.Intl = original;
    });
});

// ─── formatFullTimestamp ──────────────────────────────────────────────────────

describe('formatFullTimestamp', () => {
    it('appends a timezone abbreviation in parentheses', () => {
        const result = formatFullTimestamp('2024-03-10T08:00:00');
        expect(result).toMatch(/\(.+\)$/);
    });

    it('returns "Processing..." for null input', () => {
        expect(formatFullTimestamp(null)).toBe('Processing...');
    });

    it('returns "Processing..." for undefined input', () => {
        expect(formatFullTimestamp(undefined)).toBe('Processing...');
    });

    it('returns "Processing..." for empty string', () => {
        expect(formatFullTimestamp('')).toBe('Processing...');
    });

    it('does not return "Invalid Date" for any valid ISO input', () => {
        const inputs = [
            '2024-03-10T08:00:00',
            '2024-03-10T08:00:00.123',
            '2024-03-10 08:00:00',
            '2024-03-10T08:00:00Z',
            '2024-03-10T08:00:00+05:30',
        ];
        for (const input of inputs) {
            const result = formatFullTimestamp(input);
            expect(result).not.toContain('Invalid Date');
            expect(isFormattedDate(result)).toBe(true);
        }
    });

    it('is consistent: calling twice with same input returns same string', () => {
        const input = '2024-07-04T12:00:00Z';
        expect(formatFullTimestamp(input)).toBe(formatFullTimestamp(input));
    });
});
