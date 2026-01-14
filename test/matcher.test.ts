import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  matchRoute,
  normalizePath,
  extractParams,
  findMatchingRoutes,
  clearMatcherCache,
} from '../src/matcher';
import type { IRoute } from '../src/types';

/**
 * Feature: router-optimization, Property 2: Route Matching Correctness
 *
 * For any route configuration and any URL pathname, when the pathname matches
 * a route's pattern, the RouterView SHALL select and render the correct
 * component associated with that route.
 *
 * **Validates: Requirements 3.3**
 */

// Mock component for testing
const MockComponent = {} as any;

describe('Route Matching Correctness', () => {
  beforeEach(() => {
    clearMatcherCache();
  });

  /**
   * Property 2: Route Matching Correctness
   * For any valid route path, matchRoute should return the correct route
   */
  it('should match exact static paths correctly', () => {
    fc.assert(
      fc.property(
        // Generate random path segments
        fc.array(
          fc.string({ minLength: 1, maxLength: 10 })
            .filter(s => /^[a-zA-Z0-9-_]+$/.test(s)),
          { minLength: 1, maxLength: 4 }
        ),
        (segments) => {
          const path = '/' + segments.join('/');
          const routes: IRoute[] = [
            { path: segments[0], component: MockComponent }
          ];

          // Build nested routes if multiple segments
          let currentRoutes = routes;
          for (let i = 1; i < segments.length; i++) {
            const childRoute: IRoute = { path: segments[i], component: MockComponent };
            currentRoutes[0].children = [childRoute] as any;
            currentRoutes = [childRoute];
          }

          const result = matchRoute(routes, path);

          // Should find a match
          expect(result).not.toBeNull();
          // The matched route should have the last segment as its path
          expect(result!.route.path).toBe(segments[segments.length - 1]);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2 (continued): Parameter extraction correctness
   * For any route with parameters, extracted params should match the URL values
   */
  it('should correctly extract path parameters', () => {
    fc.assert(
      fc.property(
        // Generate parameter name
        fc.string({ minLength: 1, maxLength: 10 })
          .filter(s => /^[a-zA-Z][a-zA-Z0-9]*$/.test(s)),
        // Generate parameter value
        fc.string({ minLength: 1, maxLength: 20 })
          .filter(s => /^[a-zA-Z0-9-_]+$/.test(s)),
        (paramName, paramValue) => {
          const routes: IRoute[] = [
            { path: `users/:${paramName}`, component: MockComponent }
          ];

          const pathname = `/users/${paramValue}`;
          const result = matchRoute(routes, pathname);

          expect(result).not.toBeNull();
          expect(result!.params[paramName]).toBe(paramValue);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2 (continued): Non-matching paths return null
   * For any pathname that doesn't match any route, matchRoute should return null
   */
  it('should return null for non-matching paths', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 })
          .filter(s => /^[a-zA-Z0-9-_]+$/.test(s)),
        (segment) => {
          const routes: IRoute[] = [
            { path: 'specific-route', component: MockComponent }
          ];

          // Generate a path that definitely doesn't match
          const nonMatchingPath = `/different-${segment}`;
          const result = matchRoute(routes, nonMatchingPath);

          // Should not match if the segment is different from 'specific-route'
          if (segment !== 'specific-route' && !segment.startsWith('specific-route')) {
            expect(result).toBeNull();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2 (continued): Route meta is correctly returned
   * For any route with meta, the matched result should include the meta
   */
  it('should include route meta in matched result', () => {
    fc.assert(
      fc.property(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 30 }),
          requiresAuth: fc.boolean(),
        }),
        (meta) => {
          const routes: IRoute[] = [
            { path: 'dashboard', component: MockComponent, meta }
          ];

          const result = matchRoute(routes, '/dashboard');

          expect(result).not.toBeNull();
          expect(result!.meta).toEqual(meta);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2 (continued): Nested route matching
   * For any nested route structure, the most specific match should be returned
   */
  it('should match nested routes correctly', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 10 })
          .filter(s => /^[a-zA-Z][a-zA-Z0-9]*$/.test(s)),
        fc.string({ minLength: 1, maxLength: 10 })
          .filter(s => /^[a-zA-Z][a-zA-Z0-9]*$/.test(s)),
        (parent, child) => {
          // Ensure parent and child are different
          if (parent === child) return true;

          const routes: IRoute[] = [
            {
              path: parent,
              component: MockComponent,
              children: [
                { path: child, component: MockComponent }
              ]
            }
          ];

          const nestedPath = `/${parent}/${child}`;
          const result = matchRoute(routes, nestedPath);

          expect(result).not.toBeNull();
          // Should match the child route
          expect(result!.route.path).toBe(child);
          expect(result!.path).toBe(nestedPath);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Path Normalization', () => {
  /**
   * Normalization should be idempotent
   * normalizing a normalized path should return the same result
   */
  it('should be idempotent', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.string({ minLength: 1, maxLength: 10 })
            .filter(s => /^[a-zA-Z0-9-_]+$/.test(s)),
          { minLength: 0, maxLength: 5 }
        ),
        (segments) => {
          const path = segments.length > 0 ? '/' + segments.join('/') : '/';
          const normalized = normalizePath(path);
          const doubleNormalized = normalizePath(normalized);

          expect(doubleNormalized).toBe(normalized);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Normalized paths should always start with /
   */
  it('should always produce paths starting with /', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.string({ minLength: 1, maxLength: 10 })
            .filter(s => /^[a-zA-Z0-9-_]+$/.test(s)),
          { minLength: 0, maxLength: 5 }
        ),
        (segments) => {
          const path = segments.join('/');
          const normalized = normalizePath(path);

          expect(normalized.startsWith('/')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Normalized paths should not have duplicate slashes
   */
  it('should remove duplicate slashes', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.string({ minLength: 1, maxLength: 10 })
            .filter(s => /^[a-zA-Z0-9-_]+$/.test(s)),
          { minLength: 1, maxLength: 5 }
        ),
        fc.array(fc.constant('/'), { minLength: 1, maxLength: 3 }),
        (segments, extraSlashes) => {
          // Create a path with extra slashes
          const pathWithExtraSlashes = extraSlashes.join('') + segments.join(extraSlashes.join(''));
          const normalized = normalizePath(pathWithExtraSlashes);

          // Should not contain //
          expect(normalized.includes('//')).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Parameter Extraction', () => {
  /**
   * Extracted parameters should match the values in the URL
   */
  it('should extract multiple parameters correctly', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 10 })
          .filter(s => /^[a-zA-Z0-9]+$/.test(s)),
        fc.string({ minLength: 1, maxLength: 10 })
          .filter(s => /^[a-zA-Z0-9]+$/.test(s)),
        (userId, postId) => {
          const pattern = '/users/:userId/posts/:postId';
          const pathname = `/users/${userId}/posts/${postId}`;

          const params = extractParams(pattern, pathname);

          expect(params.userId).toBe(userId);
          expect(params.postId).toBe(postId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Non-matching patterns should return empty params
   */
  it('should return empty object for non-matching patterns', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 })
          .filter(s => /^[a-zA-Z0-9-_]+$/.test(s)),
        (segment) => {
          const pattern = '/specific/:id';
          const pathname = `/different/${segment}`;

          const params = extractParams(pattern, pathname);

          expect(params).toEqual({});
        }
      ),
      { numRuns: 100 }
    );
  });
});
