export const LOG_CODES = {
  PLUGIN_STARTED: 'plg_started',
  PLUGIN_STOPPED: 'plg_stopped',
  SETTINGS_ERROR: 'smart_slide_link_settings_error',
  PRESENTATION_ERROR: 'smart_slide_link_presentation_error',
  SLIDE_TEXT_FETCH_FAILED: 'smart_slide_link_slide_text_fetch_failed',
  LINKS_DETECTED: 'smart_slide_link_links_detected',
  LINK_OPENED: 'smart_slide_link_link_opened',
} as const;

export const LOG_LEVEL_DEBUG = 'debug';
export const LOG_LEVEL_DEFAULT = 'info';

export const DEFAULT_LOCALE = 'en';

// ngrok's free tier serves an interstitial page instead of the locale JSON unless this
// header is sent, so it is added only while developing against a tunnelled dev server.
const IS_DEVELOPMENT = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
export const LOCALE_REQUEST_OBJECT: RequestInit | undefined = IS_DEVELOPMENT
  ? { headers: { 'ngrok-skip-browser-warning': 'any' } }
  : undefined;
