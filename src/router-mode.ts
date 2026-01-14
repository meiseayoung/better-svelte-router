import type { RouterMode, RouterModeConfig, IRouterModeAdapter } from './types';

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
   * @param path - Route path to navigate to
   * @param search - Optional query string
   */
  push(path: string, search: string = ''): void {
    const url = this.buildUrl(path, search);
    window.history.pushState({ timestamp: Date.now() }, '', url);
  }

  /**
   * Navigate to a new path using replaceState.
   * Replaces the current entry in browser history.
   * @param path - Route path to navigate to
   * @param search - Optional query string
   */
  replace(path: string, search: string = ''): void {
    const url = this.buildUrl(path, search);
    window.history.replaceState({ timestamp: Date.now() }, '', url);
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
   * @param path - Route path (e.g., '/users')
   * @param search - Optional query string (e.g., '?page=1')
   * @returns Full URL (e.g., 'https://example.com/#/users?page=1')
   */
  buildUrl(path: string, search: string = ''): string {
    return `${window.location.origin}${window.location.pathname}#${path}${search}`;
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
   * Navigate to a new path using replaceState.
   * Replaces the current entry in browser history.
   * @param path - Route path to navigate to
   * @param search - Optional query string
   */
  replace(path: string, search: string = ''): void {
    const url = this.buildUrl(path, search);
    window.history.replaceState({ timestamp: Date.now() }, '', url);
  }

  /**
   * Set up a listener for hashchange events (browser back/forward or hash changes).
   * @param callback - Function to call when navigation occurs
   * @returns Cleanup function to remove the listener
   */
  setupListener(callback: () => void): () => void {
    window.addEventListener('hashchange', callback);
    return () => window.removeEventListener('hashchange', callback);
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
 */
export function createRouterMode(config: RouterModeConfig): IRouterModeAdapter {
  const base = config.base ?? '';

  if (config.mode === 'hash') {
    currentAdapter = new HashModeAdapter(base);
  } else {
    currentAdapter = new HistoryModeAdapter(base);
  }

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
