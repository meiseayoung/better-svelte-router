import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { routerState } from '../src/router-state.svelte';
import { push, replace, back, forward, reload } from '../src/navigation';
import { beforeEach as registerBeforeEach, clearGuards } from '../src/guards';
import {
  createRouterMode,
  getRouterMode,
  resetRouterMode,
  MemoryModeAdapter,
} from '../src/router-mode';

/** Flush pending microtasks/timers so async guard resolution settles. */
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('MemoryModeAdapter', () => {
  beforeEach(() => {
    resetRouterMode();
    window.location.hash = '#/auth?token=abc&event_uuid=-1';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.location.hash = '';
  });

  it('seeds path and search from the initial location.hash', () => {
    const adapter = new MemoryModeAdapter();
    expect(adapter.getMode()).toBe('memory');
    expect(adapter.getCurrentPath()).toBe('/auth');
    expect(adapter.getCurrentSearch()).toBe('?token=abc&event_uuid=-1');
  });

  it('push/replace update the in-memory stack and optionally sync hash', () => {
    const adapter = new MemoryModeAdapter('', true);
    const spy = vi.spyOn(window.history, 'replaceState');

    adapter.push('/new-event');
    expect(adapter.getCurrentPath()).toBe('/new-event');
    expect(spy).toHaveBeenCalled();

    adapter.replace('/events/1/report/my-status');
    expect(adapter.getCurrentPath()).toBe('/events/1/report/my-status');
  });

  it('go/peekPath move within the stack and ignore out-of-bounds', () => {
    const adapter = new MemoryModeAdapter('', false);
    adapter.push('/a');
    adapter.push('/b');

    expect(adapter.peekPath(-1)).toBe('/a');
    expect(adapter.peekPath(1)).toBeNull();
    expect(adapter.go(-1)).toBe(true);
    expect(adapter.getCurrentPath()).toBe('/a');
    expect(adapter.go(-2)).toBe(false);
    expect(adapter.getCurrentPath()).toBe('/a');
  });

  it('setupListener is a no-op (WebView hash restoration ignored)', () => {
    const adapter = new MemoryModeAdapter();
    const cb = vi.fn();
    const cleanup = adapter.setupListener(cb);
    window.dispatchEvent(new Event('hashchange'));
    window.dispatchEvent(new Event('popstate'));
    expect(cb).not.toHaveBeenCalled();
    cleanup();
  });

  it('splits embedded query from path strings', () => {
    const adapter = new MemoryModeAdapter('', false);
    adapter.push('/list?type=staff');
    expect(adapter.getCurrentPath()).toBe('/list');
    expect(adapter.getCurrentSearch()).toBe('?type=staff');
  });

  it('accepts initialEntries / initialIndex like React Router', () => {
    const adapter = new MemoryModeAdapter('', false, ['/home', '/list?type=staff', '/detail'], 1);
    expect(adapter.getCurrentPath()).toBe('/list');
    expect(adapter.getCurrentSearch()).toBe('?type=staff');
    expect(adapter.getEntries()).toEqual(['/home', '/list?type=staff', '/detail']);
    expect(adapter.getIndex()).toBe(1);

    expect(adapter.go(-1)).toBe(true);
    expect(adapter.getCurrentPath()).toBe('/home');
    expect(adapter.go(2)).toBe(true);
    expect(adapter.getCurrentPath()).toBe('/detail');
  });

  it('defaults initialIndex to the last entry', () => {
    const adapter = new MemoryModeAdapter('', false, ['/a', '/b']);
    expect(adapter.getIndex()).toBe(1);
    expect(adapter.getCurrentPath()).toBe('/b');
  });

  it('getEntries reflects push/replace mutations', () => {
    const adapter = new MemoryModeAdapter('', false, ['/start']);
    adapter.push('/a');
    adapter.push('/b?q=1');
    expect(adapter.getEntries()).toEqual(['/start', '/a', '/b?q=1']);
    expect(adapter.getIndex()).toBe(2);

    adapter.replace('/b?q=2');
    expect(adapter.getEntries()).toEqual(['/start', '/a', '/b?q=2']);
  });
});

describe('memory mode navigation', () => {
  beforeEach(async () => {
    clearGuards();
    resetRouterMode();
    window.location.hash = '#/start';
    createRouterMode({ mode: 'memory', syncHash: false });
    routerState.reinitializeListener();
    await flush();
  });

  afterEach(() => {
    clearGuards();
    vi.restoreAllMocks();
    window.location.hash = '';
  });

  it('push/replace drive the memory stack and reactive path', async () => {
    registerBeforeEach(() => true);

    await push('/a');
    await flush();
    expect(getRouterMode().getCurrentPath()).toBe('/a');
    expect(routerState.pathname).toBe('/a');

    await replace('/b?x=1');
    await flush();
    expect(getRouterMode().getCurrentPath()).toBe('/b');
    expect(getRouterMode().getCurrentSearch()).toBe('?x=1');
  });

  it('ignores browser hashchange after memory bootstrap', async () => {
    registerBeforeEach(() => true);
    await push('/safe');
    await flush();

    window.location.hash = '#/auth?token=stolen';
    window.dispatchEvent(new Event('hashchange'));
    await flush();

    expect(getRouterMode().getCurrentPath()).toBe('/safe');
  });

  it('back/forward use the in-memory stack with guards', async () => {
    const guard = vi.fn(() => true);
    registerBeforeEach(guard);

    await push('/a');
    await flush();
    await push('/b');
    await flush();
    guard.mockClear();

    expect(await back()).toBe(true);
    await flush();
    expect(getRouterMode().getCurrentPath()).toBe('/a');
    expect(guard).toHaveBeenCalledTimes(1);

    expect(await forward()).toBe(true);
    await flush();
    expect(getRouterMode().getCurrentPath()).toBe('/b');
  });

  it('back returns false at the bottom of the stack', async () => {
    registerBeforeEach(() => true);
    expect(await back()).toBe(false);
  });

  it('reload syncs the current route into the hash without restoring stack', async () => {
    registerBeforeEach(() => true);

    await push('/a');
    await flush();
    await push('/b?q=1');
    await flush();

    // syncHash: false — browser hash still reflects the bootstrap URL
    expect(window.location.hash).toBe('#/start');

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    reload();
    consoleError.mockRestore();

    expect(window.location.hash).toBe('#/b?q=1');

    // Fresh boot without initialEntries → single-entry stack from hash
    createRouterMode({ mode: 'memory', syncHash: false });
    routerState.reinitializeListener();
    await flush();

    expect(getRouterMode().getCurrentPath()).toBe('/b');
    expect(getRouterMode().getEntries?.()).toEqual(['/b?q=1']);
    expect(await back()).toBe(false);
  });

  it('createRouterMode accepts initialEntries for app-managed restore', async () => {
    registerBeforeEach(() => true);
    resetRouterMode();
    createRouterMode({
      mode: 'memory',
      syncHash: false,
      initialEntries: ['/home', '/a', '/b?q=1'],
      initialIndex: 2,
    });
    routerState.reinitializeListener();
    await flush();

    expect(getRouterMode().getCurrentPath()).toBe('/b');
    expect(await back()).toBe(true);
    await flush();
    expect(getRouterMode().getCurrentPath()).toBe('/a');
  });
});
