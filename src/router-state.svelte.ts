import type { RouteMeta } from './types';
import { getRouterMode } from './router-mode';
import { runGuards, runAfterHooks } from './guards';

/** Maximum number of chained guard redirects before bailing out to avoid infinite loops. */
const MAX_REDIRECTS = 10;

/** Key used to tag a logical history position onto `history.state`. */
const POSITION_KEY = '__brsr_pos';

/**
 * Reads the logical position tagged onto the current history entry.
 * Returns `null` when the entry is untagged (e.g. created externally, such as
 * a native shell setting `location.hash` directly).
 */
function readHistoryPosition(): number | null {
  const state = window.history.state as Record<string, unknown> | null;
  const pos = state?.[POSITION_KEY];
  return typeof pos === 'number' ? pos : null;
}

/**
 * Tags the current history entry with a logical position, preserving any other
 * fields already present on `history.state`. Uses `replaceState`, so it does
 * not create a new entry or emit a navigation event.
 */
function writeHistoryPosition(pos: number): void {
  const prev = (window.history.state as Record<string, unknown> | null) ?? {};
  window.history.replaceState({ ...prev, [POSITION_KEY]: pos }, '', window.location.href);
}

/**
 * RouterState class manages the reactive URL state using Svelte 5 runes.
 * Uses $state for core state and $derived for computed values.
 * Integrates with router mode adapter for hash/history mode support.
 *
 * Navigation guards (`beforeEach`) are executed globally here, not only inside
 * programmatic `push()`/`replace()`. This class runs guards for:
 *   - the initial load / refresh (once, after guards have been registered), and
 *   - browser-driven navigation (popstate / hashchange, i.e. back/forward and
 *     external hash changes, including query-only changes).
 * This closes the gap where deep-links, refreshes and back/forward navigation
 * would bypass authentication guards.
 */
class RouterState {
  /** Core URL state managed with $state rune */
  #href = $state(window.location.href);

  /** Current route meta information */
  #meta = $state<RouteMeta>({});

  /** Cleanup function for the navigation event listener */
  #cleanupListener: (() => void) | null = null;

  /**
   * The full URL the router has committed to. Used to recognize echoes of
   * programmatic navigation (which already ran guards) and, as a fallback, to
   * restore the URL when a cancelled navigation cannot be reverted via history.
   */
  #committedHref: string = window.location.href;

  /**
   * The path the router has committed to. Used as the `from` value for
   * browser-driven navigation.
   */
  #committedPath: string = getRouterMode().getCurrentPath();

  /** Logical position of the committed history entry (see POSITION_KEY). */
  #position = 0;

  /** Whether the initial guard run has already happened. */
  #started = false;

  /**
   * Set while programmatic navigation (push/replace) is mutating the URL, so
   * the synchronous browser event that `location.hash = ...` may emit is
   * recognized as an echo and does not re-run guards.
   */
  #programmatic = false;

  /**
   * Set while reverting a cancelled navigation via `history.go()`, so the
   * resulting browser event is ignored instead of being treated as new.
   */
  #reverting = false;

  /**
   * Monotonic token used to discard the result of a superseded async guard run
   * when navigation events fire in quick succession.
   */
  #navToken = 0;

  /**
   * Derived pathname using router mode adapter.
   * In history mode: extracts from pathname
   * In hash mode: extracts from hash fragment
   */
  pathname = $derived.by(() => {
    // Trigger reactivity on href change
    void this.#href;
    return getRouterMode().getCurrentPath();
  });

  /**
   * Derived search string using router mode adapter.
   * In history mode: extracts from URL search
   * In hash mode: extracts from hash fragment query string
   */
  search = $derived.by(() => {
    // Trigger reactivity on href change
    void this.#href;
    return getRouterMode().getCurrentSearch();
  });

