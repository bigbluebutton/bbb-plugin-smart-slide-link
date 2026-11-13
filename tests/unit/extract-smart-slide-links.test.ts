import {
  describe, expect, it, vi,
} from 'vitest';
import { extractSmartSlideLinks } from '../../src/components/smart-slide-link/service';

vi.mock('bigbluebutton-html-plugin-sdk', async () => (await import('./helpers/sdk-mock')).createSdkMock());

describe('extractSmartSlideLinks', () => {
  describe('happy path', () => {
    it('returns the links from a clean, single-line slide text', () => {
      const text = 'BBB{"links": [{"url":"https://www.google.com", "label":"Upgrade to BBB Premium"}]}';
      expect(extractSmartSlideLinks(text)).toEqual([{ url: 'https://www.google.com', label: 'Upgrade to BBB Premium' }]);
    });

    it('returns the links from a multiline slide where other text is interspersed with the JSON', () => {
      // The sanitizer discards everything outside of strings that is not a JSON structural
      // character ({, }, [, ], :, ,, "), so arbitrary text between keys and values is ignored.
      const text = [
        ' Enhance Your Learning',
        '     Experience',
        '',
        '  Wish to have BigBlueButton premium version?',
        '',
        '                  BBB{"links": [{"url":',
        '        Click the button below!',
        '          "https://www.google.com", "label":',
        '             "Upgrade to BBB Premium"}]}',
      ].join('\n');
      expect(extractSmartSlideLinks(text)).toEqual([{ url: 'https://www.google.com', label: 'Upgrade to BBB Premium' }]);
    });
  });

  describe('null / empty input', () => {
    it('returns [] for null', () => {
      expect(extractSmartSlideLinks(null)).toEqual([]);
    });

    it('returns [] for an empty string', () => {
      expect(extractSmartSlideLinks('')).toEqual([]);
    });
  });

  describe('BBB marker detection', () => {
    it('returns [] when the BBB marker is absent', () => {
      expect(extractSmartSlideLinks('some slide text')).toEqual([]);
    });

    it('returns [] when the BBB marker exists but no { follows', () => {
      expect(extractSmartSlideLinks('BBB no json here')).toEqual([]);
    });

    it('returns [] when non-whitespace text appears between BBB and {', () => {
      expect(extractSmartSlideLinks('BBB GARBAGE{"links":[]}')).toEqual([]);
    });

    it('accepts pure whitespace between BBB and {', () => {
      const text = 'BBB  {"links":[{"url":"https://example.com","label":"Example"}]}';
      expect(extractSmartSlideLinks(text)).toEqual([{ url: 'https://example.com', label: 'Example' }]);
    });

    it('finds the marker when it is embedded in surrounding text', () => {
      const text = 'Intro text BBB{"links":[{"url":"https://example.com","label":"Link"}]} end';
      expect(extractSmartSlideLinks(text)).toEqual([{ url: 'https://example.com', label: 'Link' }]);
    });

    it('finds the links when the word BBB also appears earlier in the slide prose', () => {
      const text = 'Welcome to BBB! Click below.\nBBB{"links":[{"url":"https://example.com","label":"Link"}]}';
      expect(extractSmartSlideLinks(text)).toEqual([{ url: 'https://example.com', label: 'Link' }]);
    });

    it('uses the first marker that is followed by a links JSON', () => {
      const text = 'BBB{"foo":1} BBB{"links":[{"url":"https://a.com","label":"A"}]} BBB{"links":[{"url":"https://b.com","label":"B"}]}';
      expect(extractSmartSlideLinks(text)).toEqual([{ url: 'https://a.com', label: 'A' }]);
    });
  });

  describe('valid link parsing', () => {
    it('parses multiple valid links in order', () => {
      const text = 'BBB{"links":[{"url":"https://a.com","label":"A"},{"url":"https://b.com","label":"B"}]}';
      expect(extractSmartSlideLinks(text)).toEqual([
        { url: 'https://a.com', label: 'A' },
        { url: 'https://b.com', label: 'B' },
      ]);
    });

    it('handles escaped double-quotes inside string values', () => {
      const text = 'BBB{"links":[{"url":"https://example.com","label":"Say \\"hi\\""}]}';
      expect(extractSmartSlideLinks(text)).toEqual([{ url: 'https://example.com', label: 'Say "hi"' }]);
    });

    it('strips literal newlines inside JSON string values', () => {
      const text = 'BBB{"links":[{"url":"https://example.com","label":"Line1\nLine2"}]}';
      expect(extractSmartSlideLinks(text)).toEqual([{ url: 'https://example.com', label: 'Line1Line2' }]);
    });
  });

  describe('invalid / incomplete JSON', () => {
    it.each([
      ['completely malformed JSON', 'BBB{not valid json}'],
      ['no links property', 'BBB{"foo":"bar"}'],
      ['links that is not an array', 'BBB{"links":"not-an-array"}'],
      ['an object that is never closed', 'BBB{"links":['],
      ['an empty links array', 'BBB{"links":[]}'],
      // Digits outside strings are dropped by the sanitizer, so "url": is left with no value.
      ['a numeric url', 'BBB{"links":[{"url":42,"label":"Example"}]}'],
    ])('returns [] for %s', (_case, text) => {
      expect(extractSmartSlideLinks(text)).toEqual([]);
    });
  });

  describe('link validation and filtering', () => {
    it('filters out entries with a missing url', () => {
      expect(extractSmartSlideLinks('BBB{"links":[{"label":"No url here"}]}')).toEqual([]);
    });

    it('filters out entries with a missing label', () => {
      expect(extractSmartSlideLinks('BBB{"links":[{"url":"https://example.com"}]}')).toEqual([]);
    });

    it('keeps valid entries and discards invalid ones from the same array', () => {
      const text = 'BBB{"links":[{"url":"https://good.com","label":"Good"},{"label":"No url"}]}';
      expect(extractSmartSlideLinks(text)).toEqual([{ url: 'https://good.com', label: 'Good' }]);
    });

    it.each([
      // eslint-disable-next-line no-script-url -- asserting that script urls are rejected
      ['javascript:', 'javascript:alert(document.cookie)'],
      ['data:', 'data:text/html,<script>alert(1)</script>'],
      ['vbscript:', 'vbscript:msgbox(1)'],
      ['file:', 'file:///etc/passwd'],
      ['a relative path', '/some/path'],
      ['an unparseable string', 'not a url'],
    ])('filters out entries whose url is %s', (_kind, url) => {
      const text = `BBB{"links":[{"url":${JSON.stringify(url)},"label":"Bad"}]}`;
      expect(extractSmartSlideLinks(text)).toEqual([]);
    });

    it('keeps http and https urls regardless of scheme case', () => {
      const text = 'BBB{"links":[{"url":"http://a.com","label":"A"},{"url":"HTTPS://b.com","label":"B"}]}';
      expect(extractSmartSlideLinks(text)).toEqual([
        { url: 'http://a.com', label: 'A' },
        { url: 'HTTPS://b.com', label: 'B' },
      ]);
    });
  });
});
