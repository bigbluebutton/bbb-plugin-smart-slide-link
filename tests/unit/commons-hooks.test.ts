import {
  describe, expect, it, vi,
} from 'vitest';
import { renderHook } from '@testing-library/react';
import { PluginApi, pluginLogger } from 'bigbluebutton-html-plugin-sdk';
import { useDebugSetting, usePluginIntl, useUsageLogging } from '../../src/commons/hooks';

vi.mock('bigbluebutton-html-plugin-sdk', async () => (await import('./helpers/sdk-mock')).createSdkMock());

function apiWithSettings(state: { data?: object; loading?: boolean; error?: object }): PluginApi {
  return {
    usePluginSettings: () => ({ loading: false, ...state }),
  } as unknown as PluginApi;
}

describe('useUsageLogging', () => {
  it('logs plg_started on mount and plg_stopped on unmount with the plugin name', () => {
    const pluginApi = { pluginName: 'BbbPluginSmartSlideLink' } as PluginApi;
    const { unmount } = renderHook(() => useUsageLogging(pluginApi));

    expect(pluginLogger.info).toHaveBeenCalledWith(
      { logCode: 'plg_started' },
      'Plugin started: BbbPluginSmartSlideLink',
    );
    expect(pluginLogger.info).not.toHaveBeenCalledWith({ logCode: 'plg_stopped' }, expect.any(String));

    unmount();
    expect(pluginLogger.info).toHaveBeenCalledWith(
      { logCode: 'plg_stopped' },
      'Plugin stopped: BbbPluginSmartSlideLink',
    );
  });

  it('logs plg_started only once across re-renders', () => {
    const pluginApi = { pluginName: 'P' } as PluginApi;
    const { rerender } = renderHook(() => useUsageLogging(pluginApi));
    rerender();
    rerender();
    const startedCalls = (vi.mocked(pluginLogger.info).mock.calls as unknown[][])
      .filter(([fields]) => (fields as { logCode: string }).logCode === 'plg_started');
    expect(startedCalls).toHaveLength(1);
  });
});

describe('useDebugSetting', () => {
  it('raises the logger to debug when the debug setting is true', () => {
    renderHook(() => useDebugSetting(apiWithSettings({ data: { debug: true } })));
    expect(pluginLogger.level).toHaveBeenCalledWith('debug');
  });

  it.each([
    ['false', { debug: false }],
    ['absent', {}],
    ['not a boolean', { debug: 'true' }],
  ])('keeps the logger at info when the debug setting is %s', (_case, data) => {
    renderHook(() => useDebugSetting(apiWithSettings({ data })));
    expect(pluginLogger.level).toHaveBeenCalledWith('info');
  });

  it('does not touch the logger level while settings are loading', () => {
    renderHook(() => useDebugSetting(apiWithSettings({ loading: true })));
    expect(pluginLogger.level).not.toHaveBeenCalled();
  });

  it('logs the error and leaves the level alone when settings cannot be read', () => {
    const error = { message: 'boom' };
    renderHook(() => useDebugSetting(apiWithSettings({ error })));
    expect(pluginLogger.level).not.toHaveBeenCalled();
    expect(pluginLogger.error).toHaveBeenCalledWith(
      { logCode: 'smart_slide_link_settings_error', error },
      expect.any(String),
    );
  });

  it('follows a settings change after mount', () => {
    let data: object = { debug: false };
    const pluginApi = apiWithSettings({});
    pluginApi.usePluginSettings = () => ({ loading: false, data: data as never });
    const { rerender } = renderHook(() => useDebugSetting(pluginApi));
    expect(pluginLogger.level).toHaveBeenLastCalledWith('info');

    data = { debug: true };
    rerender();
    expect(pluginLogger.level).toHaveBeenLastCalledWith('debug');
  });
});

describe('usePluginIntl', () => {
  const messages = { 'smartSlideLink.button.tooltip': 'Abrir {url} em uma nova aba' };

  it('returns null while the locale messages are loading', () => {
    const pluginApi = {
      useLocaleMessages: () => ({ loading: true, messages: {}, currentLocale: 'pt-BR' }),
    } as unknown as PluginApi;
    const { result } = renderHook(() => usePluginIntl(pluginApi));
    expect(result.current).toBeNull();
  });

  it('formats messages in the client locale once they load', () => {
    const pluginApi = {
      useLocaleMessages: () => ({ loading: false, messages, currentLocale: 'pt-BR' }),
    } as unknown as PluginApi;
    const { result } = renderHook(() => usePluginIntl(pluginApi));
    expect(result.current?.locale).toBe('pt-BR');
    expect(result.current?.formatMessage(
      { id: 'smartSlideLink.button.tooltip' },
      { url: 'https://a.com' },
    )).toBe('Abrir https://a.com em uma nova aba');
  });

  it('keeps the same intl instance across re-renders with the same messages', () => {
    const pluginApi = {
      useLocaleMessages: () => ({ loading: false, messages, currentLocale: 'en' }),
    } as unknown as PluginApi;
    const { result, rerender } = renderHook(() => usePluginIntl(pluginApi));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
