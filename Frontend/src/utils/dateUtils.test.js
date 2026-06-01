import formatTimelineDate from './dateUtils';

describe('formatTimelineDate', () => {
  test('returns empty string for null input', () => {
    expect(formatTimelineDate(null)).toBe('');
  });

  test('returns empty string for undefined input', () => {
    expect(formatTimelineDate(undefined)).toBe('');
  });

  test('formats a valid ISO date string', () => {
    const result = formatTimelineDate('2026-06-01T15:30:00Z');
    expect(result).toContain('2026');
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });

  test('returns "Invalid Date" for an invalid date string', () => {
    const result = formatTimelineDate('not-a-date');
    expect(result).toBe('Invalid Date');
  });

  test('displays timezone information', () => {
    const result = formatTimelineDate('2026-06-01T15:30:00Z');
    expect(result).toMatch(/GMT|UTC|[+-]\d{2}:\d{2}/);
  });
});
