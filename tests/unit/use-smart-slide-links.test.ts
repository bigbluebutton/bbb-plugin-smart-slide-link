import {
  describe, expect, it, vi,
} from 'vitest';
import { renderHook } from '@testing-library/react';
import { pluginLogger } from 'bigbluebutton-html-plugin-sdk';
import { useSmartSlideLinks } from '../../src/components/smart-slide-link/hooks';

vi.mock('bigbluebutton-html-plugin-sdk', async () => (await import('./helpers/sdk-mock')).createSdkMock());

const SLIDE_A = 'BBB{"links":[{"url":"https://a.com","label":"A"}]}';
const SLIDE_B = 'BBB{"links":[{"url":"https://b.com","label":"B"}]}';

describe('useSmartSlideLinks', () => {
  it('returns the same array reference while the slide text is unchanged', () => {
    const { result, rerender } = renderHook(({ t }) => useSmartSlideLinks(t), {
      initialProps: { t: SLIDE_A },
    });
    const firstRef = result.current;
    rerender({ t: SLIDE_A });
    expect(result.current).toBe(firstRef);
  });

  it('recomputes when the slide text arrives', () => {
    const { result, rerender } = renderHook(({ t }) => useSmartSlideLinks(t), {
      initialProps: { t: null as string | null },
    });
    expect(result.current).toEqual([]);

    rerender({ t: SLIDE_A });
    expect(result.current).toEqual([{ url: 'https://a.com/', label: 'A' }]);
  });

  it('recomputes when the presenter moves to another slide', () => {
    const { result, rerender } = renderHook(({ t }) => useSmartSlideLinks(t), {
      initialProps: { t: SLIDE_A },
    });
    rerender({ t: SLIDE_B });
    expect(result.current).toEqual([{ url: 'https://b.com/', label: 'B' }]);
  });

  it('logs at debug level how many links a slide has, and nothing for a slide without links', () => {
    const { rerender } = renderHook(({ t }) => useSmartSlideLinks(t), {
      initialProps: { t: 'plain slide' },
    });
    expect(pluginLogger.debug).not.toHaveBeenCalled();

    rerender({ t: SLIDE_A });
    expect(pluginLogger.debug).toHaveBeenCalledWith(
      { logCode: 'smart_slide_link_links_detected', count: 1 },
      expect.any(String),
    );
  });
});
