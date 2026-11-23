import * as React from 'react';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { render } from '@testing-library/react';
import { BbbPluginSdk, PresentationDropdownOption, PresentationToolbarButton } from 'bigbluebutton-html-plugin-sdk';
import { usePluginIntl } from '../../src/commons/hooks';
import { useCurrentSlideText, useSmartSlideLinks } from '../../src/components/smart-slide-link/hooks';
import SmartSlideLink from '../../src/components/smart-slide-link/component';
import { MAX_TOOLBAR_LINKS } from '../../src/components/smart-slide-link/constants';

vi.mock('bigbluebutton-html-plugin-sdk', async () => (await import('./helpers/sdk-mock')).createSdkMock());
vi.mock('../../src/commons/hooks', () => ({
  useUsageLogging: vi.fn(),
  useDebugSetting: vi.fn(),
  usePluginIntl: vi.fn(),
}));
vi.mock('../../src/components/smart-slide-link/hooks', () => ({
  useCurrentSlideText: vi.fn(),
  useSmartSlideLinks: vi.fn(),
}));

const setPresentationToolbarItems = vi.fn();
const setPresentationDropdownItems = vi.fn();
const sendNotification = vi.fn();
const pluginApi = {
  setPresentationToolbarItems,
  setPresentationDropdownItems,
  uiCommands: { notification: { send: sendNotification } },
};

type ButtonProps = ConstructorParameters<typeof PresentationToolbarButton>[0];
const buttonProps = (call: number): ButtonProps => (
  vi.mocked(PresentationToolbarButton).mock.calls[call][0]
);
const MORE_LINKS_DATA_TEST = 'smartSlideLinkMoreButton';
const moreButtonProps = (): ButtonProps | undefined => (
  vi.mocked(PresentationToolbarButton).mock.calls
    .map(([props]) => props)
    .find((props) => props.dataTest === MORE_LINKS_DATA_TEST)
);
type OptionProps = ConstructorParameters<typeof PresentationDropdownOption>[0];
const optionProps = (call: number): OptionProps => (
  vi.mocked(PresentationDropdownOption).mock.calls[call][0]
);
const linksOf = (count: number) => Array.from({ length: count }, (_, i) => (
  { url: `https://l${i}.com`, label: `L${i}` }
));

beforeEach(() => {
  vi.mocked(BbbPluginSdk.getPluginApi).mockReturnValue(pluginApi as never);
  vi.mocked(useCurrentSlideText).mockReturnValue(null);
  vi.mocked(useSmartSlideLinks).mockReturnValue([]);
  vi.mocked(usePluginIntl).mockReturnValue(null);
});

