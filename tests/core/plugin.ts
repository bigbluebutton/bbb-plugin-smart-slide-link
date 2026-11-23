import { Page, Browser, BrowserContext } from '@playwright/test';
import { InitOptions, SessionPage } from './sessionPage';

interface PluginProps {
  browser: Browser;
  context: BrowserContext;
}

export class Plugin {
  readonly browser: Browser;

  readonly context: BrowserContext;

  modPage!: SessionPage;

  constructor({ browser, context }: PluginProps) {
    this.browser = browser;
    this.context = context;
  }

  async initModPage(page: Page, {
    shouldCloseAudioModal = true,
    ...initOptions
  }: InitOptions = {}) {
    this.modPage = new SessionPage({ browser: this.browser, page });
    await this.modPage.init({ isModerator: true, shouldCloseAudioModal, initOptions });
  }
}