  /** Derived hash from current href */
  hash = $derived(new URL(this.#href).hash);

  /** Derived query parameters as key-value object */
  query = $derived.by(() => {
    const params = new URLSearchParams(this.search);
    return Object.fromEntries(params.entries()) as Record<string, string>;
  });

  constructor() {
    // Listen for browser navigation events using the router mode adapter.
    this.#setupListener();

    // Defer the initial guard run until the current synchronous setup has
    // finished. Consumers typically call `createRouterMode()` and register
    // `beforeEach` guards synchronously right after importing the router, so a
    // microtask guarantees both are in place before the initial guards run.
    // It also lets us rebind the listener to the adapter selected by
    // `createRouterMode()` (the singleton is constructed before that call).
    queueMicrotask(() => this.start());
  }

  /**
   * Sets up the navigation event listener using the router mode adapter.
   * In history mode: listens to popstate event
   * In hash mode: listens to hashchange event
   */
  #setupListener(): void {
    // Clean up any existing listener
    if (this.#cleanupListener) {
      this.#cleanupListener();
    }

    // Use adapter to set up the appropriate event listener. Browser-driven
    // navigation must run guards, unlike programmatic navigation which already
    // runs them in push()/replace().
    this.#cleanupListener = getRouterMode().setupListener(() => {
      this.#onBrowserNavigation();
    });
  }

  /**
   * Runs the initial navigation guards for the current URL and (re)binds the
   * listener to the currently configured router mode. Idempotent: only the
   * first call performs the initial guard run.
   *
   * Called automatically after construction, but also exposed so applications
   * can trigger it explicitly (e.g. after asynchronously registering guards).
   */
  start(): void {
    // Rebind the listener to the adapter chosen via createRouterMode(), since
    // the singleton is constructed with the default adapter before that runs.
    this.#setupListener();
    this.#syncCommitted();

    // Adopt an existing tagged position (survives refresh) or seed a new one so
    // the initial entry participates in history-position accounting.
    this.#position = readHistoryPosition() ?? 0;
    writeHistoryPosition(this.#position);

    if (this.#started) {
      return;
    }
    this.#started = true;

    // Run guards for the initial location so first-load / refresh / deep-links
    // are subject to the same guards as programmatic navigation.
    const current = getRouterMode().getCurrentPath();
    void this.#confirmNavigation(current, current, this.#position);
  }

  /**
   * Handles browser-driven navigation (popstate / hashchange).
   * The URL has already changed by the time this fires, so guards run against
   * the new location and the URL is corrected if a guard cancels or redirects.
   */
  #onBrowserNavigation(): void {
    // Event caused by our own history.go() revert: swallow it and resync.
    if (this.#reverting) {
      this.#reverting = false;
      this.#syncCommitted();
      const pos = readHistoryPosition();
      if (pos !== null) this.#position = pos;
      return;
    }

    // Echo of programmatic navigation (synchronous or asynchronous): guards
    // already ran in push()/replace(), so just keep reactive state in sync.
    if (this.#programmatic || window.location.href === this.#committedHref) {
      this.#href = window.location.href;
      return;
    }

    const to = getRouterMode().getCurrentPath();
    const from = this.#committedPath;
    const targetPos = readHistoryPosition();
    void this.#confirmNavigation(to, from, targetPos);
  }

  /**
   * Runs beforeEach guards for a navigation and applies the result:
   *   - `false`  -> cancel: restore the previous location (history.go when the
   *                 delta is known, otherwise replaceState)
   *   - `string` -> redirect: replace the URL with the target and re-check
   *   - allow    -> commit: sync reactive state and run afterEach hooks
   *
   * @param to - The path being navigated to
   * @param from - The path being navigated from
   * @param targetPos - Logical position of the target entry (null if untagged)
   * @param redirectCount - Internal guard against redirect loops
   */
  async #confirmNavigation(
    to: string,
    from: string,
    targetPos: number | null,
    redirectCount = 0
  ): Promise<void> {
    const token = ++this.#navToken;
    const result = await runGuards(from, to);

    // A newer navigation started while this one was awaiting guards.
    if (token !== this.#navToken) {
      return;
    }

    const adapter = getRouterMode();

    // Guard cancelled navigation.
    if (result === false) {
      this.#revert(targetPos);
      return;
    }

    // Position this entry should logically occupy once committed. An untagged
    // (external) entry is treated as a new forward entry.
    const effectivePos = targetPos ?? this.#position + 1;

    // Guard requested a redirect to a different path.
    if (typeof result === 'string' && result !== to) {
      if (redirectCount >= MAX_REDIRECTS) {
        console.error(
          `[Router] Too many nested guard redirects (last target: "${result}"). Aborting to prevent an infinite loop.`
        );
        return;
      }
      adapter.replace(result);
      // adapter.replace() overwrites history.state, so re-tag the entry.
      this.#position = effectivePos;
      writeHistoryPosition(this.#position);
      // Recognize the URL we just navigated to as our own, so the hashchange
      // that hash-mode replace (location.replace) emits is treated as an echo
      // and not re-guarded — regardless of how the async guard below resolves.
      this.#committedHref = window.location.href;
      this.#href = window.location.href;
      await this.#confirmNavigation(result, from, effectivePos, redirectCount + 1);
      return;
    }

    // Navigation allowed: commit the new location.
    this.#position = effectivePos;
    writeHistoryPosition(this.#position);
    this.#committedPath = to;
    this.#committedHref = window.location.href;
    this.#href = window.location.href;
    runAfterHooks(from, to);
  }

  /**
   * Reverts a cancelled browser-driven navigation back to the committed entry.
   * Prefers `history.go()` (restores the exact entry and preserves the
   * forward/back stack) when the movement delta is known; otherwise rewrites
   * the current entry back to the committed URL.
   *
   * @param targetPos - Logical position the browser moved to (null if untagged)
   */
  #revert(targetPos: number | null): void {
    if (targetPos !== null) {
      const delta = targetPos - this.#position;
      if (delta !== 0) {
        // Undo the browser movement, e.g. moving back 1 requires going forward 1.
        this.#reverting = true;
        window.history.go(-delta);
        return;
      }
    }

    // Fallback: the delta is unknown (untagged/external entry) or zero.
    // Rewrite the current entry back to the committed location.
    if (window.location.href !== this.#committedHref) {
      const prev = (window.history.state as Record<string, unknown> | null) ?? {};
      window.history.replaceState(
        { ...prev, [POSITION_KEY]: this.#position },
        '',
        this.#committedHref
      );
    }
    this.#syncCommitted();
  }

  /** Syncs committed href/path and the reactive href to the current URL. */
  #syncCommitted(): void {
    this.#committedHref = window.location.href;
    this.#committedPath = getRouterMode().getCurrentPath();
    this.#href = window.location.href;
  }

  /**
   * Reinitialize the listener when router mode changes.
   * Should be called after createRouterMode() is invoked.
   */
  reinitializeListener(): void {
    this.#setupListener();
    this.#syncCommitted();
    this.#position = readHistoryPosition() ?? 0;
    writeHistoryPosition(this.#position);
  }

  /**
   * Marks the start of a programmatic navigation. Called by push()/replace()
   * immediately before mutating the URL so the synchronous browser event that
   * `location.hash = ...` may emit is recognized as an echo.
   */
  beginProgrammaticNavigation(): void {
    this.#programmatic = true;
  }

  /**
   * Records that programmatic navigation (push/replace) has committed to a path.
   * Guards were already run by the navigation call, so this updates the
   * committed location/position and syncs the reactive href.
   *
   * @param path - The path that was navigated to
   * @param isReplace - True for replace() (keeps position), false for push()
   */
  commitNavigation(path: string, isReplace = false): void {
    // Invalidate any in-flight browser-event guard check: a programmatic
    // navigation that lands after a popstate/hashchange guard started awaiting
    // must win, otherwise the stale result would clobber this newer commit.
    this.#navToken++;

    if (!isReplace) {
      this.#position += 1;
    }
    // push()/replace() overwrite history.state, so re-tag the entry.
    writeHistoryPosition(this.#position);

    this.#committedPath = path;
    this.#committedHref = window.location.href;
    this.#href = window.location.href;
    this.#programmatic = false;
  }

  /** Get current href value */
  get href(): string {
    return this.#href;
  }

  /** Set href value and trigger derived state updates */
  set href(value: string) {
    this.#href = value;
  }

  /** Get current route meta information */
  get meta(): RouteMeta {
    return this.#meta;
  }

  /** Set route meta information */
  set meta(value: RouteMeta) {
    this.#meta = value;
  }
}

/** Singleton instance of RouterState for global access */
export const routerState = new RouterState();
