import { renderHook } from '@testing-library/react';
import useSmartSlideLinks from './use-smart-slide-links';

// The internal helpers (extractBbbJson, sanitizeAndCollectJsonString, isSmartSlideLink)
// are covered via the hook's public interface below.

describe('useSmartSlideLinks', () => {
  describe('happy path - simple structure', () => {
    it('returns the correct links from a clean, single-line slide text', () => {
      const text = 'BBB{"links": [{"url":"https://www.google.com", "label":"Upgrade to BBB Premium"}]}';
      const { result } = renderHook(() => useSmartSlideLinks(text));
      expect(result.current).toEqual([{ url: 'https://www.google.com', label: 'Upgrade to BBB Premium' }]);
    });
  });

  describe('happy path - complex structure', () => {
    it('returns the correct links from a multiline slide where extraneous text is interspersed with the JSON', () => {
      // The sanitizer discards everything outside of strings that is not a JSON structural
      // character ({, }, [, ], :, ,, "), so arbitrary text between keys and values is ignored.
      const text = [
        ' Enhance Your Learning',
        '     Experience',
        '',
        '  Wish to have BigBlueButton premium version?',
        '',
        '',
        '',
        '                  BBB{"links": [{"url":',
        '        Click the button below!',
        '          "https://www.google.com", "label":',
        '             "Upgrade to BBB Premium"}]}',
      ].join('\n');
      const { result } = renderHook(() => useSmartSlideLinks(text));
      expect(result.current).toEqual([{ url: 'https://www.google.com', label: 'Upgrade to BBB Premium' }]);
    });
  });

  describe('null / empty input', () => {
    it('returns [] for null', () => {
      const { result } = renderHook(() => useSmartSlideLinks(null));
      expect(result.current).toEqual([]);
    });

    it('returns [] for empty string', () => {
      const { result } = renderHook(() => useSmartSlideLinks(''));
      expect(result.current).toEqual([]);
    });
  });

  describe('BBB marker detection', () => {
    it('returns [] when the BBB marker is absent', () => {
      const { result } = renderHook(() => useSmartSlideLinks('some slide text'));
      expect(result.current).toEqual([]);
    });

    it('returns [] when BBB marker exists but no { follows', () => {
      const { result } = renderHook(() => useSmartSlideLinks('BBB no json here'));
      expect(result.current).toEqual([]);
    });

    it('returns [] when non-whitespace text appears between BBB and {', () => {
      // sanitizeAndCollectJsonString rejects if slice between marker and { is non-empty after trim
      const { result } = renderHook(() => useSmartSlideLinks('BBB GARBAGE{"links":[]}'));
      expect(result.current).toEqual([]);
    });

    it('accepts pure whitespace between BBB and {', () => {
      const text = 'BBB  {"links":[{"url":"https://example.com","label":"Example"}]}';
      const { result } = renderHook(() => useSmartSlideLinks(text));
      expect(result.current).toEqual([{ url: 'https://example.com', label: 'Example' }]);
    });

    it('finds the marker when it is embedded in surrounding text', () => {
      const text = 'Intro text BBB{"links":[{"url":"https://example.com","label":"Link"}]} end';
      const { result } = renderHook(() => useSmartSlideLinks(text));
      expect(result.current).toEqual([{ url: 'https://example.com', label: 'Link' }]);
    });
  });

  describe('valid link parsing', () => {
    it('parses a single valid link', () => {
      const text = 'BBB{"links":[{"url":"https://example.com","label":"Example"}]}';
      const { result } = renderHook(() => useSmartSlideLinks(text));
      expect(result.current).toEqual([{ url: 'https://example.com', label: 'Example' }]);
    });

    it('parses multiple valid links in order', () => {
      const text = 'BBB{"links":[{"url":"https://a.com","label":"A"},{"url":"https://b.com","label":"B"}]}';
      const { result } = renderHook(() => useSmartSlideLinks(text));
      expect(result.current).toEqual([
        { url: 'https://a.com', label: 'A' },
        { url: 'https://b.com', label: 'B' },
      ]);
    });

    it('handles escaped double-quotes inside string values', () => {
      // \" inside a JSON string value is preserved by the sanitizer
      const text = 'BBB{"links":[{"url":"https://example.com","label":"Say \\"hi\\""}]}';
      const { result } = renderHook(() => useSmartSlideLinks(text));
      expect(result.current).toEqual([{ url: 'https://example.com', label: 'Say "hi"' }]);
    });

    it('strips literal newlines inside JSON string values', () => {
      // The sanitizer skips \r and \n inside strings, so they are removed from the output
      const text = 'BBB{"links":[{"url":"https://example.com","label":"Line1\nLine2"}]}';
      const { result } = renderHook(() => useSmartSlideLinks(text));
      expect(result.current).toEqual([{ url: 'https://example.com', label: 'Line1Line2' }]);
    });
  });

  describe('invalid / incomplete JSON', () => {
    it('returns [] for completely malformed JSON', () => {
      const { result } = renderHook(() => useSmartSlideLinks('BBB{not valid json}'));
      expect(result.current).toEqual([]);
    });

    it('returns [] when the links property is absent', () => {
      const { result } = renderHook(() => useSmartSlideLinks('BBB{"foo":"bar"}'));
      expect(result.current).toEqual([]);
    });

    it('returns [] when links is not an array', () => {
      const { result } = renderHook(() => useSmartSlideLinks('BBB{"links":"not-an-array"}'));
      expect(result.current).toEqual([]);
    });

    it('returns [] when the JSON object is never closed', () => {
      const { result } = renderHook(() => useSmartSlideLinks('BBB{"links":['));
      expect(result.current).toEqual([]);
    });

    it('returns [] when links is an empty array', () => {
      const { result } = renderHook(() => useSmartSlideLinks('BBB{"links":[]}'));
      expect(result.current).toEqual([]);
    });
  });

  describe('link validation and filtering', () => {
    it('filters out entries with a missing url', () => {
      const text = 'BBB{"links":[{"label":"No url here"}]}';
      const { result } = renderHook(() => useSmartSlideLinks(text));
      expect(result.current).toEqual([]);
    });

    it('filters out entries with a missing label', () => {
      const text = 'BBB{"links":[{"url":"https://example.com"}]}';
      const { result } = renderHook(() => useSmartSlideLinks(text));
      expect(result.current).toEqual([]);
    });

    it('keeps valid entries and discards invalid ones from the same array', () => {
      const text = 'BBB{"links":[{"url":"https://good.com","label":"Good"},{"label":"No url"}]}';
      const { result } = renderHook(() => useSmartSlideLinks(text));
      expect(result.current).toEqual([{ url: 'https://good.com', label: 'Good' }]);
    });

    it('returns [] when a link url is a number (sanitizer strips it, producing invalid JSON)', () => {
      // The custom sanitizer only collects specific chars outside strings;
      // numeric digits are dropped, leaving "url": with no value → JSON.parse throws.
      const text = 'BBB{"links":[{"url":42,"label":"Example"}]}';
      const { result } = renderHook(() => useSmartSlideLinks(text));
      expect(result.current).toEqual([]);
    });
  });

  describe('memoization', () => {
    it('returns the same array reference when input has not changed', () => {
      const text = 'BBB{"links":[{"url":"https://example.com","label":"Example"}]}';
      const { result, rerender } = renderHook(({ t }) => useSmartSlideLinks(t), {
        initialProps: { t: text },
      });
      const firstRef = result.current;
      rerender({ t: text });
      expect(result.current).toBe(firstRef);
    });

    it('recomputes when input changes from null to a valid string', () => {
      const { result, rerender } = renderHook(({ t }) => useSmartSlideLinks(t), {
        initialProps: { t: null as string | null },
      });
      expect(result.current).toEqual([]);

      rerender({ t: 'BBB{"links":[{"url":"https://example.com","label":"Example"}]}' });
      expect(result.current).toEqual([{ url: 'https://example.com', label: 'Example' }]);
    });

    it('recomputes when slide text changes to a different slide', () => {
      const { result, rerender } = renderHook(({ t }) => useSmartSlideLinks(t), {
        initialProps: { t: 'BBB{"links":[{"url":"https://a.com","label":"A"}]}' },
      });
      expect(result.current).toEqual([{ url: 'https://a.com', label: 'A' }]);

      rerender({ t: 'BBB{"links":[{"url":"https://b.com","label":"B"}]}' });
      expect(result.current).toEqual([{ url: 'https://b.com', label: 'B' }]);
    });
  });
});
