/* eslint-disable no-console */
import { TestInfo, APIRequestContext } from '@playwright/test';
import { secret, server } from '../parameters';

export type PluginBeforeAllConfig = {
  // Directory under the server's /plugins/ path the plugin is deployed to.
  pluginDirectory: string;
  setPluginUrl: (url: string) => void;
  getPluginUrl?: () => string | undefined;
};

const BBB_URL_PATTERN = /^https:\/\/[^/]+\/bigbluebutton\/$/;

/**
 * Resolves the manifest url the meeting will load the plugin from: the env-provided url when
 * there is one, otherwise the plugin's default deploy path on the server. Skips the test when
 * the plugin cannot be reached, instead of failing every assertion after it.
 */
export function checkPluginAvailability(config: PluginBeforeAllConfig) {
  return async ({ request }: { request: APIRequestContext }, testInfo: TestInfo): Promise<void> => {
    if (!secret) throw new Error('BBB_SECRET environment variable is not set');
    if (!server) throw new Error('BBB_URL environment variable is not set');
    if (!BBB_URL_PATTERN.test(server)) throw new Error('BBB_URL must follow the pattern "https://DOMAIN_NAME/bigbluebutton/"');

    const customUrl = config.getPluginUrl?.();
    const pluginUrl = customUrl
      || `${new URL(server).origin}/plugins/${config.pluginDirectory}/manifest.json`;

    const response = await request.get(pluginUrl);
    if (!response.ok()) {
      const msg = `Failed to fetch plugin manifest ${pluginUrl}: status ${response.status()}`;
      console.error(msg);
      testInfo.skip(true, msg);
      return;
    }

    try {
      await response.json();
      config.setPluginUrl(pluginUrl);
    } catch (error) {
      const msg = `Invalid JSON in plugin manifest ${pluginUrl}`;
      console.error(msg, error);
      testInfo.skip(true, msg);
    }
  };
}
