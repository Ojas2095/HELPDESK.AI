const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_WITHOUT_TZ = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?$/;
const ISO_WITH_TZ = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?([+-]\d{2}:?\d{2}|Z)$/i;

export const normalizeDateInput = (value) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const input = String(value).trim();
  if (!input) {
    return null;
  }

  if (ISO_DATE_ONLY.test(input)) {
    return `${input}T00:00:00`;
  }

  if (ISO_WITHOUT_TZ.test(input)) {
    return input.replace(" ", "T");
  }

  if (ISO_WITH_TZ.test(input)) {
    const normalized = input.replace(" ", "T").replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
    return normalized.endsWith("z") ? normalized.slice(0, -1) + "Z" : normalized;
  }

  return input;
};

export const parseDateSafely = (value) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? new Date() : value;
  }

  const normalized = normalizeDateInput(value);
  if (!normalized) {
    return new Date();
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

export const formatDate = (value, locale = undefined, options = {}) => {
  const date = parseDateSafely(value);

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options
  }).format(date);
};

export const formatTime = (value, locale = undefined, options = {}) => {
  const date = parseDateSafely(value);

  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    ...options
  }).format(date);
};

export const formatDateTime = (value, locale = undefined, options = {}) => {
  const date = parseDateSafely(value);

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...options
  }).format(date);
};

export const formatTimelineDate = (value, locale = undefined, options = {}) => {
  return formatDateTime(value, locale, options);
};

export default {
  normalizeDateInput,
  parseDateSafely,
  formatDate,
  formatTime,
  formatDateTime,
  formatTimelineDate
};
