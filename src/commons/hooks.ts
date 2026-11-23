import { useEffect, useMemo } from 'react';
import { createIntl, createIntlCache, IntlShape } from 'react-intl';
import { PluginApi, pluginLogger } from 'bigbluebutton-html-plugin-sdk';
import {
  DEFAULT_LOCALE,
  LOCALE_REQUEST_OBJECT,
  LOG_CODES,
  LOG_LEVEL_DEBUG,
  LOG_LEVEL_DEFAULT,
} from './constants';
import { PluginSettings } from './types';

/**
 * Emits the mandatory usage logs. The plugin has no user-triggered start: it begins scanning
 * slides as soon as it is mounted, so mount/unmount are its activation and deactivation.
 */
export function useUsageLogging(pluginApi: PluginApi): void {
  useEffect(() => {
    pluginLogger.info(
      { logCode: LOG_CODES.PLUGIN_STARTED },
      `Plugin started: ${pluginApi.pluginName}`,
    );
    return () => {
      pluginLogger.info(
        { logCode: LOG_CODES.PLUGIN_STOPPED },
        `Plugin stopped: ${pluginApi.pluginName}`,
      );
    };
  }, [pluginApi]);
}

/**
 * Applies the `debug` setting to the logger level. It is the plugin's only setting and no
 * component reads its value, so it is applied here instead of through a settings context.
 */
export function useDebugSetting(pluginApi: PluginApi): void {
  const { data, loading, error } = pluginApi.usePluginSettings?.() ?? { loading: true };
  const debug = (data as PluginSettings | undefined)?.debug === true;

  useEffect(() => {
    if (!error) return;
    pluginLogger.error(
      { logCode: LOG_CODES.SETTINGS_ERROR, error },
      'Could not read plugin settings; keeping the default log level',
    );
  }, [error]);

  useEffect(() => {
    if (loading || error) return;
    if (typeof pluginLogger.level === 'function') {
      pluginLogger.level(debug ? LOG_LEVEL_DEBUG : LOG_LEVEL_DEFAULT);
    }
  }, [loading, error, debug]);
}

/** Returns a react-intl instance for the client's locale, or null while messages load. */
export function usePluginIntl(pluginApi: PluginApi): IntlShape | null {
  const { messages, currentLocale, loading } = pluginApi.useLocaleMessages?.(LOCALE_REQUEST_OBJECT)
    ?? { messages: undefined, currentLocale: DEFAULT_LOCALE, loading: true };

  const intlCache = useMemo(() => createIntlCache(), []);

  return useMemo(() => (loading || !messages
    ? null
    : createIntl({
      locale: currentLocale || DEFAULT_LOCALE,
      messages,
      fallbackOnEmptyString: true,
    }, intlCache)), [loading, messages, currentLocale, intlCache]);
}
