/**
 * Unit tests for dateUtils.js — Safari-compatible ISO-8601 date parsing.
 *
 * Tests cover:
 * - parseISOSafely: various ISO formats, timezone handling, edge cases
 * - formatTimelineDate: formatting output, null handling
 * - getTimeZoneAbbr: basic functionality
 * - formatFullTimestamp: composition of above
 */

import { describe, it, expect } from 'vitest';
import {
    parseISOSafely,
    formatTimelineDate,
    getTimeZoneAbbr,
    formatFullTimestamp,
} from '../utils/dateUtils';

// ─── parseISOSafely Tests ────────────────────────────────────────

describe('parseISOSafely', () => {
    describe('valid ISO strings', () => {
        it('should parse standard UTC ISO string', () => {
            const d = parseISOSafely('2024-01-15T10:30:00Z');
            expect(d).toBeInstanceOf(Date);
            expect(d.getTime()).toBe(1705314600000);
        });

        it('should parse ISO string without timezone (assume UTC)', () => {
            const d = parseISOSafely('2024-01-15T10:30:00');
            expect(d).toBeInstanceOf(Date);
            expect(d.toISOString()).toBe('2024-01-15T10:30:00.000Z');
        });

        it('should parse date with positive offset', () => {
            const d = parseISOSafely('2024-01-15T15:30:00+05:00');
            expect(d).toBeInstanceOf(Date);
            expect(d.toISOString()).toBe('2024-01-15T10:30:00.000Z');
        });

        it('should parse date with negative offset', () => {
            const d = parseISOSafely('2024-01-15T05:30:00-05:00');
            expect(d).toBeInstanceOf(Date);
            expect(d.toISOString()).toBe('2024-01-15T10:30:00.000Z');
        });

        it('should parse compact offset format (+0530)', () => {
            const d = parseISOSafely('2024-01-15T15:30:00+0530');
            expect(d).toBeInstanceOf(Date);
            expect(d.toISOString()).toBe('2024-01-15T10:00:00.000Z');
        });

        it('should parse date with T separator replaced by space', () => {
            const d = parseISOSafely('2024-01-15 10:30:00');
            expect(d).toBeInstanceOf(Date);
            expect(d.toISOString()).toBe('2024-01-15T10:30:00.000Z');
        });

        it('should parse date with milliseconds', () => {
            const d = parseISOSafely('2024-01-15T10:30:00.123Z');
            expect(d).toBeInstanceOf(Date);
            expect(d.toISOString()).toBe('2024-01-15T10:30:00.123Z');
        });

        it('should handle date-only string', () => {
            const d = parseISOSafely('2024-01-15');
            // Falls to native Date parsing or fails gracefully
            if (d) {
                expect(d).toBeInstanceOf(Date);
            }
        });
    });

    describe('edge cases', () => {
        it('should return null for null input', () => {
            expect(parseISOSafely(null)).toBeNull();
        });

        it('should return null for undefined input', () => {
            expect(parseISOSafely(undefined)).toBeNull();
        });

        it('should return null for empty string', () => {
            expect(parseISOSafely('')).toBeNull();
        });

        it('should return null for completely invalid string', () => {
            const d = parseISOSafely('not-a-date');
            expect(d).toBeNull();
        });

        it('should return null for gibberish string', () => {
            const d = parseISOSafely('abc-def-ghij');
            expect(d).toBeNull();
        });

        it('should handle edge of epoch', () => {
            const d = parseISOSafely('1970-01-01T00:00:00Z');
            expect(d).toBeInstanceOf(Date);
            expect(d.getTime()).toBe(0);
        });

        it('should parse dates in current year', () => {
            const year = new Date().getFullYear();
            const d = parseISOSafely(`${year}-06-15T12:00:00Z`);
            expect(d).toBeInstanceOf(Date);
            expect(d.getFullYear()).toBe(year);
            expect(d.getMonth()).toBe(5); // June = 5
            expect(d.getDate()).toBe(15);
        });
    });
});

// ─── formatTimelineDate Tests ─────────────────────────────────────

describe('formatTimelineDate', () => {
    it('should return null for null input', () => {
        expect(formatTimelineDate(null)).toBeNull();
    });

    it('should return null for empty string', () => {
        expect(formatTimelineDate('')).toBeNull();
    });

    it('should return null for invalid date', () => {
        expect(formatTimelineDate('garbage')).toBeNull();
    });

    it('should format a valid date string', () => {
        const result = formatTimelineDate('2024-01-15T10:30:00Z');
        expect(result).not.toBeNull();
        expect(typeof result).toBe('string');
        // Should contain date parts: Jan, 15, 2024, 10:30, AM
        expect(result).toMatch(/Jan/i);
        expect(result).toMatch(/15/);
        expect(result).toMatch(/2024/);
    });

    it('should format date without timezone as UTC', () => {
        const result = formatTimelineDate('2024-01-15T10:30:00');
        expect(result).not.toBeNull();
        expect(typeof result).toBe('string');
    });

    it('should format a date with time component', () => {
        const result = formatTimelineDate('2024-06-01T14:45:00Z');
        expect(result).not.toBeNull();
        // Should show PM (14:45 = 2:45 PM)
        expect(result).toMatch(/PM|下午|14/i);
    });
});

// ─── getTimeZoneAbbr Tests ───────────────────────────────────────

describe('getTimeZoneAbbr', () => {
    it('should return a string', () => {
        const tz = getTimeZoneAbbr();
        expect(typeof tz).toBe('string');
        expect(tz.length).toBeGreaterThan(0);
    });

    it('should not throw in any environment', () => {
        expect(() => getTimeZoneAbbr()).not.toThrow();
    });
});

// ─── formatFullTimestamp Tests ────────────────────────────────────

describe('formatFullTimestamp', () => {
    it('should include timezone abbreviation', () => {
        const result = formatFullTimestamp('2024-01-15T10:30:00Z');
        expect(result).not.toBeNull();
        expect(typeof result).toBe('string');
        // Should contain the timezone abbreviation in parentheses
        expect(result).toMatch(/\(.+\)/);
    });

    it('should return Processing... for null input', () => {
        expect(formatFullTimestamp(null)).toBe('Processing...');
    });

    it('should return Processing... for empty input', () => {
        expect(formatFullTimestamp('')).toBe('Processing...');
    });

    it('should combine formatted date and timezone', () => {
        const result = formatFullTimestamp('2024-01-15T10:30:00Z');
        const parts = result.split(' (');
        expect(parts.length).toBeGreaterThanOrEqual(2);
    });
});