import { pluginLogger } from 'bigbluebutton-html-plugin-sdk';
import { LOG_CODES } from '../../commons/constants';
import {
  ALLOWED_PROTOCOLS,
  BBB_MARKER,
  LINK_TARGET,
  LINK_WINDOW_FEATURES,
  SESSION_TOKEN_PARAM,
  TOOLBAR_BUTTON_DATA_TEST_PREFIX,
} from './constants';
import { SmartSlideLink } from './types';

/**
 * Collects the JSON object that starts right after `afterMarker`, keeping string contents and
 * JSON structural characters only. Text extracted from a slide interleaves the JSON with other
 * slide text, so anything outside a string that is not structural is dropped.
 */
function sanitizeAndCollectJsonString(text: string, afterMarker: number): string | null {
  const jsonStart = text.indexOf('{', afterMarker);
  if (jsonStart === -1 || text.slice(afterMarker, jsonStart).trim()) return null;

  let result = '';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = jsonStart; i < text.length; i += 1) {
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

export function isSafeUrl(url: string): boolean {
  try {
    return ALLOWED_PROTOCOLS.includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

function isSmartSlideLink(value: unknown): value is SmartSlideLink {
  return (
    typeof value === 'object'
    && value !== null
    && typeof (value as SmartSlideLink).url === 'string'
    && typeof (value as SmartSlideLink).label === 'string'
    && isSafeUrl((value as SmartSlideLink).url)
  );
}

function parseLinks(jsonString: string): SmartSlideLink[] | null {
  try {
    const parsed = JSON.parse(jsonString);
    if (!Array.isArray(parsed?.links)) return null;
    return parsed.links.filter(isSmartSlideLink);
  } catch {
    return null;
  }
}

/**
 * Returns the links declared on a slide. The marker is a plain word that can also appear in
 * the slide's prose ("Welcome to BBB!"), so every occurrence is tried until one is followed
 * by a links JSON.
 */
export function extractSmartSlideLinks(text: string | null): SmartSlideLink[] {
  if (!text) return [];

  let markerIndex = text.indexOf(BBB_MARKER);
  while (markerIndex !== -1) {
    const jsonString = sanitizeAndCollectJsonString(text, markerIndex + BBB_MARKER.length);
    const links = jsonString ? parseLinks(jsonString) : null;
    if (links) return links;
    markerIndex = text.indexOf(BBB_MARKER, markerIndex + BBB_MARKER.length);
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

export function openSmartSlideLink({ url, label }: SmartSlideLink): void {
  pluginLogger.info({ logCode: LOG_CODES.LINK_OPENED, label }, 'Opening smart slide link');
  pluginLogger.debug({ logCode: LOG_CODES.LINK_OPENED, url }, 'Smart slide link url');
  window.open(url, LINK_TARGET, LINK_WINDOW_FEATURES);
}
