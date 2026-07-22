import type { RouterMode, RouterModeConfig, IRouterModeAdapter } from './types';
import {
  pushHistoryUrl,
  replaceHistoryUrl,
  supportsReliableHashReplaceState,
} from './history-api';

// Re-export types for convenience
export type { RouterMode, RouterModeConfig, IRouterModeAdapter };

// ============================================================================
// History Mode Adapter
// ============================================================================

/**
 * History mode adapter implementation.
 * Uses HTML5 History API (pushState/replaceState) for clean URLs.
 * Listens to popstate events for browser navigation.
 * 
 * @example
 * const adapter = new HistoryModeAdapter('/app');
 * adapter.push('/users'); // URL becomes /app/users
 */
export class HistoryModeAdapter implements IRouterModeAdapter {
  private base: string;

  /**
   * Create a new HistoryModeAdapter.
   * @param base - Base path prefix for all routes (trailing slash removed)
   */
  constructor(base: string = '') {
    this.base = base.replace(/\/$/, '');
  }

  /**
   * Get the current router mode.
   * @returns 'history'
   */
  getMode(): RouterMode {
    return 'history';
  }

  /**
   * Get the current path from the URL pathname.
   * Removes the base path prefix if present.
   * @returns Current path (e.g., '/users/123')
   */
  getCurrentPath(): string {
    const pathname = window.location.pathname;
    const path = this.base ? pathname.replace(this.base, '') : pathname;
    return path || '/';
  }

  /**
   * Get the current query string from the URL.
   * @returns Query string including '?' (e.g., '?page=1')
   */
  getCurrentSearch(): string {
    return window.location.search;
  }

  /**
   * Build a full URL from path and optional search string.
   * @param path - Route path (e.g., '/users')
   * @param search - Optional query string (e.g., '?page=1')
   * @returns Full URL (e.g., 'https://example.com/app/users?page=1')
   */
  buildUrl(path: string, search: string = ''): string {
    return `${window.location.origin}${this.base}${path}${search}`;
  }

  /**
   * Navigate to a new path using pushState.
   * Adds a new entry to the browser history.
   * Falls back to `location.assign` if pushState throws (e.g. Safari quota).
   * @param path - Route path to navigate to
   * @param search - Optional query string
   */
  push(path: string, search: string = ''): void {
    pushHistoryUrl(this.buildUrl(path, search));
  }

  /**
   * Navigate to a new path using replaceState.
   * Replaces the current entry in browser history.
   *
   * Preserves the existing history.state (only refreshing `timestamp`) in the
   * same write — including the router's position tag — so RouterState's
   * follow-up tagging replaceState is a no-op. Falls back to `location.replace`
   * if replaceState throws (vue-router-style try/catch).
   * @param path - Route path to navigate to
   * @param search - Optional query string
   */
  replace(path: string, search: string = ''): void {
    replaceHistoryUrl(this.buildUrl(path, search));
  }

  /**
   * Set up a listener for popstate events (browser back/forward).
   * @param callback - Function to call when navigation occurs
   * @returns Cleanup function to remove the listener
   */
  setupListener(callback: () => void): () => void {
    window.addEventListener('popstate', callback);
    return () => window.removeEventListener('popstate', callback);
  }
}


// ============================================================================
// Hash Mode Adapter
// ============================================================================

/**
 * Hash mode adapter implementation.
 * Uses URL hash fragment for routing (e.g., /#/path).
 * Listens to hashchange events for browser navigation.
 * 
 * @example
 * const adapter = new HashModeAdapter();
 * adapter.push('/users'); // URL becomes /#/users
 */
export class HashModeAdapter implements IRouterModeAdapter {
  /**
   * Create a new HashModeAdapter.
   * @param _base - Base path prefix (not typically used in hash mode, reserved for future use)
   */
  constructor(_base: string = '') {
    // Base path is not used in hash mode as the path is in the hash fragment
  }

  /**
   * Get the current router mode.
   * @returns 'hash'
   */
  getMode(): RouterMode {
    return 'hash';
  }

  /**
   * Get the current path from the URL hash.
   * Extracts the path portion before any query string.
   * @returns Current path (e.g., '/users/123')
   */
  getCurrentPath(): string {
    const hash = window.location.hash.slice(1); // Remove '#'
    const [path] = hash.split('?');
    return path || '/';
  }

  /**
   * Get the current query string from the URL hash.
   * Extracts the query portion after '?' in the hash.
   * @returns Query string including '?' (e.g., '?page=1')
   */
  getCurrentSearch(): string {
    const hash = window.location.hash.slice(1);
    const queryIndex = hash.indexOf('?');
    return queryIndex >= 0 ? hash.slice(queryIndex) : '';
  }

