import type { Snippet, Component } from 'svelte';

// ============================================================================
// Component Types
// ============================================================================

/**
 * Lazy-loaded component type for code splitting.
 * Returns a promise that resolves to a module with a default export.
 * @example
 * const LazyHome: LazyComponent = () => import('./Home.svelte');
 */
export type LazyComponent = () => Promise<{ default: Component | Snippet }>;

// ============================================================================
// Route Meta Types
// ============================================================================

/**
 * Keep-alive cache key strategy.
 * - `path`: one cached instance per route pattern (e.g. `/users/:id`)
 * - `full`: one cached instance per resolved pathname (e.g. `/users/1`)
 */
export type KeepAliveKeyMode = 'path' | 'full';

/**
 * Options for mount-based route keep-alive.
 * Inactive routes stay mounted; their DOM is parked outside the document
 * so local component state does not need to be lifted out.
 */
export interface KeepAliveOptions {
  /**
   * Cache key strategy. Defaults to `'path'`.
   * Prefer `'path'` for tab-style sibling pages; use `'full'` when each
   * resolved URL should keep its own instance (e.g. per-id drafts).
   */
  key?: KeepAliveKeyMode;
  /**
   * Max cached instances for this route within a RouterView outlet.
   * Oldest inactive entries are evicted (LRU). Defaults to `10`.
   */
  max?: number;
  /**
   * When true, nested `RouterView` children inherit keep-alive (same key/max)
   * unless a child sets `meta.keepAlive` explicitly (`false` opts out).
   */
  deep?: boolean;
}

/**
 * Route meta information for arbitrary metadata.
 * Can be used for page titles, authentication requirements, permissions, etc.
 * @example
 * const meta: RouteMeta = {
 *   title: 'Dashboard',
 *   requiresAuth: true,
 *   permissions: ['admin']
 * };
 */
export interface RouteMeta {
  /** Page title for document.title or breadcrumbs */
  title?: string;
  /** Whether the route requires authentication */
  requiresAuth?: boolean;
  /**
   * Keep this route's component mounted after leaving (sibling outlet cache).
   * - `true` / options: enable keep-alive
   * - `false`: explicit opt-out (also stops `deep` inheritance)
   * - omit: inherit from an ancestor with `keepAlive.deep: true`, else off
   *
   * Inactive instances are parked off-document (not destroyed).
   */
  keepAlive?: boolean | KeepAliveOptions;
  /** Allow arbitrary additional metadata */
  [key: string]: unknown;
}

// ============================================================================
// Route Configuration Types
// ============================================================================

/**
 * Route configuration interface.
 * Defines the structure of a route including path, component, children, and metadata.
 * @example
 * const route: IRoute = {
 *   path: '/users/:id',
 *   component: UserDetail,
 *   meta: { title: 'User Detail' }
 * };
 */
export interface IRoute {
  /** Optional route name for programmatic navigation */
  readonly name?: string;
  /** Route path pattern, supports dynamic segments like :id */
  readonly path: string;
  /** Component to render when route matches */
  readonly component?: Snippet | Component | LazyComponent;
  /** Nested child routes */
  readonly children?: readonly IRoute[];
  /** Redirect target path */
  readonly redirect?: string;
  /** Route metadata */
  readonly meta?: RouteMeta;
}

/**
 * RouterView component props interface.
 */
export interface IRouterViewProps {
  /** Array of route configurations */
  readonly routes: readonly IRoute[];
  /** Path prefix for nested routes */
  readonly prefix?: string;
}

// ============================================================================
// Query Parameter Types
// ============================================================================

/**
 * Query parameters type for navigation.
 * Supports string, number, boolean values, or undefined/null to omit.
 * @example
 * const query: QueryParams = {
 *   page: 1,
 *   search: 'test',
 *   active: true,
 *   filter: undefined // will be omitted
 * };
 */
export type QueryParams = Record<string, string | number | boolean | undefined | null>;

// ============================================================================
// Navigation Guard Types
// ============================================================================

/**
 * Navigation guard result type.
 * - `true` or `void`: Allow navigation to proceed
 * - `false`: Cancel navigation
 * - `string`: Redirect to the specified path
 */
export type NavigationGuardResult = boolean | string | void;

/**
 * Navigation guard function type.
 * Called before navigation to control route access.
 * @param from - The path being navigated from
 * @param to - The path being navigated to
 * @returns Result indicating whether to proceed, cancel, or redirect
 * @example
 * const authGuard: NavigationGuard = (from, to) => {
 *   if (!isAuthenticated && to.startsWith('/admin')) {
 *     return '/login';
 *   }
 *   return true;
 * };
 */
export type NavigationGuard = (
  from: string,
  to: string
) => NavigationGuardResult | Promise<NavigationGuardResult>;

/**
 * After navigation hook function type.
 * Called after navigation completes successfully.
 * @param from - The path navigated from
 * @param to - The path navigated to
 */
export type AfterEachHook = (from: string, to: string) => void;

// ============================================================================
// Route Matching Types
// ============================================================================

/**
 * Matched route information returned by the route matcher.
 * Contains the matched route configuration and extracted parameters.
 */
export interface MatchedRoute {
  /** The matched route configuration */
  route: IRoute;
  /** The full matched path */
  path: string;
  /** Extracted path parameters (e.g., { id: '123' } for /users/:id) */
  params: Record<string, string>;
  /** Route meta information (defaults to empty object if not defined) */
  meta: RouteMeta;
}

/**
 * Route location information representing the current navigation state.
 * Provides parsed URL components and route metadata.
 */
