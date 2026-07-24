import type { RoutePath, QueryParams } from './types';
import { routerState } from './router-state.svelte';
import { runGuards, runAfterHooks } from './guards';
import { getRouterMode } from './router-mode';
import { buildHardReloadUrl } from './reload-url';
import { revalidateFailedModules } from './lazy-module-cache';

/**
 * Navigation module for the router.
 * Provides functions for programmatic navigation with guard integration.
 * Supports hash, history, and memory routing modes via the router mode adapter.
 */

/**
 * Builds a search string from query parameters.
 * Filters out undefined and null values, and properly encodes values.
 *
 * @param query - Query parameters object
 * @returns Search string with leading '?' if params exist, empty string otherwise
 *
 * @example
 * buildSearchString({ page: 1, search: 'test' }); // '?page=1&search=test'
 * buildSearchString({ a: undefined, b: null }); // ''
 * buildSearchString({}); // ''
 */
export function buildSearchString(query?: QueryParams): string {
  if (!query) return '';

  const entries = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);

  return entries.length > 0 ? `?${entries.join('&')}` : '';
}

/**
 * Split an optional query embedded in `to` (e.g. `/list?type=staff`) from the
 * pathname. Explicit `query` object wins when it produces a non-empty search.
 * Hash mode previously relied on getCurrentPath() stripping `?…`; memory mode
 * stores path literally, so this must happen before adapter.push/replace.
 */
function resolvePathAndSearch(to: RoutePath, query?: QueryParams): { path: string; search: string } {
  let path = to;
  let embeddedSearch = '';
  const qi = to.indexOf('?');
  if (qi >= 0) {
    path = to.slice(0, qi) || '/';
    embeddedSearch = to.slice(qi);
  }
  const search = buildSearchString(query) || embeddedSearch;
  return { path, search };
}

/**
 * Gets the current pathname using the router mode adapter.
 * Works correctly in both hash and history modes.
 * Used internally to get the 'from' path for navigation guards.
 */
function getCurrentPathname(): string {
  return getRouterMode().getCurrentPath();
}

/**
 * Navigates to a new route using pushState.
 * Runs beforeEach guards before navigation and afterEach hooks after.
 * Uses the router mode adapter for correct URL handling in hash/history modes.
 *
 * @param to - The target route path (may include `?query`)
 * @param query - Optional query parameters
 * @returns Promise resolving to true if navigation succeeded, false if cancelled
 *
 * @example
 * // Simple navigation
 * await push('/users');
 *
 * // Navigation with query params
 * await push('/users', { page: 1, search: 'john' });
 *
 * // Check if navigation was successful
 * const success = await push('/admin');
 * if (!success) {
 *   console.log('Navigation was cancelled by a guard');
 * }
 */
export async function push(to: RoutePath, query?: QueryParams): Promise<boolean> {
  const adapter = getRouterMode();
  const from = getCurrentPathname();
  const { path, search } = resolvePathAndSearch(to, query);

  // Run beforeEach guards
  const guardResult = await runGuards(from, path);

  // Guard cancelled navigation
  if (guardResult === false) {
    return false;
  }

  // Guard requested redirect
  if (typeof guardResult === 'string') {
    return push(guardResult as RoutePath, {});
  }

  // Mark programmatic navigation so the synchronous browser event that
  // mutating the URL may emit is recognized as an echo (not re-guarded).
  routerState.beginProgrammaticNavigation();

  // Use adapter to perform navigation (handles hash/history/memory mode)
  adapter.push(path, search);

  // Commit the navigation. This syncs the reactive href and records the
  // committed path/position so the browser event that some modes emit (e.g.
  // hashchange in hash mode) is recognized as an echo and does not re-run guards.
  routerState.commitNavigation(path);

  // Run afterEach hooks
  runAfterHooks(from, path);

  return true;
}

/**
 * Navigates to a new route using replaceState (no new history entry).
 * Runs beforeEach guards before navigation and afterEach hooks after.
 * Uses the router mode adapter for correct URL handling in hash/history modes.
 *
 * @param to - The target route path (may include `?query`)
 * @param query - Optional query parameters
 * @returns Promise resolving to true if navigation succeeded, false if cancelled
 *
 * @example
 * // Replace current history entry
 * await replace('/login');
 *
 * // Replace with query params
 * await replace('/search', { q: 'test' });
 */
