import { describe, it, expect, beforeEach } from 'vitest';
import { findMatchingRoutes, matchRoute, clearMatcherCache } from '../src/matcher';
import type { IRoute } from '../src/types';

/**
 * Regression tests for flat (non-nested) route configurations.
 *
 * Covers two bugs:
 * 1. A leaf route like '/events' must not match sibling sub-paths such as
 *    '/events/new' (which previously rendered the '/events' component).
 * 2. A catch-all '*' route must not throw with path-to-regexp v8 and should
 *    match any unmatched pathname.
 */

const C = {} as any;

const routes: IRoute[] = [
  { path: '/', redirect: '/events' },
  { path: '/events', component: C },
  { path: '/events/new', component: C },
  { path: '/events/new/notification', component: C },
  { path: '/events/:eventId', redirect: '/events/:eventId/my-report' },
  { path: '/events/:eventId/my-report', component: C },
  { path: '/events/:eventId/student/:studentId', component: C },
  { path: '*', component: C },
];

describe('flat route matching regression', () => {
  beforeEach(() => {
    clearMatcherCache();
  });

  const expectations: Array<[string, string]> = [
    ['/events', '/events'],
    ['/events/new', '/events/new'],
    ['/events/new/notification', '/events/new/notification'],
    ['/events/123', '/events/:eventId'],
    ['/events/123/my-report', '/events/:eventId/my-report'],
    ['/events/123/student/456', '/events/:eventId/student/:studentId'],
    ['/unknown/path', '/*'],
  ];

  for (const [pathname, expectedRoutePath] of expectations) {
    it(`findMatchingRoutes: ${pathname} -> ${expectedRoutePath}`, () => {
      const matches = findMatchingRoutes(routes, pathname);
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].path).toBe(expectedRoutePath);
    });

    it(`matchRoute: ${pathname} -> ${expectedRoutePath}`, () => {
      const match = matchRoute(routes, pathname);
      expect(match).not.toBeNull();
      expect(match!.path).toBe(expectedRoutePath);
    });
  }

  it('extracts params for dynamic segments', () => {
    const match = findMatchingRoutes(routes, '/events/abc/student/xyz')[0];
    expect(match.params).toEqual({ eventId: 'abc', studentId: 'xyz' });
  });

  it('does not throw when a catch-all "*" route is present for unmatched paths', () => {
    expect(() => findMatchingRoutes(routes, '/no/such/route')).not.toThrow();
    expect(() => matchRoute(routes, '/no/such/route')).not.toThrow();
  });
});
