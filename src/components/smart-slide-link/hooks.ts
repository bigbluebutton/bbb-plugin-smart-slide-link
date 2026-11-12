import { useEffect, useMemo, useState } from 'react';
import { PluginApi, pluginLogger } from 'bigbluebutton-html-plugin-sdk';
import { LOG_CODES } from '../../commons/constants';
import { authenticateUrl, extractSmartSlideLinks } from './service';
import { SmartSlideLink } from './types';

/**
 * Returns the extracted text of the slide currently shown, or null while there is none, while
 * it loads, or when it could not be read.
 */
export function useCurrentSlideText(pluginApi: PluginApi): string | null {
  const [slideText, setSlideText] = useState<string | null>(null);
  const { data: currentPresentation, loading, error } = pluginApi.useCurrentPresentation?.()
    ?? { loading: true };
  const rawTextUri = loading || error
    ? undefined
    : currentPresentation?.currentPage?.urlsJson?.text;
  const textUri = rawTextUri
    ? authenticateUrl(rawTextUri, pluginApi.getSessionToken?.())
    : undefined;

  useEffect(() => {
    if (!error) return;
    pluginLogger.error(
      { logCode: LOG_CODES.PRESENTATION_ERROR, error },
      'Could not read the current presentation',
    );
  }, [error]);

  useEffect(() => {
    setSlideText(null);
    if (!textUri) return undefined;

    // A slower response for a previous slide must not overwrite the current slide's text.
    const controller = new AbortController();
    fetch(textUri, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
      })
      .then((text) => {
        if (!controller.signal.aborted) setSlideText(text);
      })
      .catch((fetchError: unknown) => {
        if (controller.signal.aborted) return;
        pluginLogger.error(
          { logCode: LOG_CODES.SLIDE_TEXT_FETCH_FAILED, error: String(fetchError) },
          'Could not fetch the current slide text',
        );
      });

    return () => controller.abort();
  }, [textUri]);

  return slideText;
}

export function useSmartSlideLinks(slideText: string | null): SmartSlideLink[] {
  const links = useMemo(() => extractSmartSlideLinks(slideText), [slideText]);

  useEffect(() => {
    if (links.length === 0) return;
    pluginLogger.debug(
      { logCode: LOG_CODES.LINKS_DETECTED, count: links.length },
      'Smart slide links detected on the current slide',
    );
  }, [links]);

  return links;
}
