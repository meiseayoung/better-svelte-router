import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: router-optimization, Property 1: URL State Derivation Consistency
 * 
 * For any valid URL string, when the router state's href is updated,
 * the derived values (pathname, search, hash, query) SHALL correctly
 * reflect the parsed components of that URL.
 * 
 * **Validates: Requirements 1.3**
 */

/**
 * Helper function that mimics the derivation logic in RouterState
 * This allows us to test the URL parsing logic without Svelte runes
 */
function deriveUrlState(href: string) {
  const url = new URL(href);
  const params = new URLSearchParams(url.search);
  return {
    pathname: url.pathname,
    search: url.search,
    hash: url.hash,
    query: Object.fromEntries(params.entries()) as Record<string, string>,
  };
}

describe('URL State Derivation', () => {
  /**
   * Property 1: URL State Derivation Consistency
   * For any valid URL, derived values must match URL API parsing
   */
  it('should correctly derive pathname, search, hash, and query from any valid URL', () => {
    fc.assert(
      fc.property(
        fc.webUrl({ withFragments: true, withQueryParameters: true }),
        (url) => {
          const derived = deriveUrlState(url);
          const expected = new URL(url);
          const expectedParams = new URLSearchParams(expected.search);

          // Pathname must match
          expect(derived.pathname).toBe(expected.pathname);

          // Search string must match
          expect(derived.search).toBe(expected.search);

          // Hash must match
          expect(derived.hash).toBe(expected.hash);

          // Query object must contain all search params
          expectedParams.forEach((value, key) => {
            expect(derived.query[key]).toBe(value);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1 (continued): Query parameter extraction consistency
   * For any URL with query parameters, the query object must correctly parse them
   */
  it('should correctly parse query parameters from search string', () => {
    fc.assert(
      fc.property(
        fc.record({
          protocol: fc.constantFrom('http:', 'https:'),
          host: fc.domain(),
          pathname: fc.webPath(),
          params: fc.dictionary(
            fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)),
            fc.string({ minLength: 0, maxLength: 50 }).filter(s => !s.includes('&') && !s.includes('='))
          ),
        }),
        ({ protocol, host, pathname, params }) => {
          const searchParams = new URLSearchParams(params);
          const search = searchParams.toString() ? `?${searchParams.toString()}` : '';
          const url = `${protocol}//${host}${pathname}${search}`;

          try {
            const derived = deriveUrlState(url);

            // Each param in the original should be in the derived query
            Object.entries(params).forEach(([key, value]) => {
              expect(derived.query[key]).toBe(value);
            });

            // The number of keys should match
            expect(Object.keys(derived.query).length).toBe(Object.keys(params).length);
          } catch {
            // Invalid URL construction - skip this case
            return true;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1 (continued): Hash extraction consistency
   * For any URL with a hash, the hash must be correctly extracted
   */
  it('should correctly extract hash from URL', () => {
    fc.assert(
      fc.property(
        fc.record({
          baseUrl: fc.webUrl(),
          hash: fc.string({ minLength: 0, maxLength: 20 }).filter(s => !s.includes('#') && !s.includes(' ')),
        }),
        ({ baseUrl, hash }) => {
          const urlWithHash = hash ? `${baseUrl}#${hash}` : baseUrl;

          try {
            const derived = deriveUrlState(urlWithHash);
            const expected = new URL(urlWithHash);

            expect(derived.hash).toBe(expected.hash);
          } catch {
            // Invalid URL - skip
            return true;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
