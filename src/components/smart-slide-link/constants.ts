// Text that precedes the links JSON on a slide: BBB{"links":[{"url":"…","label":"…"}]}
export const BBB_MARKER = 'BBB';

// Slide text is authored by whoever uploaded the presentation, so only plain web links are
// opened: a `javascript:` or `data:` url passed to window.open would run in the client.
export const ALLOWED_PROTOCOLS = ['http:', 'https:'];

export const LINK_TARGET = '_blank';
export const LINK_WINDOW_FEATURES = 'noopener,noreferrer';

export const TOOLBAR_BUTTON_DATA_TEST_PREFIX = 'smartSlideLinkButton';

export const SESSION_TOKEN_PARAM = 'sessionToken';