export async function replace(to: RoutePath, query?: QueryParams): Promise<boolean> {
  const adapter = getRouterMode();
  const from = getCurrentPathname();
  const { path, search } = resolvePathAndSearch(to, query);

  // Run beforeEach guards
  const guardResult = await runGuards(from, path);

  // Guard cancelled navigation
  if (guardResult === false) {
    return false;
  }

  // Guard requested redirect
  if (typeof guardResult === 'string') {
    return replace(guardResult as RoutePath, {});
  }

  // Mark programmatic navigation so the synchronous browser event that
  // mutating the URL may emit is recognized as an echo (not re-guarded).
  routerState.beginProgrammaticNavigation();

  // Use adapter to perform navigation (handles hash/history/memory mode)
  adapter.replace(path, search);

  // Commit the navigation (replace keeps the current history position). This
  // syncs the reactive href and records the committed path so any browser event
  // emitted by the mode adapter is recognized as an echo and does not re-run guards.
  routerState.commitNavigation(path, true);

  // Run afterEach hooks
  runAfterHooks(from, path);

  return true;
}

/**
 * Navigates back in history.
 * In memory mode, pops the in-memory stack (WebView BF list is ignored).
 * Otherwise equivalent to the browser back button.
 *
 * @example
 * back();
 */
export async function back(): Promise<boolean> {
  const adapter = getRouterMode();
  if (adapter.getMode() === 'memory' && typeof adapter.go === 'function' && typeof adapter.peekPath === 'function') {
    const from = getCurrentPathname();
    const to = adapter.peekPath(-1);
    if (to == null) {
      return false;
    }
    const guardResult = await runGuards(from, to);
    if (guardResult === false) {
      return false;
    }
    if (typeof guardResult === 'string') {
      return replace(guardResult as RoutePath, {});
    }
    routerState.beginProgrammaticNavigation();
    if (!adapter.go(-1)) {
      routerState.commitNavigation(from, true);
      return false;
    }
    routerState.commitNavigation(to, true);
    runAfterHooks(from, to);
    return true;
  }
  window.history.back();
  return true;
}

/**
 * Navigates forward in history.
 * In memory mode, advances the in-memory stack.
 * Otherwise equivalent to the browser forward button.
 *
 * @example
 * forward();
 */
export async function forward(): Promise<boolean> {
  const adapter = getRouterMode();
  if (adapter.getMode() === 'memory' && typeof adapter.go === 'function' && typeof adapter.peekPath === 'function') {
    const from = getCurrentPathname();
    const to = adapter.peekPath(1);
    if (to == null) {
      return false;
    }
    const guardResult = await runGuards(from, to);
    if (guardResult === false) {
      return false;
    }
    if (typeof guardResult === 'string') {
      return replace(guardResult as RoutePath, {});
    }
    routerState.beginProgrammaticNavigation();
    if (!adapter.go(1)) {
      routerState.commitNavigation(from, true);
      return false;
    }
    routerState.commitNavigation(to, true);
    runAfterHooks(from, to);
    return true;
  }
  window.history.forward();
  return true;
}

/**
 * Hard-reloads the page for stale assets / lazy-chunk misses.
 *
 * Android WebView often ignores `location.reload()` and only navigates when
 * `location.replace(url)` receives a **different** URL. This always builds the
 * current logical route URL, appends a document-level cache buster, then
 * `location.replace`s — which both syncs memory-mode hash and forces a real load.
 *
 * Before navigating, best-effort revalidates any lazy chunk URLs that failed
 * earlier in this session (`fetch` with `cache: 'reload'`). That overwrites
 * WKWebView / HTTP-cache sticky failures for the same chunk URL after the
 * network recovers; document `_bsr_reload` alone does not change chunk URLs.
 *
 * The in-memory back-stack is not persisted by the library. To keep
 * `back()` / `forward()` after reload, snapshot `getEntries()` / `getIndex()`
 * yourself and pass them back as `initialEntries` / `initialIndex` on boot
 * (React Router-style).
 *
 * Does not run navigation guards — the page is about to unload.
 * Signature stays sync; revalidation runs then `replace` (or after timeout).
 *
 * @example
 * // Lazy import failed after a deploy / offline
 * reload();
 */
export function reload(): void {
  const adapter = getRouterMode();
  const path = adapter.getCurrentPath();
  const search = adapter.getCurrentSearch();
  const logicalUrl = adapter.buildUrl(path, search);
  const target = buildHardReloadUrl(logicalUrl);
  void revalidateFailedModules().finally(() => {
    window.location.replace(target);
  });
}
