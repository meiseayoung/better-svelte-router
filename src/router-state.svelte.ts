import type { RouteMeta } from './types';
import { getRouterMode } from './router-mode';

/**
 * RouterState class manages the reactive URL state using Svelte 5 runes.
 * Uses $state for core state and $derived for computed values.
 * Integrates with router mode adapter for hash/history mode support.
 */
class RouterState {
  /** Core URL state managed with $state rune */
  #href = $state(window.location.href);

  /** Current route meta information */
  #meta = $state<RouteMeta>({});

  /** Cleanup function for the navigation event listener */
  #cleanupListener: (() => void) | null = null;

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
    // Listen for browser navigation events using the router mode adapter
    this.#setupListener();
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
    
    // Use adapter to set up the appropriate event listener
    this.#cleanupListener = getRouterMode().setupListener(() => {
      this.#href = window.location.href;
    });
  }

  /**
   * Reinitialize the listener when router mode changes.
   * Should be called after createRouterMode() is invoked.
   */
  reinitializeListener(): void {
    this.#setupListener();
    // Also update href to reflect current URL state
    this.#href = window.location.href;
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
