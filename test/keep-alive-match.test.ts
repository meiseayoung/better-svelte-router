import { describe, it, expect } from 'vitest';
import {
  shouldKeepAliveCache,
  matchesKeepAlivePattern,
  KeepAliveLRU,
} from '../src/keep-alive';

describe('shouldKeepAliveCache / matchesKeepAlivePattern', () => {
  const CompA = function CompA() {} as any;
  const CompB = function CompB() {} as any;

  it('caches everything when include/exclude unset', () => {
    expect(shouldKeepAliveCache(null, null, { cacheKey: '0' })).toBe(true);
  });

  it('include requires a match', () => {
    expect(
      shouldKeepAliveCache(['PageA', CompA], null, {
        name: 'PageA',
        component: CompA,
        cacheKey: '0',
      })
    ).toBe(true);
    expect(
      shouldKeepAliveCache(['PageA'], null, {
        name: 'PageB',
        cacheKey: '1',
      })
    ).toBe(false);
    expect(
      shouldKeepAliveCache([CompA], null, { component: CompB, cacheKey: 'x' })
    ).toBe(false);
  });

  it('exclude wins over include', () => {
    expect(
      shouldKeepAliveCache(['PageA'], ['PageA'], {
        name: 'PageA',
        cacheKey: '0',
      })
    ).toBe(false);
  });

  it('matches RegExp against name or cacheKey', () => {
    expect(
      matchesKeepAlivePattern(/^Page/, { name: 'PageA', cacheKey: '0' })
    ).toBe(true);
    expect(matchesKeepAlivePattern(/^key:/, { cacheKey: 'key:1' })).toBe(true);
    expect(matchesKeepAlivePattern(/^key:/, { cacheKey: '0' })).toBe(false);
  });
});

describe('KeepAliveLRU.delete', () => {
  it('removes a key without affecting order of others', () => {
    const lru = new KeepAliveLRU(5);
    lru.touch('a');
    lru.touch('b');
    lru.touch('c');
    expect(lru.delete('b')).toBe(true);
    expect([...lru.keys]).toEqual(['a', 'c']);
    expect(lru.delete('missing')).toBe(false);
  });
});
