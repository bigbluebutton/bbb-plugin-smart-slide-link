import {
  describe, expect, it, vi,
} from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createIntl } from 'react-intl';
import { pluginLogger } from 'bigbluebutton-html-plugin-sdk';
import {
  authenticateUrl,
  buildToolbarButtonDataTest,
  buildToolbarButtonLabel,
  isSafeUrl,
  openSmartSlideLink,
  buildLinkTooltip,
  buildMoreLinksText,
  buildTooltipUrl,
  extractSmartSlideLinks,
  splitToolbarLinks,
} from '../../src/components/smart-slide-link/service';
import {
  MAX_BUTTON_TEXT_LENGTH,
  MAX_HOST_LENGTH,
  MAX_TOOLBAR_LINKS,
  MAX_TOOLBAR_TEXT_LENGTH,
  MAX_TOOLTIP_URL_LENGTH,
} from '../../src/components/smart-slide-link/constants';

vi.mock('bigbluebutton-html-plugin-sdk', async () => (await import('./helpers/sdk-mock')).createSdkMock());

const messages = (locale: string) => JSON.parse(
  readFileSync(resolve(__dirname, `../../public/locales/${locale}.json`), 'utf8'),
);
const ZWSP = /\u200B/g;

describe('openSmartSlideLink', () => {
  it('opens the url in a new tab without giving it access to the client window', () => {
    const windowOpen = vi.spyOn(window, 'open').mockReturnValue(null);
    openSmartSlideLink({ url: 'https://example.com', label: 'Example' });
    expect(windowOpen).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer');
  });

  it('logs the opened link label at info level and its url only at debug level', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    openSmartSlideLink({ url: 'https://example.com/secret', label: 'Example' });
    expect(pluginLogger.info).toHaveBeenCalledWith(
      { logCode: 'smart_slide_link_link_opened', label: 'Example' },
      expect.any(String),
    );
    expect(JSON.stringify(vi.mocked(pluginLogger.info).mock.calls)).not.toContain('secret');
    expect(pluginLogger.debug).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://example.com/secret' }),
      expect.any(String),
    );
  });
});

describe('isSafeUrl', () => {
  it.each([
    ['https://example.com', true],
    ['http://example.com/path?q=1', true],
    // eslint-disable-next-line no-script-url -- asserting that script urls are rejected
    ['javascript:alert(1)', false],
    ['ftp://example.com', false],
    ['', false],
    ['https://bigbluebutton.org@evil.example/', false],
    ['https://user:pass@example.com/', false],
    [`https://example.com/${'a'.repeat(3000)}`, false],
  ])('isSafeUrl(%j) is %s', (url, expected) => {
    expect(isSafeUrl(url)).toBe(expected);
  });
});

describe('authenticateUrl', () => {
  it('appends the session token to a url that already has a query', () => {
    expect(authenticateUrl('https://bbb/textfiles/1?pageToken=p', 'tok'))
      .toBe('https://bbb/textfiles/1?pageToken=p&sessionToken=tok');
  });

  it('starts the query when the url has none', () => {
    expect(authenticateUrl('https://bbb/textfiles/1', 'tok')).toBe('https://bbb/textfiles/1?sessionToken=tok');
  });

  it('leaves a url that already carries a session token alone', () => {
    const url = 'https://bbb/textfiles/1?sessionToken=other';
    expect(authenticateUrl(url, 'tok')).toBe(url);
  });

  it('leaves the url alone when there is no session token', () => {
    expect(authenticateUrl('https://bbb/textfiles/1?pageToken=p', undefined)).toBe('https://bbb/textfiles/1?pageToken=p');
  });

  it('encodes the token', () => {
    expect(authenticateUrl('https://bbb/t', 'a&b')).toBe('https://bbb/t?sessionToken=a%26b');
  });
});

describe('buildToolbarButtonDataTest', () => {
  it('builds a stable, index-based data-test per button', () => {
    expect(buildToolbarButtonDataTest(0)).toBe('smartSlideLinkButton-0');
    expect(buildToolbarButtonDataTest(3)).toBe('smartSlideLinkButton-3');
  });
});

