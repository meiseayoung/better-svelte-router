/**
 * Router Module - Svelte 5 Router Implementation
 * 
 * A type-safe, reactive router for Svelte 5 applications using runes API.
 * 
 * @module better-svelte-router
 * 
 * @example
 * // Basic usage in App.svelte
 * import { RouterView, createRouterMode } from 'better-svelte-router';
 * import { routes } from './routes';
 * 
 * // Initialize router mode
 * createRouterMode({ mode: 'history' });
 * 
 * <RouterView {routes} />
 * 
 * @example
 * // Programmatic navigation
 * import { push, replace, back, forward } from 'better-svelte-router';
 * 
 * // Navigate to a route
 * await push('/users');
 * 
 * // Navigate with query params
 * await push('/search', { q: 'test', page: 1 });
 * 
 * // Replace current history entry
 * await replace('/login');
 * 
 * @example
 * // Navigation guards
 * import { beforeEach, afterEach } from 'better-svelte-router';
 * 
 * // Auth guard
 * const removeGuard = beforeEach((from, to) => {
 *   if (to.startsWith('/admin') && !isAuthenticated) {
 *     return '/login'; // redirect
 *   }
 *   return true; // allow
 * });
 * 
 * // Analytics hook
 * afterEach((from, to) => {
 *   analytics.trackPageView(to);
 * });
 * 
 * @example
 * // Access reactive router state
 * import { routerState } from 'better-svelte-router';
 * 
 * $effect(() => {
 *   console.log('Current path:', routerState.pathname);
 *   console.log('Query params:', routerState.query);
 *   console.log('Route meta:', routerState.meta);
 * });
 */

// ============================================================================
// Components
// ============================================================================

/**
 * RouterView component for rendering matched routes.
 * Supports lazy-loading, nested routes, and custom error/loading states.
 */
export { default as RouterView } from './router-view.svelte';

// ============================================================================
// State
// ============================================================================

/**
 * Reactive router state singleton.
 * Provides access to current URL components and route metadata.
 * 
 * Properties:
 * - `href`: Full URL string
 * - `pathname`: Current pathname
 * - `search`: Query string (including '?')
 * - `hash`: URL hash (including '#')
 * - `query`: Parsed query parameters as object
 * - `meta`: Current route's metadata
 */
export { routerState } from './router-state.svelte';

// ============================================================================
// Navigation
// ============================================================================

/**
 * Navigation functions for programmatic routing.
 * 
 * - `push`: Navigate to a new route (adds history entry)
 * - `replace`: Navigate without adding history entry
 * - `back`: Go back in history
 * - `forward`: Go forward in history
 * - `buildSearchString`: Utility to build query strings
 */
export { push, replace, back, forward, buildSearchString } from './navigation';

// ============================================================================
// Guards
// ============================================================================

/**
 * Navigation guard functions for controlling route access.
 * 
 * - `beforeEach`: Register a guard that runs before navigation
 * - `afterEach`: Register a hook that runs after navigation
 * - `clearGuards`: Clear all registered guards (useful for testing)
 */
export { beforeEach, afterEach, clearGuards } from './guards';

// ============================================================================
// Matcher
// ============================================================================

/**
 * Route matching utilities.
 * 
 * - `matchRoute`: Find a single matching route
 * - `findMatchingRoutes`: Find all matching routes in hierarchy
 * - `normalizePath`: Normalize a path string
 * - `extractParams`: Extract path parameters from a URL
 * - `clearMatcherCache`: Clear the regexp cache
 */
export { 
  matchRoute, 
  findMatchingRoutes, 
  normalizePath, 
  extractParams,
  clearMatcherCache 
} from './matcher';

// ============================================================================
// Router Mode
// ============================================================================

/**
 * Router mode functions for configuring hash or history routing.
 * 
 * - `createRouterMode`: Initialize the router with a specific mode
 * - `getRouterMode`: Get the current router mode adapter
 * - `resetRouterMode`: Reset the router mode (for testing)
 * - `HistoryModeAdapter`: History mode adapter class
 * - `HashModeAdapter`: Hash mode adapter class
 * 
 * @example
 * // Initialize with hash mode
 * createRouterMode({ mode: 'hash' });
 * 
 * // Initialize with history mode
 * createRouterMode({ mode: 'history', base: '/app' });
 * 
 * // Get current adapter
 * const adapter = getRouterMode();
 * const currentPath = adapter.getCurrentPath();
 */
export { 
  createRouterMode, 
  getRouterMode, 
  resetRouterMode,
  HistoryModeAdapter,
  HashModeAdapter
} from './router-mode';

// ============================================================================
// Types
// ============================================================================

/**
 * Type exports for TypeScript users.
 */
export type {
  // Route configuration types
  IRoute,
  IRouterViewProps,
  RouteMeta,
  
  // Component types
  LazyComponent,
  
  // Navigation types
  QueryParams,
  NavigationGuard,
  NavigationGuardResult,
  AfterEachHook,
  
  // Matching types
  MatchedRoute,
  RouteLocation,
  
  // Path types
  RoutePath,
  BuildFullPaths,
  
  // Router mode types
  RouterMode,
  RouterModeConfig,
  IRouterModeAdapter,
} from './types';
