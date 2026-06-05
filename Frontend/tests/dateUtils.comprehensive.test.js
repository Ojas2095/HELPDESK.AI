import test from 'node:test';
import assert from 'node:assert/strict';

import {
    parseDate,
    formatTimelineDate,
    formatFullTimestamp,
    isValidDate,
    getRelativeTime,
    safeParseDateForSort,
    getTimeZoneAbbr,
} from '../src/utils/dateUtils.js';

// ---------------------------------------------------------------------------
// parseDate — null / undefined / empty
// ---------------------------------------------------------------------------

test('parseDate returns null for null', () => {
    assert.equal(parseDate(null), null);
});

test('parseDate returns null for undefined', () => {
    assert.equal(parseDate(undefined), null);
});

test('parseDate returns null for empty string', () => {
    assert.equal(parseDate(''), null);
});

test('parseDate returns null for whitespace-only string', () => {
    assert.equal(parseDate('   '), null);
});

// ---------------------------------------------------------------------------
// parseDate — Date objects
// ---------------------------------------------------------------------------

test('parseDate returns valid Date object as-is', () => {
    const d = new Date('2024-06-15T10:30:00Z');
    assert.deepEqual(parseDate(d), d);
});

test('parseDate returns null for invalid Date object', () => {
    assert.equal(parseDate(new Date('not-a-date')), null);
});

// ---------------------------------------------------------------------------
// parseDate — epoch timestamps
// ---------------------------------------------------------------------------

test('parseDate handles millisecond epoch timestamp', () => {
    const ms = 1718448600000; // 2024-06-15T10:50:00Z
    const d = parseDate(ms);
    assert.ok(d instanceof Date);
    assert.equal(d.toISOString(), '2024-06-15T10:50:00.000Z');
});

test('parseDate handles second epoch timestamp (converts to ms)', () => {
    const sec = 1718448600;
    const d = parseDate(sec);
    assert.ok(d instanceof Date);
    assert.equal(d.toISOString(), '2024-06-15T10:50:00.000Z');
});

test('parseDate handles numeric string epoch', () => {
    const d = parseDate('1718448600000');
    assert.ok(d instanceof Date);
    assert.equal(d.toISOString(), '2024-06-15T10:50:00.000Z');
});

// ---------------------------------------------------------------------------
// parseDate — Safari-specific normalization (Issue #912 / #1174)
// ---------------------------------------------------------------------------

test('parseDate normalizes space-separated datetime for Safari', () => {
    const d = parseDate('2024-01-15 10:30:00');
    assert.ok(d instanceof Date);
    assert.equal(d.toISOString(), '2024-01-15T10:30:00.000Z');
});

test('parseDate truncates microseconds to milliseconds', () => {
    const d = parseDate('2024-01-15T10:30:00.123456+00:00');
    assert.ok(d instanceof Date);
    assert.equal(d.toISOString(), '2024-01-15T10:30:00.123Z');
});

test('parseDate inserts colon in compact timezone offset', () => {
    const d = parseDate('2024-01-15T10:30:00+0530');
    assert.ok(d instanceof Date);
    // +05:30 means the UTC time is 05:30 earlier
    assert.equal(d.getUTCHours(), 5);
    assert.equal(d.getUTCMinutes(), 0);
});

test('parseDate handles negative compact timezone offset', () => {
    const d = parseDate('2024-01-15T10:30:00-0430');
    assert.ok(d instanceof Date);
    assert.equal(d.getUTCHours(), 15);
    assert.equal(d.getUTCMinutes(), 0);
});

test('parseDate appends Z when no timezone indicator present', () => {
    const d = parseDate('2024-06-15T10:30:00');
    assert.ok(d instanceof Date);
    assert.equal(d.toISOString(), '2024-06-15T10:30:00.000Z');
});

test('parseDate handles ISO-8601 with Z suffix', () => {
    const d = parseDate('2024-06-15T10:30:00Z');
    assert.ok(d instanceof Date);
    assert.equal(d.toISOString(), '2024-06-15T10:30:00.000Z');
});

test('parseDate handles ISO-8601 with colon timezone offset', () => {
    const d = parseDate('2024-06-15T10:30:00+05:30');
    assert.ok(d instanceof Date);
    assert.equal(d.getUTCHours(), 5);
});

// ---------------------------------------------------------------------------
// parseDate — slash-separated dates
// ---------------------------------------------------------------------------

