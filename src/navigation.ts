import type { RoutePath, QueryParams } from './types';
import { routerState } from './router-state.svelte';
import { runGuards, runAfterHooks } from './guards';
import { getRouterMode } from './router-mode';

/**
 * Navigation module for the router.
 * Provides functions for programmatic navigation with guard integration.
 * Supports both hash and history routing modes via the router mode adapter.
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
 * @param to - The target route path
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
  
  // Run beforeEach guards
  const guardResult = await runGuards(from, to);
  
  // Guard cancelled navigation
  if (guardResult === false) {
    return false;
  }
  
  // Guard requested redirect
  if (typeof guardResult === 'string') {
    return push(guardResult as RoutePath, {});
  }
  
  // Build the search string
  const search = buildSearchString(query);
  
  // Use adapter to perform navigation (handles hash/history mode)
  adapter.push(to, search);
  
  // Update router state
  routerState.href = window.location.href;
  
  // Run afterEach hooks
  runAfterHooks(from, to);
  
  return true;
}

/**
 * Navigates to a new route using replaceState (no new history entry).
 * Runs beforeEach guards before navigation and afterEach hooks after.
 * Uses the router mode adapter for correct URL handling in hash/history modes.
 * 
 * @param to - The target route path
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
  
  // Run beforeEach guards
  const guardResult = await runGuards(from, to);
  
  // Guard cancelled navigation
  if (guardResult === false) {
    return false;
  }
  
  // Guard requested redirect
  if (typeof guardResult === 'string') {
    return replace(guardResult as RoutePath, {});
  }
  
  // Build the search string
  const search = buildSearchString(query);
  
  // Use adapter to perform navigation (handles hash/history mode)
  adapter.replace(to, search);
  
  // Update router state
  routerState.href = window.location.href;
  
  // Run afterEach hooks
  runAfterHooks(from, to);
  
  return true;
}

/**
 * Navigates back in browser history.
 * Equivalent to clicking the browser's back button.
 * 
 * @example
 * back();
 */
export function back(): void {
  window.history.back();
}

/**
 * Navigates forward in browser history.
 * Equivalent to clicking the browser's forward button.
 * 
 * @example
 * forward();
 */
export function forward(): void {
  window.history.forward();
}