  /**
   * Build a full URL with hash-based path.
   *
   * The base (everything before the fragment) is taken from the *actual*
   * current URL rather than reconstructed from `origin + pathname`. This
   * matters because:
   *   1. It preserves any real query string that lives before the hash
   *      (e.g. `index.html?token=abc#/route`), which the old reconstruction
   *      silently dropped.
   *   2. It produces a URL that differs from the current document only in its
   *      fragment. `replaceState` with such a URL is a pure hash change, so PC
   *      webviews (and `file://` shells) do not mistake it for a cross-document
   *      navigation and reload the page.
   *
   * @param path - Route path (e.g., '/users')
   * @param search - Optional query string (e.g., '?page=1')
   * @returns Full URL (e.g., 'https://example.com/#/users?page=1')
   */
  buildUrl(path: string, search: string = ''): string {
    const { href } = window.location;
    const hashIndex = href.indexOf('#');
    const base = hashIndex === -1 ? href : href.slice(0, hashIndex);
    return `${base}#${path}${search}`;
  }

  /**
   * Navigate to a new path by modifying location.hash.
   * Automatically adds a new entry to browser history.
   * @param path - Route path to navigate to
   * @param search - Optional query string
   */
  push(path: string, search: string = ''): void {
    window.location.hash = `${path}${search}`;
  }

  /**
   * Navigate to a new path, replacing the current history entry.
   *
   * Aligned with vue-router:
   *   1. Prefer a single `history.replaceState` that preserves `history.state`
   *      (including the position tag) so RouterState does not need a second
   *      tagging replaceState.
   *   2. try/catch → fall back to `location.replace` when replaceState throws.
   *
   * Old Android WebKits that fail vue-router 3's `supportsPushState` check skip
   * straight to `location.replace`. Modern Android uses `replaceState`.
   * RouterState then tags position with one same-URL replaceState so cancel-back
   * can still use history.go(delta).
   * @param path - Route path to navigate to
   * @param search - Optional query string
   */
  replace(path: string, search: string = ''): void {
    const url = this.buildUrl(path, search);
    if (!supportsReliableHashReplaceState()) {
      window.location.replace(url);
      return;
    }
    replaceHistoryUrl(url);
  }

  /**
   * Set up listeners for browser navigation in hash mode.
   *
   * Listens to both `hashchange` (primary) and `popstate`. Some Android
   * WebViews fire popstate without a reliable hashchange on back/forward, so
   * dual listening keeps browser-driven navigation in sync. RouterState
   * dedupes when both fire for the same URL change.
   * @param callback - Function to call when navigation occurs
   * @returns Cleanup function to remove the listeners
   */
  setupListener(callback: () => void): () => void {
    window.addEventListener('hashchange', callback);
    window.addEventListener('popstate', callback);
    return () => {
      window.removeEventListener('hashchange', callback);
      window.removeEventListener('popstate', callback);
    };
  }
}


// ============================================================================
// Memory Mode Adapter (hash bootstrap + in-memory runtime)
// ============================================================================

/**
 * Split path and search when callers pass `/path?query` as a single string
 * (common in this app, e.g. statistics → person/list).
 */
function splitPathSearch(path: string, search: string = ''): { path: string; search: string } {
  const qi = path.indexOf('?');
  if (qi < 0) {
    return { path: path || '/', search: search || '' };
  }
  return {
    path: path.slice(0, qi) || '/',
    search: search || path.slice(qi),
  };
}

interface MemoryEntry {
  path: string;
  search: string;
}

/**
 * Memory mode: seed once from `location.hash` (native deep links like
 * `#/auth?token=…`), then keep the route stack in memory and ignore
 * hashchange/popstate — so Android WebView restoring `#/auth` cannot
 * remount the auth page.
 *
 * Optional `syncHash` mirrors the current path into the hash via
 * `history.replaceState` for display only; inbound URL changes are ignored.
 */
export class MemoryModeAdapter implements IRouterModeAdapter {
  private syncHash: boolean;
  private stack: MemoryEntry[];
  private index: number;

  /**
   * @param _base - unused (hash fragment carries the path)
   * @param syncHash - mirror path into location.hash (default true)
   */
  constructor(_base: string = '', syncHash: boolean = true) {
    this.syncHash = syncHash;
    const hash = typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
    const seeded = splitPathSearch(hash || '/');
    this.stack = [{ path: seeded.path, search: seeded.search }];
    this.index = 0;
  }

  getMode(): RouterMode {
    return 'memory';
  }

