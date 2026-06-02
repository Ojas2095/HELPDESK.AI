/**
 * Tests for Frontend/src/services/translationService.js (Issue #1159)
 *
 * Tests SUPPORTED_LANGUAGES array structure and translateText() behavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock global fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// ---------------------------------------------------------------------------
// Import the module
// ---------------------------------------------------------------------------

let translateText;
let SUPPORTED_LANGUAGES;

beforeEach(async () => {
  vi.clearAllMocks();
  const mod = await import('../services/translationService.js');
  translateText = mod.translateText;
  SUPPORTED_LANGUAGES = mod.SUPPORTED_LANGUAGES;
});

// ---------------------------------------------------------------------------
// SUPPORTED_LANGUAGES array structure tests
// ---------------------------------------------------------------------------

describe('SUPPORTED_LANGUAGES structure', () => {
  it('is an array', () => {
    expect(Array.isArray(SUPPORTED_LANGUAGES)).toBe(true);
  });

  it('has at least 5 entries', () => {
    expect(SUPPORTED_LANGUAGES.length).toBeGreaterThanOrEqual(5);
  });

  it('each entry has a code property', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(lang).toHaveProperty('code');
    }
  });

  it('each entry has a label property', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(lang).toHaveProperty('label');
    }
  });

  it('each entry has a nativeName property', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(lang).toHaveProperty('nativeName');
    }
  });

  it('all codes are strings', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(typeof lang.code).toBe('string');
    }
  });

  it('all labels are strings', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(typeof lang.label).toBe('string');
    }
  });

  it('includes English (en)', () => {
    const english = SUPPORTED_LANGUAGES.find((l) => l.code === 'en');
    expect(english).toBeDefined();
  });

  it('includes Hindi (hi)', () => {
    const hindi = SUPPORTED_LANGUAGES.find((l) => l.code === 'hi');
    expect(hindi).toBeDefined();
  });

  it('includes French (fr)', () => {
    const french = SUPPORTED_LANGUAGES.find((l) => l.code === 'fr');
    expect(french).toBeDefined();
  });

  it('includes German (de)', () => {
    const german = SUPPORTED_LANGUAGES.find((l) => l.code === 'de');
    expect(german).toBeDefined();
  });

  it('includes Spanish (es)', () => {
    const spanish = SUPPORTED_LANGUAGES.find((l) => l.code === 'es');
    expect(spanish).toBeDefined();
  });

  it('all codes are non-empty strings', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(lang.code.length).toBeGreaterThan(0);
    }
  });

  it('no duplicate codes', () => {
    const codes = SUPPORTED_LANGUAGES.map((l) => l.code);
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(codes.length);
  });

  it('English nativeName is English', () => {
    const english = SUPPORTED_LANGUAGES.find((l) => l.code === 'en');
    if (english) {
      expect(english.nativeName).toBe('English');
    }
  });
});

// ---------------------------------------------------------------------------
// translateText() behavior tests
// ---------------------------------------------------------------------------

describe('translateText() function', () => {
  it('is a function', () => {
    expect(typeof translateText).toBe('function');
  });

  it('returns a Promise', () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ responseStatus: 200, responseData: { translatedText: 'Bonjour' } }),
    });
    const result = translateText('Hello', 'en', 'fr');
    expect(result).toBeInstanceOf(Promise);
  });

  it('returns original text when fromLang equals toLang', async () => {
    const text = 'Hello World';
    const result = await translateText(text, 'en', 'en');
    expect(result).toBe(text);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns original text when text is empty', async () => {
    const result = await translateText('', 'en', 'fr');
    expect(result).toBe('');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns original text when text is whitespace only', async () => {
    const result = await translateText('   ', 'en', 'fr');
    expect(result).toBe('   ');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns translated text on successful API response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ responseStatus: 200, responseData: { translatedText: 'Bonjour' } }),
    });
    const result = await translateText('Hello', 'en', 'fr');
    expect(result).toBe('Bonjour');
  });

  it('calls fetch with the correct URL pattern', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ responseStatus: 200, responseData: { translatedText: 'Hola' } }),
    });
    await translateText('Hello', 'en', 'es');
    expect(mockFetch).toHaveBeenCalled();
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('mymemory.translated.net');
  });

  it('includes langpair in the URL', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ responseStatus: 200, responseData: { translatedText: 'Hola' } }),
    });
    await translateText('Hello', 'en', 'es');
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('langpair=en%7Ces');
  });

  it('returns original text on API failure (non-200 response status)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ responseStatus: 403, responseDetails: 'API limit exceeded' }),
    });
    const result = await translateText('Hello', 'en', 'fr');
    expect(result).toBe('Hello');
  });

  it('returns original text when fetch throws an error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const result = await translateText('Hello', 'en', 'fr');
    expect(result).toBe('Hello');
  });

  it('returns original text when response is not ok', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    });
    const result = await translateText('Hello', 'en', 'fr');
    expect(result).toBe('Hello');
  });

  it('handles null text gracefully', async () => {
    const result = await translateText(null, 'en', 'fr');
    expect(result).toBeNull();
  });

  it('handles undefined text gracefully', async () => {
    const result = await translateText(undefined, 'en', 'fr');
    expect(result).toBeUndefined();
  });

  it('encodes special characters in URL', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ responseStatus: 200, responseData: { translatedText: 'result' } }),
    });
    await translateText('Hello & World!', 'en', 'fr');
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain(encodeURIComponent('Hello & World!'));
  });

  it('default fromLang is en', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ responseStatus: 200, responseData: { translatedText: 'Hola' } }),
    });
    await translateText('Hello', undefined, 'es');
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('en%7Ces');
  });

  it('default toLang is en', async () => {
    const result = await translateText('Hello', 'en', undefined);
    // fromLang === toLang (en === en) returns original
    expect(result).toBe('Hello');
  });
});