describe('SmartSlideLink', () => {
  it('renders nothing to the DOM', () => {
    const { container } = render(<SmartSlideLink pluginUuid="test-uuid" />);
    expect(container.firstChild).toBeNull();
  });

  describe('SDK wiring', () => {
    it('initializes the SDK and reads the plugin api with the given uuid', () => {
      render(<SmartSlideLink pluginUuid="my-uuid" />);
      expect(BbbPluginSdk.initialize).toHaveBeenCalledWith('my-uuid');
      expect(BbbPluginSdk.getPluginApi).toHaveBeenCalledWith('my-uuid');
    });

    it('passes the current slide text to the link parser', () => {
      vi.mocked(useCurrentSlideText).mockReturnValue('some slide text');
      render(<SmartSlideLink pluginUuid="test-uuid" />);
      expect(useCurrentSlideText).toHaveBeenCalledWith(pluginApi);
      expect(useSmartSlideLinks).toHaveBeenCalledWith('some slide text');
    });
  });

  describe('toolbar buttons', () => {
    it('clears the toolbar and menu items when the slide has no links', () => {
      render(<SmartSlideLink pluginUuid="test-uuid" />);
      expect(setPresentationToolbarItems).toHaveBeenCalledWith([]);
      expect(setPresentationDropdownItems).toHaveBeenCalledWith([]);
    });

    it(`registers at most ${MAX_TOOLBAR_LINKS} toolbar buttons`, () => {
      vi.mocked(useSmartSlideLinks).mockReturnValue(linksOf(MAX_TOOLBAR_LINKS));
      render(<SmartSlideLink pluginUuid="test-uuid" />);
      expect(setPresentationToolbarItems.mock.calls[0][0]).toHaveLength(MAX_TOOLBAR_LINKS);
      expect(setPresentationDropdownItems).toHaveBeenCalledWith([]);
    });

    it('moves the links that do not fit on the toolbar to the presentation menu', () => {
      vi.mocked(useSmartSlideLinks).mockReturnValue(linksOf(MAX_TOOLBAR_LINKS + 2));
      render(<SmartSlideLink pluginUuid="test-uuid" />);

      // The links that fit, plus the "+N" button.
      expect(setPresentationToolbarItems.mock.calls[0][0]).toHaveLength(MAX_TOOLBAR_LINKS + 1);
      expect(setPresentationDropdownItems.mock.calls[0][0]).toHaveLength(2);
      expect(optionProps(0)).toMatchObject({
        label: `L${MAX_TOOLBAR_LINKS} ↗ l${MAX_TOOLBAR_LINKS}.com`,
        icon: 'external',
        dataTest: 'smartSlideLinkMenuItem-0',
      });
      expect(optionProps(1)).toMatchObject({ dataTest: 'smartSlideLinkMenuItem-1' });
    });

    it('moves a link to the menu when the toolbar text would get too long', () => {
      vi.mocked(useSmartSlideLinks).mockReturnValue([
        { url: 'https://course.example', label: 'Course materials and readings' },
        { url: 'https://forms.example', label: 'Submit your assignment' },
      ]);
      render(<SmartSlideLink pluginUuid="test-uuid" />);

      // The link that fits, plus the "+1" button.
      expect(setPresentationToolbarItems.mock.calls[0][0]).toHaveLength(2);
      expect(setPresentationDropdownItems.mock.calls[0][0]).toHaveLength(1);
      expect(optionProps(0)).toMatchObject({ label: 'Submit your assignment ↗ forms.example' });
    });

    it('adds no "+" button when every link fits on the toolbar', () => {
      vi.mocked(useSmartSlideLinks).mockReturnValue(linksOf(MAX_TOOLBAR_LINKS));
      render(<SmartSlideLink pluginUuid="test-uuid" />);
      expect(moreButtonProps()).toBeUndefined();
    });

    it('ends the toolbar with a "+N" button counting the links in the menu', () => {
      vi.mocked(useSmartSlideLinks).mockReturnValue(linksOf(MAX_TOOLBAR_LINKS + 3));
      render(<SmartSlideLink pluginUuid="test-uuid" />);

      const toolbar = setPresentationToolbarItems.mock.calls[0][0];
      expect(toolbar[toolbar.length - 1]).toMatchObject({ label: '+3', dataTest: MORE_LINKS_DATA_TEST });
      expect(moreButtonProps()?.tooltip)
        .toBe('3 more links are in the presentation options menu, at the top right of the slide');
    });

    it('uses the translated "+N" tooltip once the locale messages load', () => {
      const formatMessage = vi.fn(() => 'Mais 3 links estão no menu');
      vi.mocked(usePluginIntl).mockReturnValue({ formatMessage } as never);
      vi.mocked(useSmartSlideLinks).mockReturnValue(linksOf(MAX_TOOLBAR_LINKS + 3));
      render(<SmartSlideLink pluginUuid="test-uuid" />);

      expect(formatMessage).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'smartSlideLink.moreButton.tooltip' }),
        { count: 3 },
      );
      expect(moreButtonProps()?.tooltip).toBe('Mais 3 links estão no menu');
    });

    it('tells where the other links are, with a client notification, when "+N" is clicked', () => {
      vi.mocked(useSmartSlideLinks).mockReturnValue(linksOf(MAX_TOOLBAR_LINKS + 1));
      render(<SmartSlideLink pluginUuid="test-uuid" />);

      moreButtonProps()?.onClick();
      expect(sendNotification).toHaveBeenCalledTimes(1);
      expect(sendNotification).toHaveBeenCalledWith({
        message: '1 more link is in the presentation options menu, at the top right of the slide',
        icon: 'more',
        type: 'info',
      });
    });

    it('does not fail when the client offers no ui commands', () => {
      vi.mocked(BbbPluginSdk.getPluginApi).mockReturnValue(
        { setPresentationToolbarItems, setPresentationDropdownItems } as never,
      );
      vi.mocked(useSmartSlideLinks).mockReturnValue(linksOf(MAX_TOOLBAR_LINKS + 1));
      render(<SmartSlideLink pluginUuid="test-uuid" />);
      expect(() => moreButtonProps()?.onClick()).not.toThrow();
    });

    it('opens its own link, safely, when a menu item is clicked', () => {
      const windowOpen = vi.spyOn(window, 'open').mockReturnValue(null);
      vi.mocked(useSmartSlideLinks).mockReturnValue(linksOf(MAX_TOOLBAR_LINKS + 2));
      render(<SmartSlideLink pluginUuid="test-uuid" />);

      optionProps(1).onClick();
      expect(windowOpen).toHaveBeenLastCalledWith(`https://l${MAX_TOOLBAR_LINKS + 1}.com`, '_blank', 'noopener,noreferrer');
    });

    it('registers one button per link, in order, labelled with the link label and its site', () => {
      vi.mocked(useSmartSlideLinks).mockReturnValue([
        { url: 'https://a.com', label: 'A' },
        { url: 'https://b.com', label: 'B' },
      ]);
      render(<SmartSlideLink pluginUuid="test-uuid" />);

      expect(PresentationToolbarButton).toHaveBeenCalledTimes(2);
      expect(buttonProps(0)).toMatchObject({ label: 'A ↗ a.com', dataTest: 'smartSlideLinkButton-0' });
      expect(buttonProps(1)).toMatchObject({ label: 'B ↗ b.com', dataTest: 'smartSlideLinkButton-1' });
      const [buttons] = setPresentationToolbarItems.mock.calls[0];
      expect(buttons).toHaveLength(2);
    });

    it('uses the label and the url as tooltip, in English, until the locale messages load', () => {
      vi.mocked(useSmartSlideLinks).mockReturnValue([{ url: 'https://example.com/', label: 'Example' }]);
      render(<SmartSlideLink pluginUuid="test-uuid" />);
      expect(buttonProps(0).tooltip?.replace(/\u200B/g, ''))
        .toBe('Example \u2014 open https://example.com/ in a new tab');
    });

    it('uses the translated tooltip once the locale messages load', () => {
      const formatMessage = vi.fn(() => 'Example \u2014 abrir https://example.com/ em uma nova aba');
      vi.mocked(usePluginIntl).mockReturnValue({ formatMessage } as never);
      vi.mocked(useSmartSlideLinks).mockReturnValue([{ url: 'https://example.com/', label: 'Example' }]);

      render(<SmartSlideLink pluginUuid="test-uuid" />);

      expect(formatMessage).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'smartSlideLink.button.tooltip' }),
        { label: 'Example', url: 'https:/\u200B/\u200Bexample.com/\u200B' },
      );
      expect(buttonProps(0).tooltip).toBe('Example \u2014 abrir https://example.com/ em uma nova aba');
    });

    it('replaces the toolbar items when the links change', () => {
      const { rerender } = render(<SmartSlideLink pluginUuid="test-uuid" />);
      expect(setPresentationToolbarItems).toHaveBeenLastCalledWith([]);

      vi.mocked(useSmartSlideLinks).mockReturnValue([{ url: 'https://new.com', label: 'New' }]);
      rerender(<SmartSlideLink pluginUuid="test-uuid" />);

      expect(setPresentationToolbarItems).toHaveBeenCalledTimes(2);
      expect(buttonProps(0)).toMatchObject({ label: 'New ↗ new.com' });
    });

    it('opens its own link, safely, when a button is clicked', () => {
      const windowOpen = vi.spyOn(window, 'open').mockReturnValue(null);
      vi.mocked(useSmartSlideLinks).mockReturnValue([
        { url: 'https://first.com', label: 'First' },
        { url: 'https://second.com', label: 'Second' },
      ]);
      render(<SmartSlideLink pluginUuid="test-uuid" />);

      buttonProps(1).onClick();
      expect(windowOpen).toHaveBeenLastCalledWith('https://second.com', '_blank', 'noopener,noreferrer');
      buttonProps(0).onClick();
      expect(windowOpen).toHaveBeenLastCalledWith('https://first.com', '_blank', 'noopener,noreferrer');
    });
  });
});
