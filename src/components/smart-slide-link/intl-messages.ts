import { defineMessage } from 'react-intl';

const intlMessages = {
  linkTooltip: defineMessage<{ url: string }>({
    id: 'smartSlideLink.button.tooltip',
    description: 'Tooltip of a presentation toolbar button that opens a link from the slide',
    defaultMessage: 'Open {url} in a new tab',
  }, { typed: true }),
};

export default intlMessages;
