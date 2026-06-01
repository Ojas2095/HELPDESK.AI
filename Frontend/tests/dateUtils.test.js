import test from 'node:test';
import assert from 'node:assert/strict';

import { parseDate, formatTimelineDate } from '../src/utils/dateUtils.js';

test('parseDate accepts Supabase timestamps with microseconds', () => {
    const parsed = parseDate('2026-06-01T12:34:56.123456+00:00');

    assert.ok(parsed instanceof Date);
    assert.equal(parsed.toISOString(), '2026-06-01T12:34:56.123Z');
});

test('parseDate normalizes timestamps with a space separator', () => {
    const parsed = parseDate('2026-06-01 12:34:56');

    assert.ok(parsed instanceof Date);
    assert.equal(parsed.toISOString(), '2026-06-01T12:34:56.000Z');
});

test('formatTimelineDate returns Invalid Date for unparsable values', () => {
    assert.equal(formatTimelineDate('not-a-date'), 'Invalid Date');
});
