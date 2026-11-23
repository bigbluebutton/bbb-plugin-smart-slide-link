import { pluginLogger } from 'bigbluebutton-html-plugin-sdk';
import { IntlShape } from 'react-intl';
import { LOG_CODES } from '../../commons/constants';
import {
  ALLOWED_PROTOCOLS,
  BBB_MARKER,
  EXTERNAL_LINK_SEPARATOR,
  LABEL_ELLIPSIS,
  LINK_TARGET,
  LINK_WINDOW_FEATURES,
  MAX_BUTTON_TEXT_LENGTH,
  MAX_HOST_LENGTH,
  MAX_JSON_SCAN_LENGTH,
  MAX_LABEL_LENGTH,
  MAX_LINKS,
  MAX_MARKER_ATTEMPTS,
  MAX_SLIDE_TEXT_LENGTH,
  MAX_TOOLBAR_LINKS,
  MAX_TOOLBAR_TEXT_LENGTH,
  MAX_TOOLTIP_URL_LENGTH,
  MAX_URL_LENGTH,
  MENU_ITEM_DATA_TEST_PREFIX,
  SESSION_TOKEN_PARAM,
  TOOLBAR_BUTTON_DATA_TEST_PREFIX,
  URL_BREAK_AFTER,
  WORD_BREAK,
} from './constants';
import intlMessages from './intl-messages';
import { SmartSlideLink } from './types';

const WHITESPACE = /\s/;

/** Returns the index of the `{` that follows `afterMarker`, with only whitespace between. */
function findJsonStart(text: string, afterMarker: number): number {
  let i = afterMarker;
  while (i < text.length && WHITESPACE.test(text[i])) i += 1;
  return text[i] === '{' ? i : -1;
}

/**
 * Collects the JSON object that starts at `jsonStart`, keeping string contents and JSON
 * structural characters only. Text extracted from a slide interleaves the JSON with other
 * slide text, so anything outside a string that is not structural is dropped. Gives up after
 * MAX_JSON_SCAN_LENGTH characters so an object that never closes costs a bounded scan.
 */
function sanitizeAndCollectJsonString(text: string, jsonStart: number): string | null {
  const scanEnd = Math.min(text.length, jsonStart + MAX_JSON_SCAN_LENGTH);
  let result = '';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = jsonStart; i < scanEnd; i += 1) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        result += ch;
        escaped = false;
      } else if (ch === '\\') {
        result += ch;
        escaped = true;
      } else if (ch === '"') {
        result += ch;
        inString = false;
      } else if (ch !== '\r' && ch !== '\n') {
        result += ch;
      }
    } else {
      switch (ch) {
        case '"': inString = true; result += ch; break;
        case '{': depth += 1; result += ch; break;
        case '}':
          depth -= 1;
          result += ch;
          if (depth === 0) return result;
          break;
        case '[':
        case ']':
        case ':':
        case ',':
          result += ch;
          break;
        default: break;
      }
    }
  }
  return null;
}

