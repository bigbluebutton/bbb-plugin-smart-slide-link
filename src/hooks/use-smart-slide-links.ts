import { useMemo } from 'react';

export interface SmartSlideLink {
  url: string;
  label: string;
}

const BBB_MARKER = 'BBB';

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

function extractBbbJson(text: string): string | null {
  const markerIndex = text.indexOf(BBB_MARKER);
  if (markerIndex === -1) return null;

  const afterMarker = markerIndex + BBB_MARKER.length;
  return sanitizeAndCollectJsonString(text, afterMarker);
}

function isSmartSlideLink(value: unknown): value is SmartSlideLink {
  return (
    typeof value === 'object'
    && value !== null
    && typeof (value as SmartSlideLink).url === 'string'
    && typeof (value as SmartSlideLink).label === 'string'
  );
}

function useSmartSlideLinks(slideText: string | null): SmartSlideLink[] {
  return useMemo(() => {
    if (!slideText) return [];

    const jsonString = extractBbbJson(slideText);
    if (!jsonString) return [];

    try {
      const parsed = JSON.parse(jsonString);
      if (!Array.isArray(parsed?.links)) return [];
      return parsed.links.filter(isSmartSlideLink);
    } catch {
      return [];
    }
  }, [slideText]);
}

export default useSmartSlideLinks;
