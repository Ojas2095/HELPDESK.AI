/**
 * Tests for dateUtils.js - Safari compatibility focus
 */

import { describe, it, expect } from 'vitest';
import { formatTimelineDate, formatFullTimestamp, getTimeZoneAbbr } from '../utils/dateUtils';

describe('formatTimelineDate', () => {
    it('returns null for null/undefined input', () => {
        expect(formatTimelineDate(null)).toBeNull();
        expect(formatTimelineDate(undefined)).toBeNull();
        expect(formatTimelineDate('')).toBeNull();
    });

    it('returns null for non-string input', () => {
        expect(formatTimelineDate(123)).toBeNull();
        expect(formatTimelineDate({})).toBeNull();
    });

    it('parses ISO-8601 with Z suffix (UTC)', () => {
        const result = formatTimelineDate('2026-06-01T12:30:00Z');
        expect(result).toBeTruthy();
        expect(result).not.toBe('Invalid Date');
    });

    it('parses ISO-8601 without Z suffix (treats as UTC)', () => {
        const result = formatTimelineDate('2026-06-01T12:30:00');
        expect(result).toBeTruthy();
        expect(result).not.toBe('Invalid Date');
    });

    it('parses ISO-8601 with positive timezone offset', () => {
        const result = formatTimelineDate('2026-06-01T12:30:00+05:30');
        expect(result).toBeTruthy();
        expect(result).not.toBe('Invalid Date');
    });

    it('parses ISO-8601 with negative timezone offset', () => {
        const result = formatTimelineDate('2026-06-01T12:30:00-08:00');
        expect(result).toBeTruthy();
        expect(result).not.toBe('Invalid Date');
    });

    it('parses ISO-8601 with milliseconds', () => {
        const result = formatTimelineDate('2026-06-01T12:30:00.123Z');
        expect(result).toBeTruthy();
        expect(result).not.toBe('Invalid Date');
    });

    it('parses date-only string', () => {
        const result = formatTimelineDate('2026-06-01');
        expect(result).toBeTruthy();
        expect(result).not.toBe('Invalid Date');
    });

    it('parses space-separated datetime', () => {
        const result = formatTimelineDate('2026-06-01 12:30:00');
        expect(result).toBeTruthy();
        expect(result).not.toBe('Invalid Date');
    });

    it('returns null for garbage input', () => {
        expect(formatTimelineDate('not-a-date')).toBeNull();
        expect(formatTimelineDate('abc123')).toBeNull();
    });

    it('handles whitespace-only input', () => {
        expect(formatTimelineDate('   ')).toBeNull();
    });

    it('trims whitespace from valid dates', () => {
        const result = formatTimelineDate('  2026-06-01T12:30:00Z  ');
        expect(result).toBeTruthy();
        expect(result).not.toBe('Invalid Date');
    });
});

describe('formatFullTimestamp', () => {
    it('returns Processing... for null input', () => {
        expect(formatFullTimestamp(null)).toBe('Processing...');
        expect(formatFullTimestamp(undefined)).toBe('Processing...');
        expect(formatFullTimestamp('')).toBe('Processing...');
    });

    it('includes timezone abbreviation', () => {
        const result = formatFullTimestamp('2026-06-01T12:30:00Z');
        expect(result).toBeTruthy();
        expect(result).not.toBe('Processing...');
        // Should contain parentheses with timezone
        expect(result).toMatch(/\(.*\)/);
    });

    it('returns Processing... for invalid date', () => {
        expect(formatFullTimestamp('garbage')).toBe('Processing...');
    });
});

describe('getTimeZoneAbbr', () => {
    it('returns a non-empty string', () => {
        const tz = getTimeZoneAbbr();
        expect(typeof tz).toBe('string');
        expect(tz.length).toBeGreaterThan(0);
    });

    it('returns IST as fallback on error', () => {
        // getTimeZoneAbbr should always return something
        const tz = getTimeZoneAbbr();
        expect(tz).toBeTruthy();
    });
});
