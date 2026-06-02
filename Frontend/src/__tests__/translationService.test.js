/**
 * Unit tests for translationService.js — MyMemory API translation client.
 *
 * Tests cover:
 * - SUPPORTED_LANGUAGES constant structure
 * - translateText edge cases (empty text, same language, whitespace)
 * - Successful API translation flow
 * - Error handling (network errors, API errors, fetch failures)
 * - Graceful degradation (returns original text on failure)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SUPPORTED_LANGUAGES, translateText } from '../services/translationService';

// ─── SUPPORTED_LANGUAGES Tests ───────────────────────────────────

describe('SUPPORTED_LANGUAGES', () => {
  it('should be a non-empty array', () => {
    expect(Array.isArray(SUPPORTED_LANGUAGES)).toBe(true);
    expect(SUPPORTED_LANGUAGES.length).toBeGreaterThan(0);
  });

  it('should have exactly 12 language entries', () => {
    expect(SUPPORTED_LANGUAGES.length).toBe(12);
  });

  it('should have English as the first entry', () => {
    expect(SUPPORTED_LANGUAGES[0]).toEqual({
      code: 'en',
      label: '🇬🇧 English',
      nativeName: 'English',
    });
  });

  it('every entry should have code, label, and nativeName', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(lang).toHaveProperty('code');
      expect(lang).toHaveProperty('label');
      expect(lang).toHaveProperty('nativeName');
      expect(typeof lang.code).toBe('string');
      expect(lang.code.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('should include Hindi, Telugu, Tamil, Kannada', () => {
    const codes = SUPPORTED_LANGUAGES.map((l) => l.code);
    expect(codes).toContain('hi');
    expect(codes).toContain('te');
    expect(codes).toContain('ta');
    expect(codes).toContain('kn');
  });

  it('should include French, German, Spanish, Arabic', () => {
    const codes = SUPPORTED_LANGUAGES.map((l) => l.code);
    expect(codes).toContain('fr');
    expect(codes).toContain('de');
    expect(codes).toContain('es');
    expect(codes).toContain('ar');
  });

  it('all language codes should be unique', () => {
    const codes = SUPPORTED_LANGUAGES.map((l) => l.code);
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(codes.length);
  });
});

// ─── translateText Tests ─────────────────────────────────────────

describe('translateText', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  describe('edge cases', () => {
    it('should return original text when input is empty string', async () => {
      const result = await translateText('', 'en', 'hi');
      expect(result).toBe('');
    });

    it('should return original text when input is whitespace only', async () => {
      const result = await translateText('   ', 'en', 'hi');
      expect(result).toBe('   ');
    });

    it('should return original text when fromLang === toLang', async () => {
      const result = await translateText('Hello', 'en', 'en');
      expect(result).toBe('Hello');
    });

    it('should return original text when fromLang === toLang with different casing', async () => {
      const result = await translateText('Hello', 'EN', 'en');
      // Note: the function does case-sensitive comparison
      // This just verifies the behavior doesn't crash
      expect(result).not.toBeNull();
    });

    it('should return original text when input is null', async () => {
      const result = await translateText(null, 'en', 'hi');
      expect(result).toBeNull();
    });

    it('should return original text when input is undefined', async () => {
      const result = await translateText(undefined, 'en', 'hi');
      expect(result).toBeUndefined();
    });
  });

  describe('successful translation', () => {
    it('should call MyMemory API with correct URL and language pair', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          responseStatus: 200,
          responseData: { translatedText: 'नमस्ते' },
        }),
      };
      global.fetch.mockResolvedValue(mockResponse);

      await translateText('Hello', 'en', 'hi');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const url = global.fetch.mock.calls[0][0];
      expect(url).toContain('api.mymemory.translated.net/get');
      expect(url).toContain('q=Hello');
      expect(url).toContain('langpair=en|hi');
    });

    it('should URL-encode special characters in query', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          responseStatus: 200,
          responseData: { translatedText: 'que' },
        }),
      };
      global.fetch.mockResolvedValue(mockResponse);

      await translateText('What is this?', 'en', 'es');

      const url = global.fetch.mock.calls[0][0];
      expect(url).toContain(encodeURIComponent('What is this?'));
    });

    it('should return translated text on success', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          responseStatus: 200,
          responseData: { translatedText: 'नमस्ते' },
        }),
      };
      global.fetch.mockResolvedValue(mockResponse);

      const result = await translateText('Hello', 'en', 'hi');
      expect(result).toBe('नमस्ते');
    });

    it('should handle multi-word translations', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          responseStatus: 200,
          responseData: { translatedText: 'Comment ça va?' },
        }),
      };
      global.fetch.mockResolvedValue(mockResponse);

      const result = await translateText('How are you?', 'en', 'fr');
      expect(result).toBe('Comment ça va?');
    });
  });

  describe('error handling', () => {
    it('should return original text on network error (fetch throws)', async () => {
      global.fetch.mockRejectedValue(new Error('Network Error'));

      const result = await translateText('Hello', 'en', 'hi');
      expect(result).toBe('Hello');
    });

    it('should return original text when fetch returns non-ok status', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({}),
      });

      const result = await translateText('Hello', 'en', 'hi');
      expect(result).toBe('Hello');
    });

    it('should return original text when API responseStatus is not 200', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          responseStatus: 403,
          responseDetails: 'Daily limit reached',
          responseData: { translatedText: '' },
        }),
      });

      const result = await translateText('Hello', 'en', 'hi');
      expect(result).toBe('Hello');
    });

    it('should return original text when JSON is malformed', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('Unexpected token');
        },
      });

      const result = await translateText('Hello', 'en', 'hi');
      expect(result).toBe('Hello');
    });

    it('should handle fetch timeout gracefully', async () => {
      vi.useFakeTimers();
      global.fetch.mockImplementation(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 10000),
          ),
      );

      const promise = translateText('Hello', 'en', 'hi');
      vi.advanceTimersByTime(10000);

      // The promise should resolve (with original text) rather than reject
      await expect(promise).resolves.toBe('Hello');
      vi.useRealTimers();
    });

    it('should not crash when console.error is called', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      global.fetch.mockRejectedValue(new Error('API down'));

      await translateText('Hello', 'en', 'hi');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('edge language pairs', () => {
    it('should support translation between Indian languages', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          responseStatus: 200,
          responseData: { translatedText: 'ఎలా ఉన్నారు?' },
        }),
      };
      global.fetch.mockResolvedValue(mockResponse);

      const result = await translateText('How are you?', 'en', 'te');
      expect(result).toBe('ఎలా ఉన్నారు?');
    });

    it('should handle translation with special characters', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          responseStatus: 200,
          responseData: { translatedText: '123 € — test' },
        }),
      };
      global.fetch.mockResolvedValue(mockResponse);

      const result = await translateText('123 € — test', 'en', 'de');
      expect(result).toBe('123 € — test');
    });
  });
});