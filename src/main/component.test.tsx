import * as React from 'react';
import { render } from '@testing-library/react';
import { BbbPluginSdk, PresentationToolbarButton } from 'bigbluebutton-html-plugin-sdk';
import useCurrentSlideText from '../hooks/use-current-slide-text';
import useSmartSlideLinks from '../hooks/use-smart-slide-links';
import MainComponent from './component';

// Replace the entire SDK with jest mocks so the component never touches the real SDK.
jest.mock('bigbluebutton-html-plugin-sdk', () => ({
  BbbPluginSdk: {
    initialize: jest.fn(),
    getPluginApi: jest.fn(),
  },
  // Implement as a constructor so `new PresentationToolbarButton(props)` records calls
  // and produces a plain object with the same props.
  PresentationToolbarButton: jest.fn().mockImplementation(function (this: any, props: any) {
    Object.assign(this, props);
  }),
}));

jest.mock('../hooks/use-current-slide-text');
jest.mock('../hooks/use-smart-slide-links');

const mockSetPresentationToolbarItems = jest.fn();
const mockPluginApi = { setPresentationToolbarItems: mockSetPresentationToolbarItems };

beforeEach(() => {
  jest.clearAllMocks();
  (BbbPluginSdk.getPluginApi as jest.Mock).mockReturnValue(mockPluginApi);
  (useCurrentSlideText as jest.Mock).mockReturnValue(null);
  (useSmartSlideLinks as jest.Mock).mockReturnValue([]);
});

describe('MainComponent', () => {
  describe('rendering', () => {
    it('renders nothing to the DOM', () => {
      const { container } = render(<MainComponent pluginUuid="test-uuid" />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('SDK initialization', () => {
    it('calls BbbPluginSdk.initialize with the given uuid', () => {
      render(<MainComponent pluginUuid="my-uuid" />);
      expect(BbbPluginSdk.initialize).toHaveBeenCalledWith('my-uuid');
    });

    it('calls BbbPluginSdk.getPluginApi with the given uuid', () => {
      render(<MainComponent pluginUuid="my-uuid" />);
      expect(BbbPluginSdk.getPluginApi).toHaveBeenCalledWith('my-uuid');
    });
  });

  describe('hook wiring', () => {
    it('passes the plugin api to useCurrentSlideText', () => {
      render(<MainComponent pluginUuid="test-uuid" />);
      expect(useCurrentSlideText).toHaveBeenCalledWith(mockPluginApi);
    });

    it('passes the slide text returned by useCurrentSlideText to useSmartSlideLinks', () => {
      (useCurrentSlideText as jest.Mock).mockReturnValue('some slide text');
      render(<MainComponent pluginUuid="test-uuid" />);
      expect(useSmartSlideLinks).toHaveBeenCalledWith('some slide text');
    });

    it('passes null slide text to useSmartSlideLinks when no slide is active', () => {
      (useCurrentSlideText as jest.Mock).mockReturnValue(null);
      render(<MainComponent pluginUuid="test-uuid" />);
      expect(useSmartSlideLinks).toHaveBeenCalledWith(null);
    });
  });

  describe('toolbar button registration', () => {
    it('calls setPresentationToolbarItems with an empty array when there are no links', () => {
      render(<MainComponent pluginUuid="test-uuid" />);
      expect(mockSetPresentationToolbarItems).toHaveBeenCalledWith([]);
    });

    it('creates one PresentationToolbarButton per link', () => {
      (useSmartSlideLinks as jest.Mock).mockReturnValue([
        { url: 'https://a.com', label: 'A' },
        { url: 'https://b.com', label: 'B' },
      ]);
      render(<MainComponent pluginUuid="test-uuid" />);
      expect(PresentationToolbarButton).toHaveBeenCalledTimes(2);
    });

    it('sets the button label from the link label', () => {
      (useSmartSlideLinks as jest.Mock).mockReturnValue([{ url: 'https://example.com', label: 'My Link' }]);
      render(<MainComponent pluginUuid="test-uuid" />);
      expect(PresentationToolbarButton).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'My Link' }),
      );
    });

    it('sets the button tooltip to the link url', () => {
      (useSmartSlideLinks as jest.Mock).mockReturnValue([{ url: 'https://example.com', label: 'My Link' }]);
      render(<MainComponent pluginUuid="test-uuid" />);
      expect(PresentationToolbarButton).toHaveBeenCalledWith(
        expect.objectContaining({ tooltip: 'https://example.com' }),
      );
    });

    it('passes the constructed button instances to setPresentationToolbarItems', () => {
      (useSmartSlideLinks as jest.Mock).mockReturnValue([
        { url: 'https://a.com', label: 'A' },
        { url: 'https://b.com', label: 'B' },
      ]);
      render(<MainComponent pluginUuid="test-uuid" />);
      const [buttons] = mockSetPresentationToolbarItems.mock.calls[0];
      expect(buttons).toHaveLength(2);
    });

    it('updates toolbar items when the links array changes', () => {
      const { rerender } = render(<MainComponent pluginUuid="test-uuid" />);
      expect(mockSetPresentationToolbarItems).toHaveBeenCalledTimes(1);
      expect(mockSetPresentationToolbarItems).toHaveBeenLastCalledWith([]);

      (useSmartSlideLinks as jest.Mock).mockReturnValue([{ url: 'https://new.com', label: 'New' }]);
      rerender(<MainComponent pluginUuid="test-uuid" />);

      expect(mockSetPresentationToolbarItems).toHaveBeenCalledTimes(2);
      expect(PresentationToolbarButton).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'New', tooltip: 'https://new.com' }),
      );
    });
  });

  describe('button onClick behavior', () => {
    it('opens the link url in a new tab when the button is clicked', () => {
      const windowOpenSpy = jest.spyOn(window, 'open').mockReturnValue(null);
      (useSmartSlideLinks as jest.Mock).mockReturnValue([{ url: 'https://example.com', label: 'Example' }]);

      render(<MainComponent pluginUuid="test-uuid" />);

      // Retrieve the props that were passed to the PresentationToolbarButton constructor
      const [constructorProps] = (PresentationToolbarButton as jest.Mock).mock.calls[0];
      constructorProps.onClick();

      expect(windowOpenSpy).toHaveBeenCalledWith('https://example.com', '_blank');
      windowOpenSpy.mockRestore();
    });

    it('each button onClick uses its own link url', () => {
      const windowOpenSpy = jest.spyOn(window, 'open').mockReturnValue(null);
      (useSmartSlideLinks as jest.Mock).mockReturnValue([
        { url: 'https://first.com', label: 'First' },
        { url: 'https://second.com', label: 'Second' },
      ]);

      render(<MainComponent pluginUuid="test-uuid" />);

      const { calls } = (PresentationToolbarButton as jest.Mock).mock;
      calls[0][0].onClick();
      expect(windowOpenSpy).toHaveBeenLastCalledWith('https://first.com', '_blank');

      calls[1][0].onClick();
      expect(windowOpenSpy).toHaveBeenLastCalledWith('https://second.com', '_blank');

      windowOpenSpy.mockRestore();
    });
  });
});
