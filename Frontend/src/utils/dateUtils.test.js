import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeIsoDateString, formatTimelineDate, formatFullTimestamp } from './dateUtils.js';

test('normalizeIsoDateString converts space-separated timestamps to Safari-safe UTC ISO strings', () => {
    const normalized = normalizeIsoDateString('2025-12-31 23:59:59');
    assert.strictEqual(normalized, '2025-12-31T23:59:59Z');
});

test('normalizeIsoDateString normalizes timezone offsets without colon', () => {
    const normalized = normalizeIsoDateString('2025-12-31T23:59:59+0530');
    assert.strictEqual(normalized, '2025-12-31T23:59:59+05:30');
});

test('normalizeIsoDateString normalizes UTC offset with whitespace before offset', () => {
    const normalized = normalizeIsoDateString('2025-12-31 23:59:59 +0000');
    assert.strictEqual(normalized, '2025-12-31T23:59:59+00:00');
});

test('formatTimelineDate falls back gracefully for invalid date strings', () => {
    const result = formatTimelineDate('not-a-valid-date');
    assert.ok(typeof result === 'string');
    assert.notStrictEqual(result, 'Invalid Date');
    assert.ok(result.length > 0);
});

test('formatFullTimestamp returns a timestamp plus timezone abbreviation', () => {
    const result = formatFullTimestamp('2025-12-31T23:59:59Z');
    assert.ok(result.includes('('), 'should include timezone abbreviation');
    assert.ok(result.includes(')'), 'should include timezone abbreviation');
});
