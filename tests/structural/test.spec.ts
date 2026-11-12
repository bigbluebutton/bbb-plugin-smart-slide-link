import { test, expect } from '@playwright/test';
import { elements as e } from '../elements';
import {
  ISOLATED, setupSmartSlideLinkMeeting, SLIDES, SmartSlideLinkMeeting, waitForPresentation,
} from '../helpers';

test.describe('Smart Slide Link Plugin - Structural', () => {
  test.describe.configure({ mode: ISOLATED ? 'default' : 'serial' });

  let meeting: SmartSlideLinkMeeting | undefined;

  if (ISOLATED) {
    test.beforeEach(async ({ browser, request }, testInfo) => {
      meeting = await setupSmartSlideLinkMeeting(browser, request, testInfo);
      if (meeting) await waitForPresentation(meeting.modPage);
    });
    test.afterEach(async () => { await meeting?.context.close(); });
  } else {
    test.beforeAll(async ({ browser, request }, testInfo) => {
      meeting = await setupSmartSlideLinkMeeting(browser, request, testInfo);
      if (meeting) await waitForPresentation(meeting.modPage);
    });
    test.afterAll(async () => { await meeting?.context.close(); });
  }

  test('should show one presentation toolbar button per link on the slide', async () => {
    const { modPage } = meeting!;
    const { links } = SLIDES.withLinks;

    await expect(
      modPage.getLocator(e.smartSlideLinkButtons),
      'should render one button per safe link declared on the slide',
    ).toHaveCount(links.length);
    await Promise.all(links.map((link, index) => modPage.hasText(
      e.smartSlideLinkButton(index),
      link.label,
      `button ${index} should be labelled with the link label "${link.label}"`,
    )));
  });

  test('should not show a button for a link whose url is not http(s)', async () => {
    const { modPage } = meeting!;

    await expect(
      modPage.getLocator(e.smartSlideLinkButtons).filter({ hasText: SLIDES.withLinks.unsafeLabel }),
      'the javascript: link declared on the slide should be dropped',
    ).toHaveCount(0);
  });
});
