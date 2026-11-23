import {
  expect, Page, Browser, Locator,
} from '@playwright/test';
import { ELEMENT_WAIT_EXTRA_LONG_TIME, ELEMENT_WAIT_TIME } from './constants';
import * as parameters from './parameters';
import {
  createMeeting, generateSettingsData, getJoinURL, SessionSettings,
} from './helpers';
import { coreElements as e } from './coreElements';

interface PageProps {
  browser: Browser;
  page: Page;
}

export interface InitOptions {
  createParameter?: string;
  modulesXml?: string;
  joinParameter?: string;
  shouldCloseAudioModal?: boolean;
  skipSessionDetailsModal?: boolean;
}

interface InitFunctionParameters {
  isModerator: boolean;
  shouldCloseAudioModal: boolean;
  initOptions: InitOptions;
}

export interface InitParameters {
  server: string | undefined;
  secret: string | undefined;
  welcome: string;
  fullName: string;
  moderatorPW: string;
  attendeePW: string;
}

export class SessionPage {
  readonly page: Page;

  readonly browser: Browser;

  settings: SessionSettings | undefined;

  initParameters: InitParameters;

  meetingId: string;

  constructor({ browser, page }: PageProps) {
    this.browser = browser;
    this.page = page;
    this.meetingId = '';
    this.initParameters = { ...parameters };
  }

  async init({ isModerator, shouldCloseAudioModal, initOptions = {} }: InitFunctionParameters) {
    const {
      createParameter,
      modulesXml,
      joinParameter,
      skipSessionDetailsModal = true,
    } = initOptions;

    if (!isModerator) this.initParameters.moderatorPW = '';

    this.meetingId = await createMeeting(this.initParameters, createParameter, modulesXml);
    const joinUrl = getJoinURL({
      meetingID: this.meetingId, isModerator, joinParameter, skipSessionDetailsModal,
    });
    const response = await this.page.goto(joinUrl);
    expect(response?.ok()).toBeTruthy();
    await expect(this.getLocator(e.errorMessageLabel), 'should pass the authentication').toHaveCount(0);
    await this.page.waitForSelector('div#layout', { timeout: ELEMENT_WAIT_EXTRA_LONG_TIME });
    this.settings = await generateSettingsData(this.page);
    if (shouldCloseAudioModal && this.settings?.autoJoinAudioModal) await this.closeAudioModal();
    // overwrite for font used in CI
    await this.page.addStyleTag({
      content: `
        body {
          font-family: 'Liberation Sans', Arial, sans-serif;
        }`,
    });
  }

  async hasElement(selector: string, description: string, timeout = ELEMENT_WAIT_TIME) {
    await expect(this.getLocator(selector).first(), description).toBeVisible({ timeout });
  }

  async wasRemoved(selector: string, description: string, timeout = ELEMENT_WAIT_TIME) {
    await expect(this.getLocator(selector), description).toHaveCount(0, { timeout });
  }

  getLocator(selector: string): Locator {
    return this.page.locator(selector);
  }

  async hasText(selector: string, text: string, description: string, timeout = ELEMENT_WAIT_TIME) {
    await expect(this.getLocator(selector).first(), description).toContainText(text, { timeout });
  }

  async closeAudioModal() {
    await this.hasElement(e.audioModal, 'should display the audio modal', ELEMENT_WAIT_EXTRA_LONG_TIME);
    await this.page.click(e.closeModal);
  }
}
