import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { routerState } from '../src/router-state.svelte';
import { push, replace } from '../src/navigation';
import { beforeEach as registerBeforeEach, clearGuards } from '../src/guards';
import { createRouterMode, getRouterMode, resetRouterMode } from '../src/router-mode';

/**
 * Regression tests for webview reload / Android BF-list bugs around replace().
 *
 * Prefer a SINGLE history.replaceState that preserves the position tag.
 * Hash mode on old Android WebKits (or when replaceState throws) uses
 * location.replace, then one same-URL replaceState to restore __brsr_pos.
 */

/** Flush pending microtasks/timers so async guard resolution settles. */
const flush = () => new Promise((r) => setTimeout(r, 0));

describe.each([
  ['hash' as const, () => {
    window.location.hash = '#/start';
  }],
  ['history' as const, () => {
    window.history.replaceState(null, '', '/start');
  }],
])('replace() issues a single history.replaceState (%s mode)', (mode, seedUrl) => {
  beforeEach(async () => {
    clearGuards();
    resetRouterMode();
    createRouterMode({ mode });
    seedUrl();
    routerState.reinitializeListener();
    await flush();
  });

  afterEach(() => {
    clearGuards();
    vi.restoreAllMocks();
    window.location.hash = '';
  });

  it('calls history.replaceState exactly once for a programmatic replace', async () => {
    registerBeforeEach(() => true);

    const spy = vi.spyOn(window.history, 'replaceState');

    await replace('/target');
    await flush();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(getRouterMode().getCurrentPath()).toBe('/target');
  });

  it('preserves the position tag across replace (so revert still works)', async () => {
    registerBeforeEach(() => true);

    await push('/a');
    await flush();
    const posBefore = (window.history.state as { __brsr_pos?: number })?.__brsr_pos;
    expect(typeof posBefore).toBe('number');

    await replace('/b');
    await flush();

    const posAfter = (window.history.state as { __brsr_pos?: number })?.__brsr_pos;
    expect(posAfter).toBe(posBefore);
  });
});

describe('hash replace fallbacks', () => {
  beforeEach(async () => {
    clearGuards();
    resetRouterMode();
    createRouterMode({ mode: 'hash' });
    window.location.hash = '#/start';
    routerState.reinitializeListener();
    await flush();
  });

  afterEach(() => {
    clearGuards();
    vi.restoreAllMocks();
    window.location.hash = '';
  });

  it('falls back to location.replace when replaceState throws, then tags position', async () => {
    registerBeforeEach(() => true);

    const posBefore = (window.history.state as { __brsr_pos?: number })?.__brsr_pos;
    expect(typeof posBefore).toBe('number');

    let adapterAttempts = 0;
    vi.spyOn(window.history, 'replaceState').mockImplementation(function (
      this: History,
      data: unknown,
      unused: string,
      url?: string | URL | null
    ) {
      // First call is the adapter's replaceState (must fail → location.replace).
      // Later calls are same-URL position tagging and must succeed.
      if (adapterAttempts === 0) {
        adapterAttempts++;
        throw new Error('Safari quota exceeded');
      }
      return History.prototype.replaceState.call(this, data, unused, url as string);
    });

    await replace('/target');
    await flush();

    expect(getRouterMode().getCurrentPath()).toBe('/target');
    expect(window.location.hash).toBe('#/target');
    expect(adapterAttempts).toBe(1);
    expect((window.history.state as { __brsr_pos?: number })?.__brsr_pos).toBe(posBefore);
  });

  it('uses location.replace on old Android WebKit UA, then tags with one same-URL replaceState', async () => {
    registerBeforeEach(() => true);

    // vue-router 3 supportsPushState blacklist shape (no Chrome).
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Linux; U; Android 4.0.3; en-us) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30'
    );

    const posBefore = (window.history.state as { __brsr_pos?: number })?.__brsr_pos;
    expect(typeof posBefore).toBe('number');

    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

    await replace('/target');
    await flush();

    expect(getRouterMode().getCurrentPath()).toBe('/target');
    expect(window.location.hash).toBe('#/target');
    // URL change via location.replace; only the position tag hits replaceState.
    expect(replaceStateSpy).toHaveBeenCalledTimes(1);
    expect((window.history.state as { __brsr_pos?: number })?.__brsr_pos).toBe(posBefore);
  });

  it('uses replaceState on modern Android Chrome UA', async () => {
    registerBeforeEach(() => true);

    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Linux; Android 14; Pixel) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
    );

    const spy = vi.spyOn(window.history, 'replaceState');

    await replace('/target');
    await flush();

    expect(getRouterMode().getCurrentPath()).toBe('/target');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(typeof (window.history.state as { __brsr_pos?: number })?.__brsr_pos).toBe('number');
  });
});

describe('hashchange + popstate coalescing', () => {
  beforeEach(async () => {
    clearGuards();
    resetRouterMode();
    createRouterMode({ mode: 'hash' });
    window.location.hash = '#/home';
    routerState.reinitializeListener();
    await flush();
  });

  afterEach(() => {
    clearGuards();
    vi.restoreAllMocks();
    window.location.hash = '';
  });

  it('runs beforeEach only once when hashchange and popstate fire together', async () => {
    const guard = vi.fn(() => true);
    registerBeforeEach(guard);

    // Commit current entry so the next browser event is not treated as an echo.
    await push('/a');
    await flush();
    guard.mockClear();

    window.location.hash = '#/b';
    window.dispatchEvent(new Event('popstate'));
    window.dispatchEvent(new Event('hashchange'));
    await flush();

    expect(getRouterMode().getCurrentPath()).toBe('/b');
    expect(guard).toHaveBeenCalledTimes(1);
  });
});
