import { readFileSync } from 'fs';
import path from 'path';
import {
  APIRequestContext, Browser, BrowserContext, expect, TestInfo,
} from '@playwright/test';
import { PRESENTATION_CONVERSION_WAIT_TIME } from './core/constants';
import { checkPluginAvailability } from './core/fixtures/pluginBeforeAll';
import { elements as e } from './elements';
import { encodeCustomParams, presentationModulesXml } from './core/helpers';
import { Plugin } from './core/plugin';
import { SessionPage } from './core/sessionPage';

// Directory the debian package installs the plugin to, under the server's /plugins/ path.
const PLUGIN_DIRECTORY = 'bbb-plugin-smart-slide-link';
export const PLUGIN_URL_ENV_VAR = 'SMART_SLIDE_LINK_PLUGIN_URL';

const PRESENTATION_FILE_NAME = 'smart-slide-links.pdf';
const PRESENTATION_PATH = path.resolve(__dirname, 'fixtures', PRESENTATION_FILE_NAME);

// Content of tests/fixtures/smart-slide-links.pdf (see generate-presentation.mjs).
export const SLIDES = {
  withLinks: {
    number: 1,
    links: [
      { label: 'Open docs', url: 'https://example.com/smart-slide-link-docs' },
      { label: 'Visit site', url: 'https://example.org/smart-slide-link-site' },
    ],
    unsafeLabel: 'Unsafe link',
  },
  withoutLinks: { number: 2 },
  markerInProse: {
    number: 3,
    links: [{ label: 'Third slide link', url: 'https://example.net/third-slide' }],
  },
};

export const ISOLATED = process.env.TEST_MEETINGS === 'isolated';

let pluginUrl: string | undefined = process.env[PLUGIN_URL_ENV_VAR];

export interface SmartSlideLinkMeeting {
  context: BrowserContext;
  modPage: SessionPage;
}

/**
 * Creates a meeting that loads the plugin and has the test presentation pre-uploaded, and
 * joins it as a moderator, who is the presenter and therefore sees the presentation toolbar.
 * Returns undefined when the plugin is unreachable (the test has been skipped).
 */
export async function setupSmartSlideLinkMeeting(
  browser: Browser,
  request: APIRequestContext,
  testInfo: TestInfo,
): Promise<SmartSlideLinkMeeting | undefined> {
  await checkPluginAvailability({
    pluginDirectory: PLUGIN_DIRECTORY,
    setPluginUrl: (url) => { pluginUrl = url; },
    getPluginUrl: () => pluginUrl,
  })({ request }, testInfo);
  if (!pluginUrl) return undefined;

  const context = await browser.newContext({
    permissions: ['clipboard-read', 'clipboard-write', 'camera', 'microphone'],
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();
  const plugin = new Plugin({ browser, context });
  await plugin.initModPage(page, {
    createParameter: encodeCustomParams(`pluginManifests=${JSON.stringify([{ url: pluginUrl }])}`),
    modulesXml: presentationModulesXml(PRESENTATION_FILE_NAME, readFileSync(PRESENTATION_PATH)),
  });
  return { context, modPage: plugin.modPage };
}

/**
 * Waits until the uploaded presentation is converted and current. Its page count tells it
 * apart from the server's default presentation, which may show first.
 */
export async function waitForPresentation(modPage: SessionPage): Promise<void> {
  await expect(
    modPage.getLocator(`${e.skipSlide} option`),
    'the uploaded presentation should finish converting and become current',
  ).toHaveCount(Object.keys(SLIDES).length, { timeout: PRESENTATION_CONVERSION_WAIT_TIME });
  await expect(modPage.getLocator(e.skipSlide)).toHaveValue(String(SLIDES.withLinks.number));
}

/** Moves the presentation to a slide and waits until the client reports it as current. */
export async function goToSlide(modPage: SessionPage, slideNumber: number): Promise<void> {
  const select = modPage.getLocator(e.skipSlide);
  await select.selectOption(String(slideNumber));
  await expect(select, `the presentation should be on slide ${slideNumber}`).toHaveValue(String(slideNumber));
}