  getCurrentPath(): string {
    const raw = this.stack[this.index]?.path || '/';
    // Defense in depth: never expose embedded query to the matcher.
    return raw.split('?')[0] || '/';
  }

  getCurrentSearch(): string {
    const entry = this.stack[this.index];
    if (!entry) return '';
    if (entry.search) return entry.search;
    const qi = entry.path.indexOf('?');
    return qi >= 0 ? entry.path.slice(qi) : '';
  }

  buildUrl(path: string, search: string = ''): string {
    const { href } = window.location;
    const hashIndex = href.indexOf('#');
    const base = hashIndex === -1 ? href : href.slice(0, hashIndex);
    return `${base}#${path}${search}`;
  }

  #writeHash(path: string, search: string): void {
    if (!this.syncHash) return;
    const url = this.buildUrl(path, search);
    try {
      const prev = (window.history.state as Record<string, unknown> | null) ?? {};
      window.history.replaceState({ ...prev, timestamp: Date.now() }, '', url);
    } catch {
      // Display sync is best-effort; memory stack remains source of truth.
    }
  }

  push(path: string, search: string = ''): void {
    const normalized = splitPathSearch(path, search);
    this.stack = this.stack.slice(0, this.index + 1);
    this.stack.push({ path: normalized.path, search: normalized.search });
    this.index = this.stack.length - 1;
    this.#writeHash(normalized.path, normalized.search);
  }

  replace(path: string, search: string = ''): void {
    const normalized = splitPathSearch(path, search);
    this.stack[this.index] = { path: normalized.path, search: normalized.search };
    this.#writeHash(normalized.path, normalized.search);
  }

  go(delta: number): boolean {
    const next = this.index + delta;
    if (next < 0 || next >= this.stack.length) return false;
    this.index = next;
    const entry = this.stack[this.index];
    this.#writeHash(entry.path, entry.search);
    return true;
  }

  /** Path at index+delta, or null if out of bounds. */
  peekPath(delta: number): string | null {
    const next = this.index + delta;
    if (next < 0 || next >= this.stack.length) return null;
    const raw = this.stack[next].path;
    return raw.split('?')[0] || '/';
  }

  /**
   * No browser listeners — WebView history/hash restoration must not drive routing.
   */
  setupListener(_callback: () => void): () => void {
    return () => {};
  }
}


// ============================================================================
// Factory Functions
// ============================================================================

/** Current router mode adapter instance (singleton) */
let currentAdapter: IRouterModeAdapter | null = null;

/**
 * Create and initialize a router mode adapter.
 * Sets the global adapter instance based on the provided configuration.
 *
 * @param config - Router mode configuration
 * @returns The created adapter instance
 *
 * @example
 * // Initialize with hash mode
 * createRouterMode({ mode: 'hash' });
 *
 * // Initialize with history mode and custom base
 * createRouterMode({ mode: 'history', base: '/app' });
 *
 * // Hybrid: seed from hash, then memory stack (WebView-safe)
 * createRouterMode({ mode: 'memory', syncHash: true });
 */
export function createRouterMode(config: RouterModeConfig): IRouterModeAdapter {
  const base = config.base ?? '';

  if (config.mode === 'hash') {
    currentAdapter = new HashModeAdapter(base);
  } else if (config.mode === 'memory') {
    currentAdapter = new MemoryModeAdapter(base, config.syncHash !== false);
  } else {
    currentAdapter = new HistoryModeAdapter(base);
  }

  // Drive the router state's initial guard pass now that the adapter is known.
  // Deferred to a microtask so that `beforeEach` guards registered in the same
  // synchronous turn (the common `createRouterMode(); beforeEach(...)` pattern)
  // are in place before guards run. `start()` is idempotent and reads the
  // adapter lazily, so the initial navigation always runs against this adapter.
  // The dynamic import avoids a hard circular dependency at module-init time.
  queueMicrotask(() => {
    void import('./router-state.svelte').then(({ routerState }) => routerState.start());
  });

  return currentAdapter;
}

/**
 * Get the current router mode adapter.
 * If no adapter has been created, defaults to history mode.
 * 
 * @returns The current adapter instance
 * 
 * @example
 * const adapter = getRouterMode();
 * const currentPath = adapter.getCurrentPath();
 */
export function getRouterMode(): IRouterModeAdapter {
  if (!currentAdapter) {
    // Default to history mode if not initialized
    currentAdapter = new HistoryModeAdapter('');
  }
  return currentAdapter;
}

/**
 * Reset the router mode adapter (primarily for testing).
 * @internal
 */
export function resetRouterMode(): void {
  currentAdapter = null;
}
