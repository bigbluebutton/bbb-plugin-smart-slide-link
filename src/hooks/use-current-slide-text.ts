import { useEffect, useState } from 'react';
import { PluginApi } from 'bigbluebutton-html-plugin-sdk';

function useCurrentSlideText(pluginApi: PluginApi): string | null {
  const [slideText, setSlideText] = useState<string | null>(null);
  const { data: currentPresentation } = pluginApi.useCurrentPresentation?.() ?? { data: undefined };
  const textUri = currentPresentation?.currentPage?.urlsJson?.text;

  useEffect(() => {
    if (!textUri) {
      setSlideText(null);
      return;
    }
    fetch(textUri)
      .then((res) => res.text())
      .then(setSlideText)
      .catch(() => setSlideText(null));
  }, [textUri]);

  return slideText;
}

export default useCurrentSlideText;
