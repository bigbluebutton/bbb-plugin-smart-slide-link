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
// Links shown as presentation toolbar buttons, and the text they may add up to; the other
// links go to the presentation menu, so the toolbar does not grow past the slide area and push
// the slide controls off screen. Sized for a 1280px wide window with the chat panel open.
export const MAX_TOOLBAR_LINKS = 2;
export const MAX_TOOLBAR_TEXT_LENGTH = 80;
export const MAX_LABEL_LENGTH = 40;
// A button shows "<label> ↗ <host>": the whole text is capped, and so is the host, which is
// shortened from the left so the domain it belongs to stays visible.
export const MAX_BUTTON_TEXT_LENGTH = 48;
export const MAX_HOST_LENGTH = 28;
export const MAX_URL_LENGTH = 2048;
export const LABEL_ELLIPSIS = '…';

// Shown between a button's label and the site it opens, to mark it as an external link.
export const EXTERNAL_LINK_SEPARATOR = '↗';

// A link button's tooltip shows "<label> — open <url> in a new tab". The url is shortened to
// MAX_TOOLTIP_URL_LENGTH characters (never cutting the scheme and host), and a zero-width
// space is added after each URL_BREAK_AFTER character: the client's tooltip only wraps lines
// at spaces and hyphens, so a long url would otherwise run out of the tooltip box. Only the
// text shown changes; the link still opens the url as it is.
export const MAX_TOOLTIP_URL_LENGTH = 200;
export const URL_BREAK_AFTER = /[/?&=]/g;
export const WORD_BREAK = '\u200B';

export const LINK_TARGET = '_blank';
export const LINK_WINDOW_FEATURES = 'noopener,noreferrer';

export const TOOLBAR_BUTTON_DATA_TEST_PREFIX = 'smartSlideLinkButton';
export const MENU_ITEM_DATA_TEST_PREFIX = 'smartSlideLinkMenuItem';
export const MENU_ITEM_ICON = 'external';
// The "+N" button that ends the toolbar when some links are in the presentation menu.
export const MORE_LINKS_BUTTON_DATA_TEST = 'smartSlideLinkMoreButton';
export const MORE_LINKS_NOTIFICATION_ICON = 'more';

export const SESSION_TOKEN_PARAM = 'sessionToken';