function parseSafeUrl(url: string): URL | null {
  if (url.length > MAX_URL_LENGTH) return null;
  try {
    const parsed = new URL(url);
    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) return null;
    // `https://trusted.example@evil.example/` opens evil.example: credentials in a link are
    // only ever useful to disguise where it goes.
    if (parsed.username || parsed.password) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function isSafeUrl(url: string): boolean {
  return parseSafeUrl(url) !== null;
}

// Characters that can make a label render as something other than what it says: controls,
// format characters (bidirectional overrides, tag characters, zero-width space...), private
// use and unassigned code points, plus the fillers that render as blank. The zero-width
// joiner and non-joiner are kept: composed emoji and several scripts need them.
const UNSAFE_LABEL_CHARS = /(?![\u200C\u200D])[\p{Cc}\p{Cf}\p{Co}\p{Cn}\u034F\u115F\u1160\u180E\u3164\uFFA0]/gu;

// Arrows (Arrows, Supplemental Arrows-A/B, Dingbat arrows, Miscellaneous Symbols and Arrows).
// A button shows "<label> ↗ <host>", so a label holding an arrow could fake that form and
// show a made-up destination before the real one.
const ARROW_CHARS = /[\u2190-\u21FF\u2794-\u27BF\u27F0-\u27FF\u2900-\u297F\u2B00-\u2BFF]/gu;

// En and em dashes. A button's tooltip shows "<label> — open <url> in a new tab", so a label
// holding a dash could fake that form and show a made-up destination before the real one.
const DASH_SEPARATOR_CHARS = /[\u2013\u2014]/gu;

/** Shortens text to at most `max` characters, keeping its start. */
function truncateEnd(text: string, max: number): string {
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  return `${chars.slice(0, max - 1).join('').trimEnd()}${LABEL_ELLIPSIS}`;
}

/** Shortens text to at most `max` characters, keeping its end. */
function truncateStart(text: string, max: number): string {
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  return `${LABEL_ELLIPSIS}${chars.slice(chars.length - (max - 1)).join('')}`;
}

/** Returns the label as plain, single-spaced text of at most MAX_LABEL_LENGTH characters. */
export function sanitizeLabel(label: string): string {
  const clean = label
    .replace(UNSAFE_LABEL_CHARS, ' ')
    .replace(ARROW_CHARS, ' ')
    .replace(DASH_SEPARATOR_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const chars = Array.from(clean);
  if (chars.length <= MAX_LABEL_LENGTH) return clean;
  return `${chars.slice(0, MAX_LABEL_LENGTH).join('').trimEnd()}${LABEL_ELLIPSIS}`;
}

/**
 * Returns the link in the form the plugin uses it, or null when it is not a safe link: the url
 * is the parser's normalized form, so what is validated, shown and opened is the same string.
 */
function toSmartSlideLink(value: unknown): SmartSlideLink | null {
  if (typeof value !== 'object' || value === null) return null;
  const { url, label } = value as Partial<SmartSlideLink>;
  if (typeof url !== 'string' || typeof label !== 'string') return null;

  const safeUrl = parseSafeUrl(url);
  const safeLabel = sanitizeLabel(label);
  if (!safeUrl || !safeLabel) return null;
  return { url: safeUrl.href, label: safeLabel };
}

function parseLinks(jsonString: string): SmartSlideLink[] | null {
  try {
    const parsed = JSON.parse(jsonString);
    if (!Array.isArray(parsed?.links)) return null;
    const links: SmartSlideLink[] = [];
    for (let i = 0; i < parsed.links.length && links.length < MAX_LINKS; i += 1) {
      const link = toSmartSlideLink(parsed.links[i]);
      if (link) links.push(link);
    }
    return links;
  } catch {
    return null;
  }
}

/**
 * Returns the links declared on a slide. The marker is a plain word that can also appear in
 * the slide's prose ("Welcome to BBB!"), so every occurrence is tried until one is followed
 * by a links JSON. The text is untrusted: only its first MAX_SLIDE_TEXT_LENGTH characters are
 * read and at most MAX_MARKER_ATTEMPTS candidate JSONs are scanned.
 */
export function extractSmartSlideLinks(text: string | null): SmartSlideLink[] {
  if (!text) return [];
  const slideText = text.slice(0, MAX_SLIDE_TEXT_LENGTH);

  let attempts = 0;
  let markerIndex = slideText.indexOf(BBB_MARKER);
  while (markerIndex !== -1 && attempts < MAX_MARKER_ATTEMPTS) {
    const jsonStart = findJsonStart(slideText, markerIndex + BBB_MARKER.length);
    if (jsonStart !== -1) {
      attempts += 1;
      const jsonString = sanitizeAndCollectJsonString(slideText, jsonStart);
      const links = jsonString ? parseLinks(jsonString) : null;
      if (links) return links;
    }
    markerIndex = slideText.indexOf(BBB_MARKER, markerIndex + BBB_MARKER.length);
  }
  return [];
}

/**
 * BBB 4.0 serves a slide's files only to requests carrying the user's session token. The urls
 * from `useCurrentPresentation` come without it (core adds it with `Auth.authenticateURL`),
 * so the plugin adds it the same way.
 */
export function authenticateUrl(url: string, sessionToken: string | undefined): string {
  if (!sessionToken || url.includes(`${SESSION_TOKEN_PARAM}=`)) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${SESSION_TOKEN_PARAM}=${encodeURIComponent(sessionToken)}`;
}

export function buildToolbarButtonDataTest(index: number): string {
  return `${TOOLBAR_BUTTON_DATA_TEST_PREFIX}-${index}`;
}

export function buildMenuItemDataTest(index: number): string {
  return `${MENU_ITEM_DATA_TEST_PREFIX}-${index}`;
}

/**
 * Label of a link's toolbar button or menu item: the slide's label followed by the site the
 * link opens. The label is written by whoever authored the slide, possibly in text the
 * presenter cannot see, so the real destination is always shown next to it. `host` is the
 * parser's form of the host, so look-alike international names show as punycode. The text is
 * at most MAX_BUTTON_TEXT_LENGTH characters: a long host is shortened from the left, keeping
 * the domain it belongs to, and the label gets the room left.
 */
export function buildToolbarButtonLabel({ url, label }: SmartSlideLink): string {
  const host = truncateStart(new URL(url).host, MAX_HOST_LENGTH);
  const separator = ` ${EXTERNAL_LINK_SEPARATOR} `;
  const labelRoom = MAX_BUTTON_TEXT_LENGTH - Array.from(host).length - separator.length;
  return `${truncateEnd(label, labelRoom)}${separator}${host}`;
}

/**
 * Splits the links between the presentation toolbar and the presentation menu. The toolbar
 * takes links in slide order while there are fewer than MAX_TOOLBAR_LINKS and their button
 * texts add up to at most MAX_TOOLBAR_TEXT_LENGTH characters (the first link always fits);
 * from the first link that does not fit on, every link goes to the menu, keeping the order.
 */
export function splitToolbarLinks(links: SmartSlideLink[]): {
  toolbar: SmartSlideLink[];
  menu: SmartSlideLink[];
} {
  let textLength = 0;
  let fitting = 0;
  while (fitting < links.length && fitting < MAX_TOOLBAR_LINKS) {
    textLength += Array.from(buildToolbarButtonLabel(links[fitting])).length;
    if (fitting > 0 && textLength > MAX_TOOLBAR_TEXT_LENGTH) break;
    fitting += 1;
  }
  return { toolbar: links.slice(0, fitting), menu: links.slice(fitting) };
}

/** Label of the "+N" button: how many links are in the presentation menu. */
export function buildMoreLinksLabel(count: number): string {
  return `+${count}`;
}

/**
 * Tells where the links that do not fit on the toolbar are: the "+N" button's tooltip and the
 * notification shown when it is clicked. Until the locale messages load, it is in English.
 */
export function buildMoreLinksText(count: number, intl: IntlShape | null): string {
  if (intl) return intl.formatMessage(intlMessages.moreLinks, { count });
  const links = count === 1 ? '1 more link is' : `${count} more links are`;
  return `${links} in the presentation options menu, at the top right of the slide`;
}

/**
 * The url as a tooltip shows it: at most MAX_TOOLTIP_URL_LENGTH characters, without ever
 * cutting the scheme and host, with a zero-width space after each / ? & = so the tooltip can
 * wrap it. For display only: the link opens the url as it is.
 */
export function buildTooltipUrl(url: string): string {
  const max = Math.max(MAX_TOOLTIP_URL_LENGTH, Array.from(new URL(url).origin).length + 1);
  return truncateEnd(url, max).replace(URL_BREAK_AFTER, `$&${WORD_BREAK}`);
}

/**
 * Tooltip of a link's toolbar button: the label, then the url it opens. The label is cleaned
 * of dashes, so the url after the dash is always the real destination. Until the locale
 * messages load, it is in English.
 */
export function buildLinkTooltip({ url, label }: SmartSlideLink, intl: IntlShape | null): string {
  const shownUrl = buildTooltipUrl(url);
  if (intl) return intl.formatMessage(intlMessages.linkTooltip, { label, url: shownUrl });
  return `${label} \u2014 open ${shownUrl} in a new tab`;
}

export function openSmartSlideLink({ url, label }: SmartSlideLink): void {
  pluginLogger.info({ logCode: LOG_CODES.LINK_OPENED, label }, 'Opening smart slide link');
  pluginLogger.debug({ logCode: LOG_CODES.LINK_OPENED, url }, 'Smart slide link url');
  window.open(url, LINK_TARGET, LINK_WINDOW_FEATURES);
}
