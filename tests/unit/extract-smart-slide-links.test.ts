import {
  describe, expect, it, vi,
} from 'vitest';
import {
  MAX_JSON_SCAN_LENGTH,
  MAX_LABEL_LENGTH,
  MAX_LINKS,
  MAX_MARKER_ATTEMPTS,
  MAX_SLIDE_TEXT_LENGTH,
  MAX_URL_LENGTH,
} from '../../src/components/smart-slide-link/constants';
import { extractSmartSlideLinks, sanitizeLabel } from '../../src/components/smart-slide-link/service';

vi.mock('bigbluebutton-html-plugin-sdk', async () => (await import('./helpers/sdk-mock')).createSdkMock());

describe('extractSmartSlideLinks', () => {
  describe('happy path', () => {
    it('returns the links from a clean, single-line slide text', () => {
      const text = 'BBB{"links": [{"url":"https://www.google.com", "label":"Upgrade to BBB Premium"}]}';
      expect(extractSmartSlideLinks(text)).toEqual([{ url: 'https://www.google.com/', label: 'Upgrade to BBB Premium' }]);
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
      expect(extractSmartSlideLinks(text)).toEqual([{ url: 'https://www.google.com/', label: 'Upgrade to BBB Premium' }]);
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
      expect(extractSmartSlideLinks(text)).toEqual([{ url: 'https://example.com/', label: 'Example' }]);
    });

    it('finds the marker when it is embedded in surrounding text', () => {
      const text = 'Intro text BBB{"links":[{"url":"https://example.com","label":"Link"}]} end';
      expect(extractSmartSlideLinks(text)).toEqual([{ url: 'https://example.com/', label: 'Link' }]);
    });

    it('finds the links when the word BBB also appears earlier in the slide prose', () => {
      const text = 'Welcome to BBB! Click below.\nBBB{"links":[{"url":"https://example.com","label":"Link"}]}';
      expect(extractSmartSlideLinks(text)).toEqual([{ url: 'https://example.com/', label: 'Link' }]);
    });

    it('uses the first marker that is followed by a links JSON', () => {
      const text = 'BBB{"foo":1} BBB{"links":[{"url":"https://a.com","label":"A"}]} BBB{"links":[{"url":"https://b.com","label":"B"}]}';
      expect(extractSmartSlideLinks(text)).toEqual([{ url: 'https://a.com/', label: 'A' }]);
    });
  });

  describe('valid link parsing', () => {
    it('parses multiple valid links in order', () => {
      const text = 'BBB{"links":[{"url":"https://a.com","label":"A"},{"url":"https://b.com","label":"B"}]}';
      expect(extractSmartSlideLinks(text)).toEqual([
        { url: 'https://a.com/', label: 'A' },
        { url: 'https://b.com/', label: 'B' },
      ]);
    });

    it('handles escaped double-quotes inside string values', () => {
      const text = 'BBB{"links":[{"url":"https://example.com","label":"Say \\"hi\\""}]}';
      expect(extractSmartSlideLinks(text)).toEqual([{ url: 'https://example.com/', label: 'Say "hi"' }]);
    });

    it('strips literal newlines inside JSON string values', () => {
      const text = 'BBB{"links":[{"url":"https://example.com","label":"Line1\nLine2"}]}';
      expect(extractSmartSlideLinks(text)).toEqual([{ url: 'https://example.com/', label: 'Line1Line2' }]);
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
      expect(extractSmartSlideLinks(text)).toEqual([{ url: 'https://good.com/', label: 'Good' }]);
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
        { url: 'http://a.com/', label: 'A' },
        { url: 'https://b.com/', label: 'B' },
      ]);
    });
  });

  describe('deceptive links', () => {
    it.each([
      ['a user name', 'https://bigbluebutton.org@evil.example/'],
      ['a user name and password', 'https://user:pass@evil.example/'],
    ])('filters out entries whose url carries %s', (_kind, url) => {
      const text = `BBB{"links":[{"url":"${url}","label":"Docs"}]}`;
      expect(extractSmartSlideLinks(text)).toEqual([]);
    });

    it('returns the url in its normalized form', () => {
      const text = 'BBB{"links":[{"url":"HTTPS://Example.COM/a b","label":"A"}]}';
      expect(extractSmartSlideLinks(text)).toEqual([{ url: 'https://example.com/a%20b', label: 'A' }]);
    });

    it('filters out entries whose url is longer than the limit', () => {
      const url = `https://example.com/${'a'.repeat(MAX_URL_LENGTH)}`;
      expect(extractSmartSlideLinks(`BBB{"links":[{"url":"${url}","label":"Long"}]}`)).toEqual([]);
    });

    it('removes bidirectional and invisible characters from the label', () => {
      const text = 'BBB{"links":[{"url":"https://example.com","label":"Next\u202E edils\u200B"}]}';
      expect(extractSmartSlideLinks(text)).toEqual([{ url: 'https://example.com/', label: 'Next edils' }]);
    });

    it('filters out entries whose label is empty once cleaned', () => {
      const text = 'BBB{"links":[{"url":"https://example.com","label":" \u200B\u202E "}]}';
      expect(extractSmartSlideLinks(text)).toEqual([]);
    });
  });

  describe('limits on untrusted slide text', () => {
    const link = (i: number) => `{"url":"https://example.com/${i}","label":"L${i}"}`;

    it(`keeps only the first ${MAX_LINKS} valid links`, () => {
      const entries = Array.from({ length: MAX_LINKS + 5 }, (_, i) => link(i));
      // An invalid entry does not use up one of the slots.
      entries.unshift('{"label":"No url"}');
      const links = extractSmartSlideLinks(`BBB{"links":[${entries.join(',')}]}`);
      expect(links).toHaveLength(MAX_LINKS);
      expect(links[0].label).toBe('L0');
      expect(links[MAX_LINKS - 1].label).toBe(`L${MAX_LINKS - 1}`);
    });

    it('truncates a long label', () => {
      const text = `BBB{"links":[{"url":"https://example.com","label":"${'x'.repeat(500)}"}]}`;
      const [{ label }] = extractSmartSlideLinks(text);
      expect(label).toBe(`${'x'.repeat(MAX_LABEL_LENGTH)}…`);
    });

    it('ignores a links JSON that starts beyond the slide text limit', () => {
      const text = `${' '.repeat(MAX_SLIDE_TEXT_LENGTH)}BBB{"links":[${link(1)}]}`;
      expect(extractSmartSlideLinks(text)).toEqual([]);
    });

    it('gives up on a JSON that does not close within the scan limit', () => {
      const text = `BBB{"links":[${' '.repeat(MAX_JSON_SCAN_LENGTH)}${link(1)}]}`;
      expect(extractSmartSlideLinks(text)).toEqual([]);
    });

    it(`stops after ${MAX_MARKER_ATTEMPTS} markers that are not followed by a links JSON`, () => {
      const text = `${'BBB{"foo":"bar"} '.repeat(MAX_MARKER_ATTEMPTS)}BBB{"links":[${link(1)}]}`;
      expect(extractSmartSlideLinks(text)).toEqual([]);
    });

    it('does not count a marker word in the prose as an attempt', () => {
      const text = `${'BBB is great. '.repeat(MAX_MARKER_ATTEMPTS * 5)}BBB{"links":[${link(1)}]}`;
      expect(extractSmartSlideLinks(text)).toEqual([{ url: 'https://example.com/1', label: 'L1' }]);
    });

    it.each([
      ['unclosed objects', 'BBB{'],
      ['marker words', 'BBB '],
      ['unclosed strings', 'BBB{"'],
      ['markers followed by whitespace', `BBB${' '.repeat(50)}`],
    ])('handles a slide made of repeated %s quickly', (_kind, unit) => {
      const text = unit.repeat(Math.ceil((MAX_SLIDE_TEXT_LENGTH * 10) / unit.length));
      const start = performance.now();
      expect(extractSmartSlideLinks(text)).toEqual([]);
      // Unbounded, the first case takes minutes; bounded, all of them take a few milliseconds.
      expect(performance.now() - start).toBeLessThan(500);
    });
  });
});

describe('sanitizeLabel', () => {
  it.each([
    ['Open docs', 'Open docs'],
    ['  padded \t label  ', 'padded label'],
    ['Line1\r\nLine2', 'Line1 Line2'],
    ['evil\u202Elive', 'evil live'],
    ['\u0000\u200F', ''],
    ['Olá, mundo — ✓', 'Olá, mundo — ✓'],
  ])('sanitizeLabel(%j) is %j', (label, expected) => {
    expect(sanitizeLabel(label)).toBe(expected);
  });

  it('counts characters, not UTF-16 units, when truncating', () => {
    const label = '😀'.repeat(MAX_LABEL_LENGTH + 1);
    expect(sanitizeLabel(label)).toBe(`${'😀'.repeat(MAX_LABEL_LENGTH)}…`);
  });
});
