import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { IRoute, RouteMeta } from '../src/types';
import { findMatchingRoutes } from '../src/matcher';

/**
 * Feature: router-optimization, Property 7: Route Meta Accessibility
 * 
 * For any route with a defined `meta` property, after navigation to that route,
 * the router state's `meta` property SHALL contain the route's meta information.
 * 
 * **Validates: Requirements 5.2, 5.3**
 */

/**
 * Helper to get the meta from the deepest matched route.
 * In RouterView, the $effect updates routerState.meta based on the current match.
 * For nested routes, we want the most specific (deepest) match's meta.
 */
function getMetaFromMatch(routes: readonly IRoute[], pathname: string): RouteMeta {
  const matches = findMatchingRoutes(routes, pathname);
  if (matches.length === 0) return {};
  
  // Get the deepest (most specific) match - last in the array
  const deepestMatch = matches[matches.length - 1];
  return deepestMatch.meta;
}

/**
 * Arbitrary generator for route meta objects
 */
const routeMetaArb = fc.record({
  title: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  requiresAuth: fc.option(fc.boolean(), { nil: undefined }),
  // Additional arbitrary metadata
  customKey: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
});

/**
 * Arbitrary generator for simple route paths (no parameters)
 */
const simplePathArb = fc.stringMatching(/^\/[a-z][a-z0-9-]{0,15}$/);

/**
 * Arbitrary generator for child path segments (without leading slash)
 */
const childPathArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,10}$/);

/**
 * Arbitrary generator for route configurations with meta
 */
const routeWithMetaArb = fc.record({
  path: simplePathArb,
  meta: routeMetaArb,
});

describe('Route Meta Accessibility', () => {
  /**
   * Property 7: Route Meta Accessibility
   * For any route with meta, after matching that route, the meta should be accessible
   */
  it('should make route meta accessible after navigation to route with meta', () => {
    fc.assert(
      fc.property(
        routeWithMetaArb,
        (routeConfig) => {
          // Create a route configuration with the generated meta
          const routes: IRoute[] = [
            {
              path: '/',
              children: [
                {
                  path: routeConfig.path.slice(1), // Remove leading slash for child
                  meta: routeConfig.meta,
                },
              ],
            },
          ];

          // Simulate navigation by matching the route
          const pathname = routeConfig.path;
          const resultMeta = getMetaFromMatch(routes, pathname);

          // The meta from the matched route should be accessible
          // Check each defined property in the original meta
          if (routeConfig.meta.title !== undefined) {
            expect(resultMeta.title).toBe(routeConfig.meta.title);
          }
          if (routeConfig.meta.requiresAuth !== undefined) {
            expect(resultMeta.requiresAuth).toBe(routeConfig.meta.requiresAuth);
          }
          if (routeConfig.meta.customKey !== undefined) {
            expect(resultMeta.customKey).toBe(routeConfig.meta.customKey);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7 (continued): Routes without meta should result in empty meta object
   */
  it('should return empty meta object for routes without meta defined', () => {
    fc.assert(
      fc.property(
        simplePathArb,
        (path) => {
          // Create a route without meta
          const routes: IRoute[] = [
            {
              path: '/',
              children: [
                {
                  path: path.slice(1), // Remove leading slash for child
                  // No meta defined
                },
              ],
            },
          ];

          // Simulate navigation
          const resultMeta = getMetaFromMatch(routes, path);

          // Meta should be an empty object
          expect(resultMeta).toEqual({});
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7 (continued): Nested routes should have their own meta accessible
   */
  it('should access meta from the deepest matched route in nested routes', () => {
    fc.assert(
      fc.property(
        fc.record({
          parentMeta: routeMetaArb,
          childMeta: routeMetaArb,
          childPath: childPathArb,
        }),
        ({ parentMeta, childMeta, childPath }) => {
          // Create nested routes with different meta
          const routes: IRoute[] = [
            {
              path: '/',
              meta: { title: 'Root' },
              children: [
                {
                  path: 'parent',
                  meta: parentMeta,
                  children: [
                    {
                      path: childPath,
                      meta: childMeta,
                    },
                  ],
                },
              ],
            },
          ];

          // Navigate to the child route
          const pathname = `/parent/${childPath}`;
          const deepestMeta = getMetaFromMatch(routes, pathname);
          
          // The deepest match should have the child's meta
          if (childMeta.title !== undefined) {
            expect(deepestMeta.title).toBe(childMeta.title);
          }
          if (childMeta.requiresAuth !== undefined) {
            expect(deepestMeta.requiresAuth).toBe(childMeta.requiresAuth);
          }
          if (childMeta.customKey !== undefined) {
            expect(deepestMeta.customKey).toBe(childMeta.customKey);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7 (continued): Meta should be preserved exactly as defined
   * (no mutation or loss of properties)
   */
  it('should preserve all meta properties exactly as defined', () => {
    fc.assert(
      fc.property(
        fc.record({
          path: simplePathArb,
          meta: fc.dictionary(
            fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)),
            fc.oneof(
              fc.string({ minLength: 0, maxLength: 20 }),
              fc.boolean(),
              fc.integer({ min: -1000, max: 1000 })
            )
          ),
        }),
        ({ path, meta }) => {
          const routes: IRoute[] = [
            {
              path: '/',
              children: [
                {
                  path: path.slice(1),
                  meta: meta as RouteMeta,
                },
              ],
            },
          ];

          const resultMeta = getMetaFromMatch(routes, path);

          // All properties should be preserved
          Object.entries(meta).forEach(([key, value]) => {
            expect(resultMeta[key]).toBe(value);
          });

          // No extra properties should be added
          expect(Object.keys(resultMeta).length).toBe(Object.keys(meta).length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