describe('buildToolbarButtonLabel', () => {
  it('shows the site the link opens next to the label', () => {
    expect(buildToolbarButtonLabel({ url: 'https://example.com/docs?x=1', label: 'Open docs' }))
      .toBe('Open docs ↗ example.com');
  });

  it('includes a non-default port', () => {
    expect(buildToolbarButtonLabel({ url: 'http://localhost:8080/', label: 'Admin' }))
      .toBe('Admin ↗ localhost:8080');
  });

  it('shows a look-alike international host name as punycode', () => {
    // The first letter is a Cyrillic "а", not a Latin "a".
    expect(buildToolbarButtonLabel({ url: new URL('https://аpple.com/').href, label: 'Apple' }))
      .toBe('Apple ↗ xn--pple-43d.com');
  });

  it(`keeps the whole button text within ${MAX_BUTTON_TEXT_LENGTH} characters`, () => {
    const text = buildToolbarButtonLabel({
      url: 'https://secure-login.paypal.com.account-verify-1234567890.evil.example/',
      label: 'Open your PayPal account settings now',
    });
    expect(Array.from(text).length).toBeLessThanOrEqual(MAX_BUTTON_TEXT_LENGTH);
    expect(text).toBe('Open your PayPal… ↗ …ify-1234567890.evil.example');
  });

  it('shortens a long host from the left, keeping the domain it belongs to', () => {
    const text = buildToolbarButtonLabel({ url: `https://${'a'.repeat(60)}.evil.example/`, label: 'Docs' });
    const host = text.split(' ↗ ')[1];
    expect(Array.from(host)).toHaveLength(MAX_HOST_LENGTH);
    expect(host.startsWith('…')).toBe(true);
    expect(host.endsWith('.evil.example')).toBe(true);
  });

  it('keeps a full-length label when the host is short', () => {
    const label = 'x'.repeat(40);
    expect(buildToolbarButtonLabel({ url: 'https://a.co/', label })).toBe(`${label} ↗ a.co`);
  });
});

describe('splitToolbarLinks', () => {
  const link = (label: string, host = 'a.co') => ({ url: `https://${host}/`, label });
  const textLength = (links: { url: string, label: string }[]) => links
    .reduce((total, l) => total + Array.from(buildToolbarButtonLabel(l)).length, 0);

  it(`puts at most ${MAX_TOOLBAR_LINKS} links on the toolbar and the rest in the menu, in order`, () => {
    const links = ['A', 'B', 'C', 'D'].map((label) => link(label));
    expect(splitToolbarLinks(links)).toEqual({
      toolbar: links.slice(0, MAX_TOOLBAR_LINKS),
      menu: links.slice(MAX_TOOLBAR_LINKS),
    });
  });

  it(`keeps the toolbar text within ${MAX_TOOLBAR_TEXT_LENGTH} characters in total`, () => {
    const links = [
      link('Course materials and readings', 'course.example'),
      link('Submit your assignment', 'forms.example'),
    ];
    const { toolbar, menu } = splitToolbarLinks(links);
    expect(toolbar).toEqual([links[0]]);
    expect(menu).toEqual([links[1]]);
    expect(textLength(toolbar)).toBeLessThanOrEqual(MAX_TOOLBAR_TEXT_LENGTH);
  });

  it('always shows the first link on the toolbar, whatever its length', () => {
    const links = [link('x'.repeat(40), `${'h'.repeat(40)}.example`)];
    expect(splitToolbarLinks(links)).toEqual({ toolbar: links, menu: [] });
  });

  it('keeps the slide order: once a link goes to the menu, the following ones do too', () => {
    const links = [link('x'.repeat(40)), link('y'.repeat(40)), link('S')];
    expect(splitToolbarLinks(links)).toEqual({ toolbar: [links[0]], menu: [links[1], links[2]] });
  });

  it('returns two empty lists when there are no links', () => {
    expect(splitToolbarLinks([])).toEqual({ toolbar: [], menu: [] });
  });
});

