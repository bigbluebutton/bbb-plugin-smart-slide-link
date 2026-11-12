import { vi } from 'vitest';

/**
 * Module factory for `vi.mock('bigbluebutton-html-plugin-sdk', ...)`. The real SDK reaches
 * into the BBB client at import time, so every unit test replaces it with these stand-ins.
 */
export function createSdkMock() {
  return {
    BbbPluginSdk: {
      initialize: vi.fn(),
      getPluginApi: vi.fn(),
    },
    PresentationToolbarButton: vi.fn(function PresentationToolbarButton(
      this: Record<string, unknown>,
      props: Record<string, unknown>,
    ) {
      Object.assign(this, props);
    }),
    pluginLogger: {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      level: vi.fn(),
    },
  };
}
