import { defineMessage } from 'react-intl';

const intlMessages = {
  linkTooltip: defineMessage<{ label: string; url: string }>({
    id: 'smartSlideLink.button.tooltip',
    description: 'Tooltip of a presentation toolbar button that opens a link from the slide: '
      + 'the link label from the slide, then the url it opens',
    defaultMessage: '{label} \u2014 open {url} in a new tab',
  }, { typed: true }),
  moreLinks: defineMessage<{ count: number }>({
    id: 'smartSlideLink.moreButton.tooltip',
    description: 'Tooltip of the "+N" toolbar button, and notification shown when it is clicked: '
      + 'where the links that do not fit on the toolbar are',
    defaultMessage: '{count, plural, one {# more link is} other {# more links are}} in the presentation '
      + 'options menu, at the top right of the slide',
  }, { typed: true }),
};

export default intlMessages;
