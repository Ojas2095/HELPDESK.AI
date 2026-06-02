/**
 * Tests for `Frontend/src/utils/dateUtils.js`
 *
 * These tests do not require a browser because `dateUtils` relies on
 * standard `Date`, `Intl`, and regex behavior that Node.js supports.
 */

import {
  toSafariSafeDate,
  formatTimelineDate,
  getTimeZoneAbbr,
  formatFullTimestamp
} from '../src/utils/dateUtils.js';

const test = (name, fn) => {
  try {
    fn();
    console.log(`PASS: ${name}`);
  } catch (error) {
    console.log(`FAIL: ${name}`);
    console.log(`  ${error.message}`);
  }
};

const assertEqual = (actual, expected, label = '') => {
  if (actual !== expected) {
    throw new Error(`${label} expected "${expected}" but got "${actual}"`);
  }
};

test('toSafariSafeDate: null input returns null', () => {
  assertEqual(toSafariSafeDate(null), null);
});

test('toSafariSafeDate: empty input returns null', () => {
  assertEqual(toSafariSafeDate(''), null);
});

test('toSafariSafeDate: plain ISO date becomes UTC Date', () => {
  const date = toSafariSafeDate('2025-01-15');
  assertEqual(date instanceof Date, true);
  assertEqual(date.toISOString(), '2025-01-15T00:00:00.000Z');
});

test('toSafariSafeDate: ISO string with Z is preserved', () => {
  const date = toSafariSafeDate('2025-01-15T08:30:00Z');
  assertEqual(date.toISOString(), '2025-01-15T08:30:00.000Z');
});

test('toSafariSafeDate: ISO string with offset is preserved', () => {
  const date = toSafariSafeDate('2025-01-15T08:30:00+05:30');
  assertEqual(date.toISOString(), '2025-01-15T03:00:00.000Z');
});

test('toSafariSafeDate: invalid string returns null', () => {
  assertEqual(toSafariSafeDate('banana'), null);
});

test('formatTimelineDate: plain ISO date returns localized string', () => {
  const formatted = formatTimelineDate('2025-01-15');
  expect(formatted).toContain('Jan 15, 2025');
});

test('formatTimelineDate: invalid string returns current timestamp fallback', () => {
  const formatted = formatTimelineDate('not-a-date');
  expect(formatted).toMatch(/[A-Z][a-z]{2} \d{2},\s?\d{4}/);
});

test('formatFullTimestamp: returns formatted date + timezone', () => {
  const formatted = formatFullTimestamp('2025-01-15T08:30:00Z');
  expect(formatted).toMatch(/Jan 15, 2025/);
  expect(formatted).toContain('(');
  expect(formatted).toContain(')');
});

test('getTimeZoneAbbr: returns a non-empty abbreviation', () => {
  const abbr = getTimeZoneAbbr();
  expect(abbr.length).toBeGreaterThan(0);
});
