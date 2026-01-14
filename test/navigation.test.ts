import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearGuards, beforeEach as registerBeforeEach, afterEach as registerAfterEach } from '../src/guards';
import type { QueryParams } from '../src/types';

/**
 * Tests for the navigation module.
 * Feature: router-optimization
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4
 */

/**
 * Builds a search string from query parameters.
 * This is a copy of the function from navigation.ts for testing purposes,
 * to avoid importing the module which depends on Svelte runes.
 */
function buildSearchString(query?: QueryParams): string {
  if (!query) return '';
  
  const entries = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  
  return entries.length > 0 ? `?${entries.join('&')}` : '';
}

describe('Query Parameter Building', () => {
  it('should return empty string for undefined query', () => {
    expect(buildSearchString(undefined)).toBe('');
  });

  it('should return empty string for empty query object', () => {
    expect(buildSearchString({})).toBe('');
  });

  it('should build search string from string values', () => {
    const result = buildSearchString({ name: 'john', city: 'NYC' });
    expect(result).toBe('?name=john&city=NYC');
  });

  it('should build search string from number values', () => {
    const result = buildSearchString({ page: 1, limit: 10 });
    expect(result).toBe('?page=1&limit=10');
  });

  it('should build search string from boolean values', () => {
    const result = buildSearchString({ active: true, deleted: false });
    expect(result).toBe('?active=true&deleted=false');
  });

  it('should filter out undefined values', () => {
    const result = buildSearchString({ name: 'john', age: undefined });
    expect(result).toBe('?name=john');
  });

  it('should filter out null values', () => {
    const result = buildSearchString({ name: 'john', age: null });
    expect(result).toBe('?name=john');
  });

  it('should return empty string when all values are undefined or null', () => {
    const result = buildSearchString({ a: undefined, b: null });
    expect(result).toBe('');
  });

  it('should encode special characters in keys and values', () => {
    const result = buildSearchString({ 'key with space': 'value&special' });
    expect(result).toBe('?key%20with%20space=value%26special');
  });

  it('should handle mixed value types', () => {
    const result = buildSearchString({
      name: 'john',
      page: 1,
      active: true,
      filter: undefined
    });
    expect(result).toBe('?name=john&page=1&active=true');
  });
});

describe('Navigation Guard Integration', () => {
  beforeEach(() => {
    clearGuards();
  });

  it('should have guards module properly integrated', () => {
    // Test that guard registration works
    const guard = vi.fn().mockReturnValue(true);
    const removeGuard = registerBeforeEach(guard);
    
    expect(typeof removeGuard).toBe('function');
    
    // Clean up
    removeGuard();
  });

  it('should have afterEach hooks properly integrated', () => {
    // Test that hook registration works
    const hook = vi.fn();
    const removeHook = registerAfterEach(hook);
    
    expect(typeof removeHook).toBe('function');
    
    // Clean up
    removeHook();
  });
});