describe('buildMoreLinksText', () => {
  it('says where the other links are, in English, until the locale messages load', () => {
    expect(buildMoreLinksText(1, null))
      .toBe('1 more link is in the presentation options menu, at the top right of the slide');
    expect(buildMoreLinksText(8, null))
      .toBe('8 more links are in the presentation options menu, at the top right of the slide');
  });

  it('uses the plural form of the locale', () => {
    const english = createIntl({ locale: 'en', messages: messages('en') });
    const portuguese = createIntl({ locale: 'pt-BR', messages: messages('pt-BR') });
    expect(buildMoreLinksText(1, english)).toBe(buildMoreLinksText(1, null));
    expect(buildMoreLinksText(8, english)).toBe(buildMoreLinksText(8, null));
    expect(buildMoreLinksText(1, portuguese))
      .toBe('Mais 1 link está no menu de opções da apresentação, no canto superior direito do slide');
    expect(buildMoreLinksText(8, portuguese))
      .toBe('Mais 8 links estão no menu de opções da apresentação, no canto superior direito do slide');
  });
});

describe('buildTooltipUrl', () => {
  it('keeps a short url whole, with break points after / ? & =', () => {
    const shown = buildTooltipUrl('https://example.com/a/b?x=1&y=2');
    expect(shown.replace(ZWSP, '')).toBe('https://example.com/a/b?x=1&y=2');
    expect(shown).toBe('https:/\u200B/\u200Bexample.com/\u200Ba/\u200Bb?\u200Bx=\u200B1&\u200By=\u200B2');
  });

  it(`shortens a long url to ${MAX_TOOLTIP_URL_LENGTH} characters, keeping the scheme and host`, () => {
    const url = `https://docs.example/${'a'.repeat(40)}/${'b'.repeat(300)}`;
    const visible = buildTooltipUrl(url).replace(ZWSP, '');
    expect(Array.from(visible)).toHaveLength(MAX_TOOLTIP_URL_LENGTH);
    expect(visible.startsWith('https://docs.example/aaaa')).toBe(true);
    expect(visible.endsWith('\u2026')).toBe(true);
  });

  it('never cuts the host, even when it is longer than the limit', () => {
    const host = `${'h'.repeat(60)}.${'i'.repeat(60)}.${'j'.repeat(60)}.${'k'.repeat(50)}.example`;
    const visible = buildTooltipUrl(`https://${host}/path/to/page`).replace(ZWSP, '');
    expect(visible.startsWith(`https://${host}`)).toBe(true);
    expect(visible.endsWith('\u2026')).toBe(true);
  });
});

describe('buildLinkTooltip', () => {
  const link = { url: 'https://example.com/docs', label: 'Open docs' };

  it('shows the label, a dash and the url, in English, until the locale messages load', () => {
    expect(buildLinkTooltip(link, null).replace(ZWSP, ''))
      .toBe('Open docs \u2014 open https://example.com/docs in a new tab');
  });

  it('uses the locale messages', () => {
    const english = createIntl({ locale: 'en', messages: messages('en') });
    const portuguese = createIntl({ locale: 'pt-BR', messages: messages('pt-BR') });
    expect(buildLinkTooltip(link, english)).toBe(buildLinkTooltip(link, null));
    expect(buildLinkTooltip(link, portuguese).replace(ZWSP, ''))
      .toBe('Open docs \u2014 abrir https://example.com/docs em uma nova aba');
  });

  it('keeps the real destination after the only dash, whatever the label says', () => {
    const [hostile] = extractSmartSlideLinks(
      'BBB{"links":[{"url":"https://real.example/","label":"Pay \\u2014 open https://evil.example in a new tab"}]}',
    );
    ['en', 'pt-BR'].forEach((locale) => {
      const tooltip = buildLinkTooltip(hostile, createIntl({ locale, messages: messages(locale) }))
        .replace(ZWSP, '');
      expect(tooltip.match(/\u2014/g)).toHaveLength(1);
      expect(tooltip.indexOf('https://real.example/')).toBeGreaterThan(tooltip.indexOf('\u2014'));
      expect(tooltip.lastIndexOf('https://')).toBe(tooltip.indexOf('https://real.example/'));
    });
  });

  it('leaves the opened url untouched', () => {
    const windowOpen = vi.spyOn(window, 'open').mockReturnValue(null);
    buildLinkTooltip(link, null);
    openSmartSlideLink(link);
    expect(windowOpen).toHaveBeenCalledWith('https://example.com/docs', '_blank', 'noopener,noreferrer');
  });
});