export interface RouteLocation {
  /** Current pathname (e.g., '/users/123') */
  pathname: string;
  /** Query string including '?' (e.g., '?page=1') */
  search: string;
  /** Hash including '#' (e.g., '#section') */
  hash: string;
  /** Parsed query parameters as key-value pairs */
  query: Record<string, string>;
  /** Current route's meta information */
  meta: RouteMeta;
}

// ============================================================================
// Type-Safe Route Path Types
// ============================================================================

/**
 * Type utility to build full paths from route configuration.
 * Recursively traverses the route tree to generate a union type of all valid paths.
 * 
 * @template T - The routes configuration array type
 * @template BasePath - The accumulated base path (used internally for recursion)
 * 
 * @example
 * const routes = [
 *   { path: '/', children: [
 *     { path: 'users', children: [
 *       { path: ':id' }
 *     ]}
 *   ]}
 * ] as const;
 * 
 * type Paths = BuildFullPaths<typeof routes>;
 * // Results in: '/' | '/users' | '/users/:id'
 */
export type BuildFullPaths<
  T,
  BasePath extends string = '',
> = T extends readonly any[]
  ? T[number] extends infer Route
    ? Route extends { path: infer P; children: infer C }
      ? P extends string
        ? BasePath extends ''
          ? P extends '/'
            ?
                | '/'
                | (C extends readonly any[] ? BuildFullPaths<C, '/'> : never)
            : P | (C extends readonly any[] ? BuildFullPaths<C, P> : never)
          : BasePath extends '/'
            ?
                | `/${P}`
                | (C extends readonly any[]
                    ? BuildFullPaths<C, `/${P}`>
                    : never)
            :
                | `${BasePath}/${P}`
                | (C extends readonly any[]
                    ? BuildFullPaths<C, `${BasePath}/${P}`>
                    : never)
        : never
      : Route extends { path: infer P }
        ? P extends string
          ? BasePath extends ''
            ? P
            : BasePath extends '/'
              ? `/${P}`
              : `${BasePath}/${P}`
          : never
        : never
    : never
  : never;

/**
 * Type-safe route path type.
 * Users can extend this type with their own route configuration using BuildFullPaths.
 * 
 * @example
 * import type { BuildFullPaths } from 'better-svelte-router';
 * 
 * const routes = [
 *   { path: '/', children: [
 *     { path: 'users', children: [
 *       { path: ':id' }
 *     ]}
 *   ]}
 * ] as const;
 * 
 * type AppRoutePath = BuildFullPaths<typeof routes>;
 * // Results in: '/' | '/users' | '/users/:id'
 */
export type RoutePath = string;

// ============================================================================
// Router Mode Types
// ============================================================================

/**
 * Router mode type.
 * - 'hash': Uses URL hash fragment for routing (e.g., /#/path)
 * - 'history': Uses HTML5 History API for clean URLs (e.g., /path)
 * - 'memory': In-memory stack; seeds once from location.hash, then ignores
 *   hashchange/popstate (hybrid hash bootstrap + memory runtime)
 *
 * @example
 * const mode: RouterMode = 'hash';
 */
export type RouterMode = 'hash' | 'history' | 'memory';

/**
 * Router mode configuration interface.
 * Used to initialize the router with the desired mode and base path.
 *
 * @example
 * const config: RouterModeConfig = {
 *   mode: 'history',
 *   base: '/app'
 * };
 */
export interface RouterModeConfig {
  /** Router mode: 'hash', 'history', or 'memory' */
  mode: RouterMode;
  /** Base path prefix for all routes */
  base?: string;
  /**
   * memory mode only: mirror the current path into `location.hash` via
   * `history.replaceState` for display/debugging. Inbound hash/popstate
   * changes are still ignored. Defaults to true.
   */
  syncHash?: boolean;
  /**
   * memory mode only: initial in-memory history stack (React Router-style).
   * Entries may include a query string (`'/list?type=staff'`). When omitted,
   * the stack is seeded once from `location.hash`.
   */
  initialEntries?: string[];
  /**
   * memory mode only: index into `initialEntries` to start at.
   * Defaults to the last entry.
   */
  initialIndex?: number;
}

/**
 * Router mode adapter interface.
 * Provides a unified API for hash, history, and memory routing modes.
 * Implementations handle the differences between URL-based and in-memory routing.
 *
 * @example
 * const adapter: IRouterModeAdapter = getRouterMode();
 * const currentPath = adapter.getCurrentPath();
 * adapter.push('/users', '?page=1');
 */
export interface IRouterModeAdapter {
  /** Get the current path from the URL */
  getCurrentPath(): string;
  /** Get the current query string from the URL */
  getCurrentSearch(): string;
  /** Build a full URL from path and optional search string */
  buildUrl(path: string, search?: string): string;
  /** Navigate to a new path using pushState */
  push(path: string, search?: string): void;
  /** Navigate to a new path using replaceState */
  replace(path: string, search?: string): void;
  /** Set up a listener for navigation events, returns cleanup function */
  setupListener(callback: () => void): () => void;
  /** Get the current router mode */
  getMode(): RouterMode;
  /**
   * memory mode: move within the in-memory stack by delta.
   * Returns false when the move is out of bounds.
   */
  go?(delta: number): boolean;
  /** memory mode: path at index+delta, or null if out of bounds. */
  peekPath?(delta: number): string | null;
  /**
   * memory mode: snapshot of the in-memory stack as path strings
   * (query embedded when present), for app-managed persistence.
   */
  getEntries?(): string[];
  /** memory mode: current index within `getEntries()`. */
  getIndex?(): number;
}
