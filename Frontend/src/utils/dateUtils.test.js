/**
 * Unit tests for dateUtils — Safari-safe date parsing.
 * Run with: node --test Frontend/src/utils/dateUtils.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatTimelineDate, formatFullTimestamp } from './dateUtils.js';

describe('formatTimelineDate', () => {
  it('returns null for null/undefined/empty input', () => {
    assert.equal(formatTimelineDate(null), null);
    assert.equal(formatTimelineDate(undefined), null);
    assert.equal(formatTimelineDate(''), null);
  });

  it('parses ISO-8601 with Z suffix', () => {
    const result = formatTimelineDate('2024-06-15T10:30:00Z');
    assert.ok(result);
    assert.notEqual(result, 'Invalid Date');
  });

  it('parses ISO-8601 without Z (assumes UTC)', () => {
    const result = formatTimelineDate('2024-06-15T10:30:00');
    assert.ok(result);
    assert.notEqual(result, 'Invalid Date');
  });

  it('parses space-separated datetime (Safari fix)', () => {
    const result = formatTimelineDate('2024-06-15 10:30:00');
    assert.ok(result);
    assert.notEqual(result, 'Invalid Date');
  });

  it('parses date-only strings', () => {
    const result = formatTimelineDate('2024-06-15');
    assert.ok(result);
    assert.notEqual(result, 'Invalid Date');
  });

  it('parses ISO with timezone offset', () => {
    const result = formatTimelineDate('2024-06-15T10:30:00+05:30');
    assert.ok(result);
    assert.notEqual(result, 'Invalid Date');
  });

  it('returns Invalid Date for garbage strings', () => {
    assert.equal(formatTimelineDate('not-a-date'), 'Invalid Date');
  });

  it('returns Invalid Date for garbage non-string', () => {
    assert.equal(formatTimelineDate('abc123'), 'Invalid Date');
  });
});

describe('formatFullTimestamp', () => {
  it('returns Processing... for null', () => {
    assert.equal(formatFullTimestamp(null), 'Processing...');
  });

  it('appends timezone abbreviation', () => {
    const result = formatFullTimestamp('2024-06-15T10:30:00Z');
    assert.ok(result.includes('('));
    assert.ok(result.includes(')'));
    assert.notEqual(result, 'Processing...');
  });
});
