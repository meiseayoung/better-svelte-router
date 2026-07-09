import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { routerState } from '../src/router-state.svelte';
import { push, replace } from '../src/navigation';
import { beforeEach as registerBeforeEach, clearGuards } from '../src/guards';
import { createRouterMode, resetRouterMode } from '../src/router-mode';

/**
 * Regression tests for the webview reload caused by a double history.replaceState.
 *
 * Commit 7379b3e added a follow-up replaceState (position tagging) after the
 * adapter's own replaceState, so programmatic replace() issued TWO back-to-back
 * history.replaceState calls in one turn — a pattern some PC/desktop webviews
 * reload on. The fix keeps replace() at a SINGLE replaceState: the adapter
 * preserves the (unchanged) position tag and the follow-up tagging is skipped.
 *
 * These tests count history.replaceState calls during a full replace() using
 * the real jsdom location (same-origin), which is what the webview reload
 * hinged on.
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
    // Rebind the listener to this mode and tag the current entry's position.
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

    // Spy AFTER setup so we only count the replace()'s own history writes.
    const spy = vi.spyOn(window.history, 'replaceState');

    await replace('/target');
    await flush();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('preserves the position tag across replace (so revert still works)', async () => {
    registerBeforeEach(() => true);

    // Establish a committed, tagged entry via push.
    await push('/a');
    await flush();
    const posBefore = (window.history.state as { __brsr_pos?: number })?.__brsr_pos;
    expect(typeof posBefore).toBe('number');

    await replace('/b');
    await flush();

    // replace() keeps the logical position; the tag survives on the entry.
    const posAfter = (window.history.state as { __brsr_pos?: number })?.__brsr_pos;
    expect(posAfter).toBe(posBefore);
  });
});
