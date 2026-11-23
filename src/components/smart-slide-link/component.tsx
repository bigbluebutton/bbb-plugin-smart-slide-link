import * as React from 'react';
import { useEffect } from 'react';
import {
  BbbPluginSdk,
  NotificationTypeUiCommand,
  PluginApi,
  PresentationDropdownOption,
  PresentationToolbarButton,
} from 'bigbluebutton-html-plugin-sdk';
import { useDebugSetting, usePluginIntl, useUsageLogging } from '../../commons/hooks';
import { useCurrentSlideText, useSmartSlideLinks } from './hooks';
import {
  MENU_ITEM_ICON,
  MORE_LINKS_BUTTON_DATA_TEST,
  MORE_LINKS_NOTIFICATION_ICON,
} from './constants';
import {
  buildLinkTooltip,
  buildMenuItemDataTest,
  buildMoreLinksLabel,
  buildMoreLinksText,
  buildToolbarButtonDataTest,
  buildToolbarButtonLabel,
  openSmartSlideLink,
  splitToolbarLinks,
} from './service';
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
    // Only the first links fit on the toolbar; the rest go to the presentation menu. Both
    // lists are always set, so a slide with fewer links clears what the previous one added.
    const { toolbar, menu } = splitToolbarLinks(links);
    const toolbarButtons = toolbar.map((link, index) => (
      new PresentationToolbarButton({
        label: buildToolbarButtonLabel(link),
        tooltip: buildLinkTooltip(link, intl),
        dataTest: buildToolbarButtonDataTest(index),
        onClick: () => openSmartSlideLink(link),
        style: {},
      })));
    const menuItems = menu.map((link, index) => (
      new PresentationDropdownOption({
        label: buildToolbarButtonLabel(link),
        icon: MENU_ITEM_ICON,
        dataTest: buildMenuItemDataTest(index),
        onClick: () => openSmartSlideLink(link),
      })));
    if (menu.length > 0) {
      // The presentation menu is easy to miss, so the toolbar says how many links are there.
      const moreLinksText = buildMoreLinksText(menu.length, intl);
      toolbarButtons.push(new PresentationToolbarButton({
        label: buildMoreLinksLabel(menu.length),
        tooltip: moreLinksText,
        dataTest: MORE_LINKS_BUTTON_DATA_TEST,
        onClick: () => pluginApi.uiCommands?.notification.send({
          message: moreLinksText,
          icon: MORE_LINKS_NOTIFICATION_ICON,
          type: NotificationTypeUiCommand.INFO,
        }),
        style: {},
      }));
    }
    pluginApi.setPresentationToolbarItems(toolbarButtons);
    pluginApi.setPresentationDropdownItems(menuItems);
  }, [links, intl, pluginApi]);

  return null;
}

export default SmartSlideLink;
