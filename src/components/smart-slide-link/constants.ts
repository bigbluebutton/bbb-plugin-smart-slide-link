// Text that precedes the links JSON on a slide: BBB{"links":[{"url":"…","label":"…"}]}
export const BBB_MARKER = 'BBB';

// Slide text is authored by whoever uploaded the presentation, so only plain web links are
// opened: a `javascript:` or `data:` url passed to window.open would run in the client.
export const ALLOWED_PROTOCOLS = ['http:', 'https:'];

// Slide text is untrusted and is parsed on the main thread, so every step is bounded: a
// crafted slide must not be able to freeze the client or flood the toolbar.
export const MAX_SLIDE_TEXT_LENGTH = 100000;
// Markers followed by a `{` that are tried before giving up on the slide.
export const MAX_MARKER_ATTEMPTS = 20;
// Characters scanned after a marker while looking for the end of its JSON.
export const MAX_JSON_SCAN_LENGTH = 30000;
export const MAX_LINKS = 10;
export const MAX_LABEL_LENGTH = 40;
export const MAX_URL_LENGTH = 2048;
export const LABEL_ELLIPSIS = '…';

// Shown between a button's label and the site it opens, to mark it as an external link.
export const EXTERNAL_LINK_SEPARATOR = '↗';

export const LINK_TARGET = '_blank';
export const LINK_WINDOW_FEATURES = 'noopener,noreferrer';

export const TOOLBAR_BUTTON_DATA_TEST_PREFIX = 'smartSlideLinkButton';

export const SESSION_TOKEN_PARAM = 'sessionToken';
