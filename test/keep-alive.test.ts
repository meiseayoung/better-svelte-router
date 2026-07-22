import { describe, it, expect } from 'vitest';
import {
  KeepAliveLRU,
  buildKeepAliveCacheKey,
  resolveKeepAlive,
  childKeepAliveInherit,
  DEFAULT_KEEP_ALIVE_MAX,
} from '../src/keep-alive';
import type { IRoute } from '../src/types';

describe('resolveKeepAlive', () => {
  it('returns null when keepAlive is unset or false', () => {
    expect(resolveKeepAlive({ path: '/a' })).toBeNull();
    expect(resolveKeepAlive({ path: '/a', meta: { keepAlive: false } })).toBeNull();
  });

  it('uses defaults for keepAlive: true', () => {
    expect(resolveKeepAlive({ path: '/a', meta: { keepAlive: true } })).toEqual({
      key: 'path',
      max: DEFAULT_KEEP_ALIVE_MAX,
      deep: false,
    });
  });

  it('merges partial options including deep', () => {
    const route: IRoute = {
      path: '/a',
      meta: { keepAlive: { key: 'full', max: 3, deep: true } },
    };
    expect(resolveKeepAlive(route)).toEqual({ key: 'full', max: 3, deep: true });
  });

  it('inherits from ancestor when meta.keepAlive is unset', () => {
    const inherit = { key: 'full' as const, max: 5, deep: true };
    expect(resolveKeepAlive({ path: '/child' }, inherit)).toEqual(inherit);
  });

  it('does not inherit when meta.keepAlive is false', () => {
    const inherit = { key: 'path' as const, max: 10, deep: true };
    expect(
      resolveKeepAlive({ path: '/child', meta: { keepAlive: false } }, inherit)
    ).toBeNull();
  });

  it('own options override inherit', () => {
    const inherit = { key: 'path' as const, max: 10, deep: true };
    const route: IRoute = {
      path: '/child',
      meta: { keepAlive: { key: 'full', max: 2 } },
    };
    expect(resolveKeepAlive(route, inherit)).toEqual({
      key: 'full',
      max: 2,
      deep: false,
    });
  });
});

describe('childKeepAliveInherit', () => {
  it('passes config only when deep is true', () => {
    expect(childKeepAliveInherit(null)).toBeNull();
    expect(
      childKeepAliveInherit({ key: 'path', max: 10, deep: false })
    ).toBeNull();
    const deep = { key: 'full' as const, max: 5, deep: true };
    expect(childKeepAliveInherit(deep)).toBe(deep);
  });
});

describe('buildKeepAliveCacheKey', () => {
  it('uses route path or full pathname based on mode', () => {
    expect(buildKeepAliveCacheKey('path', '/users/:id', '/users/1')).toBe('/users/:id');
    expect(buildKeepAliveCacheKey('full', '/users/:id', '/users/1')).toBe('/users/1');
  });
});

describe('KeepAliveLRU', () => {
  it('touches keys in LRU order and reports eviction', () => {
    const cache = new KeepAliveLRU(2);
    expect(cache.touch('a')).toEqual([]);
    expect(cache.touch('b')).toEqual([]);
    expect([...cache.keys]).toEqual(['a', 'b']);

    const evicted = cache.touch('c', 'c');
    expect(evicted).toEqual(['a']);
    expect([...cache.keys]).toEqual(['b', 'c']);
  });

  it('never evicts the active key when over capacity', () => {
    const cache = new KeepAliveLRU(1);
    cache.touch('active', 'active');
    expect(cache.touch('active', 'active')).toEqual([]);
    expect([...cache.keys]).toEqual(['active']);
  });

  it('re-touch moves an existing key to newest', () => {
    const cache = new KeepAliveLRU(3);
    cache.touch('a');
    cache.touch('b');
    cache.touch('c');
    cache.touch('a');
    expect([...cache.keys]).toEqual(['b', 'c', 'a']);
  });
});
