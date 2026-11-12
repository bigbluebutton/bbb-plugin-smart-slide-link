import {
  describe, expect, it, vi,
} from 'vitest';
import { pluginLogger } from 'bigbluebutton-html-plugin-sdk';
import {
  authenticateUrl,
  buildToolbarButtonDataTest,
  isSafeUrl,
  openSmartSlideLink,
} from '../../src/components/smart-slide-link/service';

vi.mock('bigbluebutton-html-plugin-sdk', async () => (await import('./helpers/sdk-mock')).createSdkMock());

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
