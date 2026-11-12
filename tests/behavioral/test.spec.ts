import { test, expect } from '@playwright/test';
import { elements as e } from '../elements';
import {
  goToSlide,
  ISOLATED,
  setupSmartSlideLinkMeeting,
  SLIDES,
  SmartSlideLinkMeeting,
  waitForPresentation,
} from '../helpers';

test.describe('Smart Slide Link Plugin - Behavioral', () => {
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
    // Each test starts from the first slide, whatever slide the previous one ended on.
    test.afterEach(async () => {
      if (meeting) await goToSlide(meeting.modPage, SLIDES.withLinks.number);
    });
  }

  test('should open the link in a new tab, without access to the client window', async () => {
    const { modPage, context } = meeting!;
    const [link] = SLIDES.withLinks.links;
    // Answer the link locally: the test checks where the tab goes, not the external site.
    await context.route(link.url, (route) => route.fulfill({ status: 200, body: 'ok' }));

    const [newTab] = await Promise.all([
      context.waitForEvent('page'),
      modPage.getLocator(e.smartSlideLinkButton(0)).click(),
    ]);
    await newTab.waitForURL(link.url);

    expect(await newTab.evaluate(() => window.opener), 'the new tab should have no opener').toBeNull();
    await newTab.close();
    await context.unroute(link.url);
  });

  test('should remove the buttons on a slide without links', async () => {
    const { modPage } = meeting!;
    await modPage.hasElement(e.smartSlideLinkButtons, 'the first slide should have link buttons');

    await goToSlide(modPage, SLIDES.withoutLinks.number);

    await modPage.wasRemoved(e.smartSlideLinkButtons, 'a slide without links should have no buttons');
  });

  test('should replace the buttons with the next slide\'s links', async () => {
    const { modPage } = meeting!;
    const [link] = SLIDES.markerInProse.links;

    // Slide 3 also says "Welcome to BBB!" before the links, so this covers a marker word
    // that appears in the slide's prose.
    await goToSlide(modPage, SLIDES.markerInProse.number);

    await expect(modPage.getLocator(e.smartSlideLinkButtons)).toHaveCount(1);
    await modPage.hasText(e.smartSlideLinkButton(0), link.label, 'should show the third slide\'s link');
  });

  test('should restore the buttons when going back to a slide with links', async () => {
    const { modPage } = meeting!;

    await goToSlide(modPage, SLIDES.withoutLinks.number);
    await modPage.wasRemoved(e.smartSlideLinkButtons, 'buttons should go away on the slide without links');
    await goToSlide(modPage, SLIDES.withLinks.number);

    await expect(modPage.getLocator(e.smartSlideLinkButtons))
      .toHaveCount(SLIDES.withLinks.links.length);
  });
});
