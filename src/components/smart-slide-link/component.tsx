import * as React from 'react';
import { useEffect } from 'react';
import {
  BbbPluginSdk,
  PluginApi,
  PresentationToolbarButton,
} from 'bigbluebutton-html-plugin-sdk';
import { useDebugSetting, usePluginIntl, useUsageLogging } from '../../commons/hooks';
import { useCurrentSlideText, useSmartSlideLinks } from './hooks';
import intlMessages from './intl-messages';
import { buildToolbarButtonDataTest, openSmartSlideLink } from './service';
import { SmartSlideLinkProps } from './types';

function SmartSlideLink({ pluginUuid }: SmartSlideLinkProps): React.ReactElement | null {
  BbbPluginSdk.initialize(pluginUuid);
  const pluginApi: PluginApi = BbbPluginSdk.getPluginApi(pluginUuid);

  useUsageLogging(pluginApi);
  useDebugSetting(pluginApi);
  const intl = usePluginIntl(pluginApi);

  const slideText = useCurrentSlideText(pluginApi);
  const links = useSmartSlideLinks(slideText);

  useEffect(() => {
    const toolbarButtons = links.map((link, index) => new PresentationToolbarButton({
      label: link.label,
      tooltip: intl ? intl.formatMessage(intlMessages.linkTooltip, { url: link.url }) : link.url,
      dataTest: buildToolbarButtonDataTest(index),
      onClick: () => openSmartSlideLink(link),
      style: {},
    }));
    pluginApi.setPresentationToolbarItems(toolbarButtons);
  }, [links, intl, pluginApi]);

  return null;
}

export default SmartSlideLink;
