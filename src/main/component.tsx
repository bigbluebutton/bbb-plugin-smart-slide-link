import * as React from 'react';
import { useEffect } from 'react';
import {
  BbbPluginSdk,
  PluginApi,
  PresentationToolbarButton,
} from 'bigbluebutton-html-plugin-sdk';
import useCurrentSlideText from '../hooks/use-current-slide-text';
import useSmartSlideLinks from '../hooks/use-smart-slide-links';

interface MainComponentProps {
  pluginUuid: string;
}

function MainComponent(
  { pluginUuid: uuid }: MainComponentProps,
): React.ReactElement | null {
  BbbPluginSdk.initialize(uuid);
  const pluginApi: PluginApi = BbbPluginSdk.getPluginApi(uuid);

  const slideText = useCurrentSlideText(pluginApi);
  const links = useSmartSlideLinks(slideText);

  useEffect(() => {
    const toolbarButtons = links.map(
      ({ url, label }) => new PresentationToolbarButton({
        label,
        tooltip: url,
        onClick: () => window.open(url, '_blank'),
        style: {},
      }),
    );
    pluginApi.setPresentationToolbarItems(toolbarButtons);
  }, [links]);

  return null;
}

export default MainComponent;
