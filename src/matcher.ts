import { pathToRegexp } from 'path-to-regexp';
import type { IRoute, MatchedRoute, RouteMeta } from './types';

// ============================================================================
// Regexp Cache
// ============================================================================

/**
 * Cache for compiled regular expressions to avoid recompilation.
 * Key: normalized path pattern, Value: compiled RegExp
 */
const regexpCache = new Map<string, RegExp>();

/**
 * Cache for path parameter keys extracted from patterns.
 * Key: normalized path pattern, Value: array of parameter names
 */
const keysCache = new Map<string, string[]>();

/**
 * Gets or creates a cached RegExp for the given path pattern.
 * @param path - The path pattern to compile
 * @returns The compiled RegExp
 */
function getRegexp(path: string): RegExp {
  if (!regexpCache.has(path)) {
    const { regexp, keys } = pathToRegexp(path);
    regexpCache.set(path, regexp);
    keysCache.set(path, keys.map(k => k.name));
  }
  return regexpCache.get(path)!;
}

/**
 * Gets cached parameter keys for the given path pattern.
 * @param path - The path pattern
 * @returns Array of parameter names
 */
function getKeys(path: string): string[] {
  if (!keysCache.has(path)) {
    getRegexp(path); // This will populate the cache
  }
  return keysCache.get(path) || [];
}

// ============================================================================
// Path Normalization
// ============================================================================

/**
 * Normalizes a path by removing duplicate slashes and ensuring proper format.
 * @param path - The path to normalize
 * @returns The normalized path
 * @example
 * normalizePath('//users//123') // '/users/123'
 * normalizePath('users/123') // '/users/123'
 * normalizePath('/') // '/'
 */
export function normalizePath(path: string): string {
  // Handle empty or root path
  if (!path || path === '/') {
    return '/';
  }

  // Replace multiple slashes with single slash
  let normalized = path.replace(/\/+/g, '/');

  // Ensure path starts with /
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }

  // Remove trailing slash (except for root)
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

// ============================================================================
// Parameter Extraction
// ============================================================================

/**
 * Extracts path parameters from a pathname using the given pattern.
 * @param pattern - The route pattern with parameter placeholders
 * @param pathname - The actual pathname to extract parameters from
 * @returns Object containing extracted parameters
 * @example
 * extractParams('/users/:id', '/users/123') // { id: '123' }
 * extractParams('/posts/:postId/comments/:commentId', '/posts/1/comments/2') // { postId: '1', commentId: '2' }
 */
export function extractParams(
  pattern: string,
  pathname: string
): Record<string, string> {
  const regexp = getRegexp(pattern);
  const keys = getKeys(pattern);
  const match = regexp.exec(pathname);

  if (!match) {
    return {};
  }

  const params: Record<string, string> = {};

  // match[0] is the full match, parameters start at index 1
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const value = match[i + 1];
    if (value !== undefined) {
      params[key] = decodeURIComponent(value);
    }
  }

  return params;
}

// ============================================================================
// Route Matching
// ============================================================================

/**
 * Matches a pathname against a route configuration and returns the matched route.
 * Supports nested routes and extracts path parameters.
 * 
 * @param routes - Array of route configurations to match against
 * @param pathname - The pathname to match
 * @param prefix - Path prefix for nested routes (used internally)
 * @returns The matched route information or null if no match found
 * 
 * @example
 * const routes = [
 *   { path: '/', component: Home },
 *   { path: '/users/:id', component: UserDetail }
 * ];
 * 
 * matchRoute(routes, '/users/123');
 * // Returns: { route: {...}, path: '/users/:id', params: { id: '123' }, meta: {} }
 */
export function matchRoute(
  routes: readonly IRoute[],
  pathname: string,
  prefix = ''
): MatchedRoute | null {
  const normalizedPathname = normalizePath(pathname);

  for (const route of routes) {
    const fullPath = normalizePath(
      prefix === '/' 
        ? `/${route.path}` 
        : `${prefix}/${route.path}`
    );

    // Handle root path special case
    if (route.path === '/' && prefix === '') {
      // Root route matches everything, but we need to check children first
      if (route.children && route.children.length > 0) {
        const childMatch = matchRoute(route.children, normalizedPathname, '/');
        if (childMatch) {
          return childMatch;
        }
      }
      
      // Root route itself matches only exact '/'
      if (normalizedPathname === '/') {
        return {
          route,
          path: '/',
          params: {},
          meta: route.meta ?? {}
        };
      }
      continue;
    }

    const regexp = getRegexp(fullPath);
    const isExactMatch = regexp.test(normalizedPathname);

    if (isExactMatch) {
      // Check children first for more specific matches
      if (route.children && route.children.length > 0) {
        const childMatch = matchRoute(route.children, normalizedPathname, fullPath);
        if (childMatch) {
          return childMatch;
        }
      }

      // Return this route if it's an exact match
      return {
        route,
        path: fullPath,
        params: extractParams(fullPath, normalizedPathname),
        meta: route.meta ?? {}
      };
    }

    // Check children even if parent doesn't match exactly
    // This handles cases where parent is a prefix route
    if (route.children && route.children.length > 0) {
      const childMatch = matchRoute(route.children, normalizedPathname, fullPath);
      if (childMatch) {
        return childMatch;
      }
    }
  }

  return null;
}

/**
 * Finds all matching routes in the hierarchy (for nested route rendering).
 * Returns an array of matched routes from root to leaf.
 * 
 * @param routes - Array of route configurations
 * @param pathname - The pathname to match
 * @param prefix - Path prefix for nested routes
 * @returns Array of matched routes from root to leaf
 */
export function findMatchingRoutes(
  routes: readonly IRoute[],
  pathname: string,
  prefix = ''
): MatchedRoute[] {
  const normalizedPathname = normalizePath(pathname);
  const matches: MatchedRoute[] = [];

  for (const route of routes) {
    const fullPath = normalizePath(
      prefix === '/' 
        ? `/${route.path}` 
        : `${prefix}/${route.path}`
    );

    // Handle root path
    if (route.path === '/' && prefix === '') {
      if (route.children && route.children.length > 0) {
        const childMatches = findMatchingRoutes(route.children, normalizedPathname, '/');
        if (childMatches.length > 0) {
          matches.push({
            route,
            path: '/',
            params: {},
            meta: route.meta ?? {}
          });
          matches.push(...childMatches);
          return matches;
        }
      }
      
      if (normalizedPathname === '/') {
        matches.push({
          route,
          path: '/',
          params: {},
          meta: route.meta ?? {}
        });
        return matches;
      }
      continue;
    }

    const regexp = getRegexp(fullPath);
    
    // Check if this route is part of the path
    if (regexp.test(normalizedPathname) || normalizedPathname.startsWith(fullPath)) {
      const matchedRoute: MatchedRoute = {
        route,
        path: fullPath,
        params: extractParams(fullPath, normalizedPathname),
        meta: route.meta ?? {}
      };

      matches.push(matchedRoute);

      // Check children for more specific matches
      if (route.children && route.children.length > 0) {
        const childMatches = findMatchingRoutes(route.children, normalizedPathname, fullPath);
        matches.push(...childMatches);
      }

      return matches;
    }
  }

  return matches;
}

/**
 * Clears the regexp cache. Useful for testing or when routes are dynamically updated.
 */
export function clearMatcherCache(): void {
  regexpCache.clear();
  keysCache.clear();
}
