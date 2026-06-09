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
 * Cache for prefix-matching regular expressions used to determine whether a
 * parameterized parent route is a prefix of the current pathname.
 * Key: normalized path pattern, Value: compiled prefix RegExp
 */
const prefixRegexpCache = new Map<string, RegExp>();

/**
 * Detects catch-all wildcard patterns ('*', '/*', or '/**').
 * These are commonly used for "not found" routes. path-to-regexp v8 no longer
 * accepts a bare '*' (it requires a named wildcard like '/*splat'), and would
 * throw "Missing parameter name". We handle these patterns ourselves so existing
 * configs using '*' keep working.
 * @param path - The normalized path pattern
 * @returns True if the pattern is a catch-all wildcard
 */
function isCatchAll(path: string): boolean {
  return path === '*' || path === '/*' || path === '/**';
}

/** Regexp that matches any pathname (used for catch-all routes). */
const MATCH_ANY = /^.*$/;

/**
 * Gets or creates a cached RegExp for the given path pattern.
 * @param path - The path pattern to compile
 * @returns The compiled RegExp
 */
export function getRegexp(path: string): RegExp {
  if (!regexpCache.has(path)) {
    if (isCatchAll(path)) {
      // Catch-all routes match any pathname and expose no parameters.
      regexpCache.set(path, MATCH_ANY);
      keysCache.set(path, []);
    } else {
      const { regexp, keys } = pathToRegexp(path);
      regexpCache.set(path, regexp);
      keysCache.set(path, keys.map(k => k.name));
    }
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

/**
 * Gets or creates a cached prefix-matching RegExp for the given path pattern.
 * Converts the exact-match regexp produced by path-to-regexp (which ends with
 * `(?:\/$)?$`) into one that matches at segment boundaries (`(?:\/|$)`), so a
 * parameterized parent route (e.g. '/events/:eventId') can be detected as a
 * prefix of a deeper pathname (e.g. '/events/evt/my-report').
 * @param path - The path pattern to compile
 * @returns The compiled prefix RegExp
 */
function getPrefixRegexp(path: string): RegExp {
  if (!prefixRegexpCache.has(path)) {
    if (isCatchAll(path)) {
      prefixRegexpCache.set(path, MATCH_ANY);
    } else {
      const { regexp } = pathToRegexp(path);
      let source = regexp.source;
      // path-to-regexp v8 produces patterns ending with (?:\/$)?$
      // We replace it with (?:\/|$) to allow prefix matching at segment boundaries.
      const trailingSlashEnd = '(?:\\/$)?$';
      if (source.endsWith(trailingSlashEnd)) {
        source = source.slice(0, -trailingSlashEnd.length) + '(?:\\/|$)';
      } else if (source.endsWith('$')) {
        source = source.slice(0, -1) + '(?:\\/|$)';
      }
      prefixRegexpCache.set(path, new RegExp(source, regexp.flags));
    }
  }
  return prefixRegexpCache.get(path)!;
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
    const hasChildren = !!route.children && route.children.length > 0;

    // Case 1: this route exactly matches the pathname. It is the target route,
    // so it always joins the chain. If it has children, recurse to append any
    // deeper (more specific) matches.
    if (regexp.test(normalizedPathname)) {
      matches.push({
        route,
        path: fullPath,
        params: extractParams(fullPath, normalizedPathname),
        meta: route.meta ?? {}
      });

      if (hasChildren) {
        const childMatches = findMatchingRoutes(route.children!, normalizedPathname, fullPath);
        matches.push(...childMatches);
      }

      return matches;
    }

    // Case 2: this route is a "segment prefix" of a deeper pathname. We only
    // follow it when it has children AND a descendant actually matches.
    // Otherwise a prefix parent (e.g. '/shop/:category') would swallow the path
    // and shadow a later sibling that should match (e.g. '/shop/sale/today'),
    // producing a parent layout with an empty outlet.
    // Boundary handling: startsWith requires a trailing '/' so '/registered'
    // does not match '/register'; the prefix regexp handles ':param' segments.
    if (hasChildren) {
      const isSegmentPrefix =
        normalizedPathname.startsWith(fullPath + '/') ||
        getPrefixRegexp(fullPath).test(normalizedPathname);

      if (isSegmentPrefix) {
        const childMatches = findMatchingRoutes(route.children!, normalizedPathname, fullPath);
        if (childMatches.length > 0) {
          // The parent's own exact regexp can't capture params from a longer
          // pathname, so recover the parent's params from the deepest match,
          // keeping only the keys that belong to the parent pattern.
          const leafParams = childMatches[childMatches.length - 1].params;
          const parentParams: Record<string, string> = {};
          for (const key of getKeys(fullPath)) {
            if (key in leafParams) parentParams[key] = leafParams[key];
          }

          matches.push({
            route,
            path: fullPath,
            params: parentParams,
            meta: route.meta ?? {}
          });
          matches.push(...childMatches);
          return matches;
        }
        // No descendant matched: do not claim this prefix; try the next sibling.
      }
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
  prefixRegexpCache.clear();
}