test('parseDate handles slash-separated date format', () => {
    const d = parseDate('2024/01/15');
    assert.ok(d instanceof Date);
    assert.equal(d.getFullYear(), 2024);
    assert.equal(d.getMonth(), 0); // January
    assert.equal(d.getDate(), 15);
});

test('parseDate handles slash-separated date with single-digit month', () => {
    const d = parseDate('2024/6/15');
    assert.ok(d instanceof Date);
    assert.equal(d.getMonth(), 5); // June
});

// ---------------------------------------------------------------------------
// parseDate — invalid inputs
// ---------------------------------------------------------------------------

test('parseDate returns null for random string', () => {
    assert.equal(parseDate('not-a-date'), null);
});

test('parseDate returns null for boolean true', () => {
    assert.equal(parseDate(true), null);
});

// ---------------------------------------------------------------------------
// formatTimelineDate
// ---------------------------------------------------------------------------

test('formatTimelineDate returns locale-formatted string for valid date', () => {
    const result = formatTimelineDate('2024-06-15T10:30:00Z');
    assert.ok(typeof result === 'string');
    assert.ok(result.length > 0);
    assert.ok(result !== 'Invalid Date');
});

test('formatTimelineDate returns Invalid Date for null', () => {
    assert.equal(formatTimelineDate(null), 'Invalid Date');
});

test('formatTimelineDate returns Invalid Date for garbage string', () => {
    assert.equal(formatTimelineDate('garbage'), 'Invalid Date');
});

test('formatTimelineDate handles space-separated datetime (Safari fix)', () => {
    const result = formatTimelineDate('2024-01-15 10:30:00');
    assert.ok(result !== 'Invalid Date');
});

// ---------------------------------------------------------------------------
// isValidDate
// ---------------------------------------------------------------------------

test('isValidDate returns true for valid ISO string', () => {
    assert.equal(isValidDate('2024-06-15T10:30:00Z'), true);
});

test('isValidDate returns false for null', () => {
    assert.equal(isValidDate(null), false);
});

test('isValidDate returns false for garbage', () => {
    assert.equal(isValidDate('not-a-date'), false);
});

test('isValidDate returns true for epoch timestamp', () => {
    assert.equal(isValidDate(1718448600000), true);
});

test('isValidDate returns true for space-separated datetime (Safari fix)', () => {
    assert.equal(isValidDate('2024-01-15 10:30:00'), true);
});

// ---------------------------------------------------------------------------
// formatFullTimestamp
// ---------------------------------------------------------------------------

test('formatFullTimestamp includes timezone abbreviation', () => {
    const result = formatFullTimestamp('2024-06-15T10:30:00Z');
    assert.ok(result !== 'Processing...');
    assert.ok(result.includes('('));
    assert.ok(result.includes(')'));
});

test('formatFullTimestamp returns Processing... for null', () => {
    assert.equal(formatFullTimestamp(null), 'Processing...');
});

test('formatFullTimestamp returns Processing... for invalid input', () => {
    assert.equal(formatFullTimestamp('garbage'), 'Processing...');
});

// ---------------------------------------------------------------------------
// safeParseDateForSort
// ---------------------------------------------------------------------------

test('safeParseDateForSort returns Date for valid input', () => {
    const d = safeParseDateForSort('2024-06-15T10:30:00Z');
    assert.ok(d instanceof Date);
    assert.ok(!isNaN(d.getTime()));
});

test('safeParseDateForSort returns epoch fallback for null', () => {
    const d = safeParseDateForSort(null);
    assert.ok(d instanceof Date);
    assert.equal(d.getTime(), 0);
});

test('safeParseDateForSort returns epoch fallback for garbage', () => {
    const d = safeParseDateForSort('not-a-date');
    assert.ok(d instanceof Date);
    assert.equal(d.getTime(), 0);
});

// ---------------------------------------------------------------------------
// getTimeZoneAbbr
// ---------------------------------------------------------------------------

test('getTimeZoneAbbr returns a non-empty string', () => {
    const tz = getTimeZoneAbbr();
    assert.ok(typeof tz === 'string');
    assert.ok(tz.length > 0);
});

// ---------------------------------------------------------------------------
// getRelativeTime
// ---------------------------------------------------------------------------

test('getRelativeTime returns formatted string for valid date', () => {
    const result = getRelativeTime('2024-06-15T10:30:00Z');
    assert.ok(typeof result === 'string');
    assert.ok(result !== 'Processing...');
});

test('getRelativeTime returns Processing... for null', () => {
    assert.equal(getRelativeTime(null), 'Processing...');
});
