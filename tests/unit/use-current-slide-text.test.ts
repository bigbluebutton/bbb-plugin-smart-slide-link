import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { PluginApi, pluginLogger } from 'bigbluebutton-html-plugin-sdk';
import { useCurrentSlideText } from '../../src/components/smart-slide-link/hooks';

vi.mock('bigbluebutton-html-plugin-sdk', async () => (await import('./helpers/sdk-mock')).createSdkMock());

interface PresentationState {
  textUri?: string;
  loading?: boolean;
  error?: object;
}

function makePluginApi(getState: () => PresentationState): PluginApi {
  return {
    useCurrentPresentation: () => {
      const { textUri, loading = false, error } = getState();
      return {
        loading,
        error,
        data: textUri !== undefined
          ? { presentationId: 'p1', currentPage: { id: 'pg', num: 1, urlsJson: { text: textUri } } }
          : undefined,
      };
    },
  } as unknown as PluginApi;
}

function okResponse(text: string) {
  return { ok: true, status: 200, text: () => Promise.resolve(text) };
}

const fetchMock = vi.fn();

describe('useCurrentSlideText', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('when there is no slide text to read', () => {
    it('returns null without fetching when there is no presentation', () => {
      const { result } = renderHook(() => useCurrentSlideText(makePluginApi(() => ({}))));
      expect(result.current).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns null when the SDK does not provide useCurrentPresentation', () => {
      const { result } = renderHook(() => useCurrentSlideText({} as PluginApi));
      expect(result.current).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('does not fetch while the presentation is still loading', () => {
      const pluginApi = makePluginApi(() => ({ textUri: 'https://bbb/slide.txt', loading: true }));
      const { result } = renderHook(() => useCurrentSlideText(pluginApi));
      expect(result.current).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('logs and returns null when the presentation subscription fails', () => {
      const error = { message: 'boom' };
      const pluginApi = makePluginApi(() => ({ textUri: 'https://bbb/slide.txt', error }));
      const { result } = renderHook(() => useCurrentSlideText(pluginApi));
      expect(result.current).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(pluginLogger.error).toHaveBeenCalledWith(
        { logCode: 'smart_slide_link_presentation_error', error },
        expect.any(String),
      );
    });
  });

  describe('when the slide has a text url', () => {
    it('fetches the slide text and returns it', async () => {
      fetchMock.mockResolvedValue(okResponse('Hello slide'));
      const pluginApi = makePluginApi(() => ({ textUri: 'https://bbb/slide.txt' }));

      const { result } = renderHook(() => useCurrentSlideText(pluginApi));

      await waitFor(() => expect(result.current).toBe('Hello slide'));
      expect(fetchMock).toHaveBeenCalledWith('https://bbb/slide.txt', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    });

    it('authenticates the slide text request with the session token', async () => {
      fetchMock.mockResolvedValue(okResponse('Hello slide'));
      const pluginApi = makePluginApi(() => ({ textUri: 'https://bbb/textfiles/1?pageToken=p' }));
      pluginApi.getSessionToken = () => 'tok';

      const { result } = renderHook(() => useCurrentSlideText(pluginApi));

      await waitFor(() => expect(result.current).toBe('Hello slide'));
      expect(fetchMock).toHaveBeenCalledWith(
        'https://bbb/textfiles/1?pageToken=p&sessionToken=tok',
        expect.anything(),
      );
    });

    it('logs and returns null when the fetch rejects', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'));
      const pluginApi = makePluginApi(() => ({ textUri: 'https://bbb/slide.txt' }));

      const { result } = renderHook(() => useCurrentSlideText(pluginApi));

      await waitFor(() => expect(pluginLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ logCode: 'smart_slide_link_slide_text_fetch_failed' }),
        expect.any(String),
      ));
      expect(result.current).toBeNull();
    });

    it('does not use the body of an error response as slide text', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 404, text: () => Promise.resolve('BBB{"links":[]}') });
      const pluginApi = makePluginApi(() => ({ textUri: 'https://bbb/slide.txt' }));

      const { result } = renderHook(() => useCurrentSlideText(pluginApi));

      await waitFor(() => expect(pluginLogger.error).toHaveBeenCalledWith(
        { logCode: 'smart_slide_link_slide_text_fetch_failed', error: 'Error: HTTP 404' },
        expect.any(String),
      ));
      expect(result.current).toBeNull();
    });

    it('re-fetches when the slide changes', async () => {
      fetchMock
        .mockResolvedValueOnce(okResponse('Slide 1'))
        .mockResolvedValueOnce(okResponse('Slide 2'));
      let textUri = 'https://bbb/slide1.txt';
      const pluginApi = makePluginApi(() => ({ textUri }));

      const { result, rerender } = renderHook(() => useCurrentSlideText(pluginApi));
      await waitFor(() => expect(result.current).toBe('Slide 1'));

      textUri = 'https://bbb/slide2.txt';
      rerender();

      await waitFor(() => expect(result.current).toBe('Slide 2'));
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('clears the previous slide text as soon as the slide changes', async () => {
      fetchMock
        .mockResolvedValueOnce(okResponse('Slide 1'))
        .mockReturnValueOnce(new Promise(() => {}));
      let textUri = 'https://bbb/slide1.txt';
      const pluginApi = makePluginApi(() => ({ textUri }));

      const { result, rerender } = renderHook(() => useCurrentSlideText(pluginApi));
      await waitFor(() => expect(result.current).toBe('Slide 1'));

      textUri = 'https://bbb/slide2.txt';
      rerender();

      expect(result.current).toBeNull();
    });

    it('ignores a late response for a slide that is no longer shown', async () => {
      let resolveSlide1: (value: ReturnType<typeof okResponse>) => void = () => {};
      fetchMock
        .mockReturnValueOnce(new Promise((resolve) => { resolveSlide1 = resolve; }))
        .mockResolvedValueOnce(okResponse('Slide 2'));
      let textUri = 'https://bbb/slide1.txt';
      const pluginApi = makePluginApi(() => ({ textUri }));

      const { result, rerender } = renderHook(() => useCurrentSlideText(pluginApi));
      textUri = 'https://bbb/slide2.txt';
      rerender();
      await waitFor(() => expect(result.current).toBe('Slide 2'));

      // The real fetch rejects once aborted; resolving it here proves the hook does not rely
      // on that alone, and the abort must still keep slide 1 from replacing slide 2.
      await act(async () => { resolveSlide1(okResponse('Slide 1')); });

      expect(result.current).toBe('Slide 2');
      const [, firstInit] = fetchMock.mock.calls[0];
      expect((firstInit as RequestInit).signal?.aborted).toBe(true);
    });

    it('resets to null when the presentation goes away', async () => {
      fetchMock.mockResolvedValue(okResponse('Slide text'));
      let textUri: string | undefined = 'https://bbb/slide.txt';
      const pluginApi = makePluginApi(() => ({ textUri }));

      const { result, rerender } = renderHook(() => useCurrentSlideText(pluginApi));
      await waitFor(() => expect(result.current).toBe('Slide text'));

      textUri = undefined;
      rerender();

      expect(result.current).toBeNull();
    });
  });
});
