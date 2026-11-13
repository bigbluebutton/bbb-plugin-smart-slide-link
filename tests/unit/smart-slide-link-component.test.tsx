import * as React from 'react';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { render } from '@testing-library/react';
import { BbbPluginSdk, PresentationToolbarButton } from 'bigbluebutton-html-plugin-sdk';
import { usePluginIntl } from '../../src/commons/hooks';
import { useCurrentSlideText, useSmartSlideLinks } from '../../src/components/smart-slide-link/hooks';
import SmartSlideLink from '../../src/components/smart-slide-link/component';

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
const pluginApi = { setPresentationToolbarItems };

type ButtonProps = ConstructorParameters<typeof PresentationToolbarButton>[0];
const buttonProps = (call: number): ButtonProps => (
  vi.mocked(PresentationToolbarButton).mock.calls[call][0]
);

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
    it('clears the toolbar items when the slide has no links', () => {
      render(<SmartSlideLink pluginUuid="test-uuid" />);
      expect(setPresentationToolbarItems).toHaveBeenCalledWith([]);
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

    it('uses the url as tooltip until the locale messages load', () => {
      vi.mocked(useSmartSlideLinks).mockReturnValue([{ url: 'https://example.com', label: 'Example' }]);
      render(<SmartSlideLink pluginUuid="test-uuid" />);
      expect(buttonProps(0).tooltip).toBe('https://example.com');
    });

    it('uses the translated tooltip once the locale messages load', () => {
      const formatMessage = vi.fn(() => 'Abrir https://example.com em uma nova aba');
      vi.mocked(usePluginIntl).mockReturnValue({ formatMessage } as never);
      vi.mocked(useSmartSlideLinks).mockReturnValue([{ url: 'https://example.com', label: 'Example' }]);

      render(<SmartSlideLink pluginUuid="test-uuid" />);

      expect(formatMessage).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'smartSlideLink.button.tooltip' }),
        { url: 'https://example.com' },
      );
      expect(buttonProps(0).tooltip).toBe('Abrir https://example.com em uma nova aba');
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
