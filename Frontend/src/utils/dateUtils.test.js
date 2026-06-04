import {
  normalizeDateInput,
  parseDateSafely,
  formatDate,
  formatTime,
  formatDateTime,
  formatTimelineDate
} from "./dateUtils";

describe("dateUtils Safari-safe parsing", () => {
  it("normalizes Supabase timestamps with a space separator", () => {
    expect(normalizeDateInput("2024-07-15 10:30:45.123+00:00")).toBe("2024-07-15T10:30:45.123+00:00");
  });

  it("normalizes compact timezone offsets for Safari compatibility", () => {
    expect(normalizeDateInput("2024-07-15T10:30:45.123+0000")).toBe("2024-07-15T10:30:45.123+00:00");
  });

  it("returns a valid Date for normalized Supabase timestamps", () => {
    const parsed = parseDateSafely("2024-07-15 10:30:45.123+00:00");

    expect(parsed).toBeInstanceOf(Date);
    expect(Number.isNaN(parsed.getTime())).toBe(false);
    expect(parsed.toISOString()).toBe("2024-07-15T10:30:45.123Z");
  });

  it("falls back to the current local timestamp for empty values", () => {
    const before = Date.now();
    const parsed = parseDateSafely("");
    const after = Date.now();

    expect(parsed.getTime()).toBeGreaterThanOrEqual(before);
    expect(parsed.getTime()).toBeLessThanOrEqual(after);
  });

  it("falls back to the current local timestamp for corrupt values", () => {
    const before = Date.now();
    const parsed = parseDateSafely("not-a-date");
    const after = Date.now();

    expect(parsed.getTime()).toBeGreaterThanOrEqual(before);
    expect(parsed.getTime()).toBeLessThanOrEqual(after);
  });

  it("formats dates consistently in UTC", () => {
    expect(
      formatDate("2024-07-15T10:30:45.123Z", "en-US", { timeZone: "UTC" })
    ).toBe("Jul 15, 2024");
  });

  it("formats time consistently in America/New_York", () => {
    expect(
      formatTime("2024-07-15T10:30:45.123Z", "en-US", {
        timeZone: "America/New_York",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      })
    ).toBe("6:30 AM");
  });

  it("formats date-time consistently across timezone configurations", () => {
    expect(
      formatDateTime("2024-07-15T10:30:45.123Z", "en-US", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      })
    ).toBe("Jul 15, 2024, 4:00 PM");
  });

  it("uses the same safe formatting path for the timeline helper", () => {
    expect(
      formatTimelineDate("2024-07-15 10:30:45.123+00:00", "en-US", {
        timeZone: "UTC",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      })
    ).toBe("Jul 15, 2024, 10:30 AM");
  });
});
