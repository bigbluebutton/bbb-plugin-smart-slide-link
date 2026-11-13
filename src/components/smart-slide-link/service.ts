import { pluginLogger } from 'bigbluebutton-html-plugin-sdk';
import { LOG_CODES } from '../../commons/constants';
import {
  ALLOWED_PROTOCOLS,
  BBB_MARKER,
  EXTERNAL_LINK_SEPARATOR,
  LABEL_ELLIPSIS,
  LINK_TARGET,
  LINK_WINDOW_FEATURES,
  MAX_JSON_SCAN_LENGTH,
  MAX_LABEL_LENGTH,
  MAX_LINKS,
  MAX_MARKER_ATTEMPTS,
  MAX_SLIDE_TEXT_LENGTH,
  MAX_URL_LENGTH,
  SESSION_TOKEN_PARAM,
  TOOLBAR_BUTTON_DATA_TEST_PREFIX,
} from './constants';
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

// Control characters and invisible/bidirectional formatting characters, which can make a
// label render as something other than what it says (e.g. right-to-left override).
// eslint-disable-next-line no-control-regex
const UNSAFE_LABEL_CHARS = /[\u0000-\u001F\u007F-\u009F\u00AD\u061C\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g;

/** Returns the label as plain, single-spaced text of at most MAX_LABEL_LENGTH characters. */
export function sanitizeLabel(label: string): string {
  const clean = label.replace(UNSAFE_LABEL_CHARS, ' ').replace(/\s+/g, ' ').trim();
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

/**
 * Label of a link's toolbar button: the slide's label followed by the site the link opens.
 * The label is written by whoever authored the slide, possibly in text the presenter cannot
 * see, so the real destination is always shown next to it. `host` is the parser's form of
 * the host, so look-alike international names show as punycode.
 */
export function buildToolbarButtonLabel({ url, label }: SmartSlideLink): string {
  return `${label} ${EXTERNAL_LINK_SEPARATOR} ${new URL(url).host}`;
}

export function openSmartSlideLink({ url, label }: SmartSlideLink): void {
  pluginLogger.info({ logCode: LOG_CODES.LINK_OPENED, label }, 'Opening smart slide link');
  pluginLogger.debug({ logCode: LOG_CODES.LINK_OPENED, url }, 'Smart slide link url');
  window.open(url, LINK_TARGET, LINK_WINDOW_FEATURES);
}
