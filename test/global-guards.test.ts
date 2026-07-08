import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { routerState } from '../src/router-state.svelte';
import {
  beforeEach as registerBeforeEach,
  clearGuards,
} from '../src/guards';
import { push } from '../src/navigation';
import { createRouterMode, getRouterMode, resetRouterMode } from '../src/router-mode';

/**
 * Regression tests for the global navigation-guard fix.
 *
 * Previously `beforeEach` guards only ran inside programmatic `push()` /
 * `replace()`. Initial load, refresh, deep-links and browser back/forward
 * (popstate / hashchange) bypassed guards entirely, so an auth guard could be
 * silently skipped. These tests assert guards now run for browser-driven
 * navigation and correctly redirect / cancel.
 */

/** Flush pending microtasks/timers so async guard resolution settles. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('global navigation guards (hash mode)', () => {
  beforeEach(() => {
    clearGuards();
    resetRouterMode();
    createRouterMode({ mode: 'hash' });
    window.location.hash = '';
    // Rebind the router-state listener to the freshly created hash adapter and
    // reset the committed path to the current (root) location.
    routerState.reinitializeListener();
  });

  afterEach(() => {
    clearGuards();
    window.location.hash = '';
  });

  it('runs beforeEach on hashchange and redirects when unauthenticated', async () => {
    const authenticated = false;
    const seen: Array<{ from: string; to: string }> = [];

    registerBeforeEach((from, to) => {
      seen.push({ from, to });
      if (to === '/auth') return !authenticated; // allow reaching /auth only when logged out
      if (!authenticated) return '/auth'; // otherwise bounce to /auth
      return true;
    });

    // Simulate a deep-link / back-forward landing on a protected route.
    window.location.hash = '#/protected';
    window.dispatchEvent(new Event('hashchange'));
    await flush();

    // Guard fired for the protected route and redirected to /auth.
    expect(seen.some((c) => c.to === '/protected')).toBe(true);
    expect(getRouterMode().getCurrentPath()).toBe('/auth');
  });

  it('allows navigation through when the guard permits it', async () => {
    registerBeforeEach(() => true);

    window.location.hash = '#/dashboard';
    window.dispatchEvent(new Event('hashchange'));
    await flush();

    expect(getRouterMode().getCurrentPath()).toBe('/dashboard');
  });

  it('cancels navigation and reverts the URL when a guard returns false', async () => {
    // First, land on an allowed page to establish a committed path.
    let block = false;
    registerBeforeEach((_from, to) => {
      if (block && to === '/blocked') return false;
      return true;
    });

    window.location.hash = '#/home';
    window.dispatchEvent(new Event('hashchange'));
    await flush();
    expect(getRouterMode().getCurrentPath()).toBe('/home');

    // Now attempt to navigate to a blocked route.
    block = true;
    window.location.hash = '#/blocked';
    window.dispatchEvent(new Event('hashchange'));
    await flush();

    // URL is reverted back to the previously committed path.
    expect(getRouterMode().getCurrentPath()).toBe('/home');
  });
});

describe('query-only navigation runs guards (problem 1)', () => {
  beforeEach(() => {
    clearGuards();
    resetRouterMode();
    createRouterMode({ mode: 'hash' });
    window.location.hash = '';
    routerState.reinitializeListener();
  });

  afterEach(() => {
    clearGuards();
    window.location.hash = '';
  });

  it('runs beforeEach when only the query string changes on the same path', async () => {
    let calls = 0;
    registerBeforeEach(() => {
      calls++;
      return true;
    });

    // Commit to /auth (no query).
    window.location.hash = '#/auth';
    window.dispatchEvent(new Event('hashchange'));
    await flush();
    const callsAfterFirst = calls;

    // Simulate a native shell injecting a token via a query-only hash change.
    window.location.hash = '#/auth?token=abc';
    window.dispatchEvent(new Event('hashchange'));
    await flush();

    // The guard ran again even though the path is unchanged.
    expect(calls).toBeGreaterThan(callsAfterFirst);
    // Reactive state reflects the new query.
    expect(getRouterMode().getCurrentSearch()).toBe('?token=abc');
    expect(routerState.query.token).toBe('abc');
  });

  it('does not re-run guards for the browser echo of a programmatic push', async () => {
    let calls = 0;
    registerBeforeEach(() => {
      calls++;
      return true;
    });

    await push('/x');
    await flush();

    // Only the push()'s own guard ran; the hashchange echo was suppressed.
    expect(calls).toBe(1);
    expect(getRouterMode().getCurrentPath()).toBe('/x');
  });
});

describe('history-stack preserving revert (problem 2)', () => {
  beforeEach(() => {
    clearGuards();
    resetRouterMode();
    createRouterMode({ mode: 'hash' });
    window.location.hash = '';
    routerState.reinitializeListener();
  });

  afterEach(() => {
    clearGuards();
    vi.restoreAllMocks();
    window.location.hash = '';
  });

  /**
   * When a back/forward navigation to a *tagged* entry is cancelled, the router
   * must restore position via `history.go(-delta)` (which preserves the
   * forward/back stack) rather than `replaceState` (which would flatten it).
   *
   * Note: jsdom's session-history cursor is unreliable for programmatic
   * back/forward after async hash pushes, so we assert the mechanism (the exact
   * `history.go` delta) instead of relying on jsdom to perform the traversal.
   */
  it('reverts a cancelled back-navigation via history.go with the correct delta', async () => {
    let block = false;
    registerBeforeEach((_from, to) => {
      if (block && to === '/a') return false;
      return true;
    });

    // Build two tagged, committed entries: /a then /b.
    await push('/a');
    await flush();
    await push('/b');
    await flush();
    expect(getRouterMode().getCurrentPath()).toBe('/b');

    // Simulate the browser moving back one entry to the tagged /a entry.
    // (Emulated because jsdom's real back() cursor is unreliable here.)
    const posB = Number((window.history.state as { __brsr_pos?: number })?.__brsr_pos);
    window.location.hash = '#/a';
    window.history.replaceState({ __brsr_pos: posB - 1 }, '', window.location.href);

    // Intercept the revert traversal (jsdom cannot perform it reliably).
    const goSpy = vi.spyOn(window.history, 'go').mockImplementation(() => {});

    block = true;
    window.dispatchEvent(new Event('hashchange'));
    await flush();

    // Moving back 1 is undone by going forward 1 -> history.go(1).
    expect(goSpy).toHaveBeenCalledTimes(1);
    expect(goSpy).toHaveBeenCalledWith(1);
  });

  it('falls back to replaceState when the target entry is untagged (external)', async () => {
    let block = false;
    registerBeforeEach((_from, to) => {
      if (block && to === '/blocked') return false;
      return true;
    });

    // Commit to an allowed page.
    window.location.hash = '#/home';
    window.dispatchEvent(new Event('hashchange'));
    await flush();
    expect(getRouterMode().getCurrentPath()).toBe('/home');

    // An external, untagged navigation to a blocked route is cancelled.
    const goSpy = vi.spyOn(window.history, 'go');
    block = true;
    window.location.hash = '#/blocked';
    window.dispatchEvent(new Event('hashchange'));
    await flush();

    // No history traversal (delta unknown); the URL is rewritten back instead.
    expect(goSpy).not.toHaveBeenCalled();
    expect(getRouterMode().getCurrentPath()).toBe('/home');
  });
});
