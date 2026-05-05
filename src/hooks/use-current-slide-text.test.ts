import { renderHook, waitFor } from '@testing-library/react';
import useCurrentSlideText from './use-current-slide-text';

// PluginApi is used only as a TS type in the hook, so we pass plain mock objects.
function makePluginApi(textUri?: string) {
  return {
    useCurrentPresentation: jest.fn(() => ({
      data: textUri !== undefined
        ? { currentPage: { urlsJson: { text: textUri } } }
        : undefined,
    })),
  };
}

describe('useCurrentSlideText', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('when presentation data is unavailable', () => {
    it('returns null when presentation data is undefined', () => {
      const pluginApi = { useCurrentPresentation: jest.fn(() => ({ data: undefined })) };
      const { result } = renderHook(() => useCurrentSlideText(pluginApi as any));
      expect(result.current).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('returns null when useCurrentPresentation is not present on the api (optional chaining)', () => {
      // The hook uses ?. so a missing method falls back to { data: undefined }
      const { result } = renderHook(() => useCurrentSlideText({} as any));
      expect(result.current).toBeNull();
    });

    it('returns null when textUri is undefined', () => {
      const pluginApi = {
        useCurrentPresentation: jest.fn(() => ({
          data: { currentPage: { urlsJson: { text: undefined } } },
        })),
      };
      const { result } = renderHook(() => useCurrentSlideText(pluginApi as any));
      expect(result.current).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('when textUri is provided', () => {
    it('fetches the slide text and returns it', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        text: () => Promise.resolve('Hello slide'),
      });
      const pluginApi = makePluginApi('https://bbb.example.com/slide.txt');

      const { result } = renderHook(() => useCurrentSlideText(pluginApi as any));

      await waitFor(() => expect(result.current).toBe('Hello slide'));
      expect(global.fetch).toHaveBeenCalledWith('https://bbb.example.com/slide.txt');
    });

    it('returns null when fetch rejects', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
      const pluginApi = makePluginApi('https://bbb.example.com/slide.txt');

      const { result } = renderHook(() => useCurrentSlideText(pluginApi as any));

      await waitFor(() => expect(global.fetch).toHaveBeenCalled());
      expect(result.current).toBeNull();
    });

    it('re-fetches when textUri changes', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ text: () => Promise.resolve('Slide 1') })
        .mockResolvedValueOnce({ text: () => Promise.resolve('Slide 2') });

      let currentUri = 'https://bbb.example.com/slide1.txt';
      const pluginApi = {
        useCurrentPresentation: jest.fn(() => ({
          data: { currentPage: { urlsJson: { text: currentUri } } },
        })),
      };

      const { result, rerender } = renderHook(() => useCurrentSlideText(pluginApi as any));

      await waitFor(() => expect(result.current).toBe('Slide 1'));

      currentUri = 'https://bbb.example.com/slide2.txt';
      rerender();

      await waitFor(() => expect(result.current).toBe('Slide 2'));
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('resets to null when textUri becomes undefined', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        text: () => Promise.resolve('Slide text'),
      });

      let currentUri: string | undefined = 'https://bbb.example.com/slide.txt';
      const pluginApi = {
        useCurrentPresentation: jest.fn(() => ({
          data: currentUri ? { currentPage: { urlsJson: { text: currentUri } } } : undefined,
        })),
      };

      const { result, rerender } = renderHook(() => useCurrentSlideText(pluginApi as any));
      await waitFor(() => expect(result.current).toBe('Slide text'));

      currentUri = undefined;
      rerender();

      expect(result.current).toBeNull();
    });
  });
});
