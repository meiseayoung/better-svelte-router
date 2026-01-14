import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import {
  HashModeAdapter,
  HistoryModeAdapter,
  createRouterMode,
  getRouterMode,
  resetRouterMode,
  type RouterMode,
} from '../src/router-mode';

/**
 * Feature: router-optimization, Property 8: Hash Mode URL Format
 *
 * For any route path when the router is configured with hash mode,
 * the resulting URL SHALL follow the `#/path` format, and the path
 * SHALL be correctly extractable from the hash fragment.
 *
 * **Validates: Requirements 7.2, 7.3**
 */

/**
 * Feature: router-optimization, Property 9: History Mode URL Format
 *
 * For any route path when the router is configured with history mode,
 * the resulting URL SHALL be a clean URL without hash-based routing,
 * using the HTML5 History API.
 *
 * **Validates: Requirements 7.1, 7.4**
 */

/**
 * Feature: router-optimization, Property 10: Path Parsing Consistency
 *
 * For any valid URL and router mode configuration, the `getCurrentPath()`
 * method SHALL return the correct path component based on the configured
 * mode (extracting from hash for hash mode, from pathname for history mode).
 *
 * **Validates: Requirements 7.6**
 */

/**
 * Feature: router-optimization, Property 11: Browser Navigation Event Handling
 *
 * For any browser back/forward navigation event, the router state SHALL be
 * updated to reflect the correct path, regardless of whether hash mode
 * (hashchange event) or history mode (popstate event) is configured.
 *
 * **Validates: Requirements 7.7, 7.8, 7.9**
 */

// Arbitrary for generating valid path strings
const pathArbitrary = fc
  .array(
    fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-zA-Z0-9-_]+$/.test(s)),
    { minLength: 1, maxLength: 4 }
  )
  .map((segments) => '/' + segments.join('/'));

// Arbitrary for generating valid query strings
const queryArbitrary = fc
  .array(
    fc.tuple(
      fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-zA-Z][a-zA-Z0-9]*$/.test(s)),
      fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-zA-Z0-9]+$/.test(s))
    ),
    { minLength: 0, maxLength: 3 }
  )
  .map((pairs) => {
    if (pairs.length === 0) return '';
    return '?' + pairs.map(([k, v]) => `${k}=${v}`).join('&');
  });

// Mock window.location for testing
const mockLocation = {
  origin: 'https://example.com',
  pathname: '/',
  search: '',
  hash: '',
  href: 'https://example.com/',
};

// Store original window properties
let originalLocation: Location;
let originalHistory: History;

describe('Hash Mode URL Format (Property 8)', () => {
  beforeEach(() => {
    resetRouterMode();
    // Save original
    originalLocation = window.location;
    // Mock location
    Object.defineProperty(window, 'location', {
      value: { ...mockLocation },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // Restore original
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  /**
   * Property 8: Hash Mode URL Format
   * buildUrl should produce URLs in #/path format
   */
  it('should build URLs in #/path format for hash mode', () => {
    fc.assert(
      fc.property(pathArbitrary, (path) => {
        const adapter = new HashModeAdapter();
        const url = adapter.buildUrl(path);

        // URL should contain hash with path
        expect(url).toContain('#' + path);
        // URL should follow the format: origin + pathname + #/path
        expect(url).toBe(`${window.location.origin}${window.location.pathname}#${path}`);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8 (continued): Hash mode URLs with query strings
   */
  it('should build URLs with query strings in hash mode', () => {
    fc.assert(
      fc.property(pathArbitrary, queryArbitrary, (path, search) => {
        const adapter = new HashModeAdapter();
        const url = adapter.buildUrl(path, search);

        // URL should contain hash with path and search
        expect(url).toContain('#' + path + search);
        expect(url).toBe(`${window.location.origin}${window.location.pathname}#${path}${search}`);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8 (continued): Path extraction from hash
   * getCurrentPath should correctly extract path from hash fragment
   */
  it('should correctly extract path from hash fragment', () => {
    fc.assert(
      fc.property(pathArbitrary, (path) => {
        const adapter = new HashModeAdapter();
        
        // Set the hash
        (window.location as any).hash = '#' + path;

        const extractedPath = adapter.getCurrentPath();

        expect(extractedPath).toBe(path);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8 (continued): Path extraction with query string in hash
   */
  it('should extract path correctly when hash contains query string', () => {
    fc.assert(
      fc.property(pathArbitrary, queryArbitrary, (path, search) => {
        // Skip empty search strings for this test
        if (!search) return true;

        const adapter = new HashModeAdapter();
        
        // Set the hash with query string
        (window.location as any).hash = '#' + path + search;

        const extractedPath = adapter.getCurrentPath();

        // Path should not include query string
        expect(extractedPath).toBe(path);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8 (continued): getMode returns 'hash'
   */
  it('should return hash as the mode', () => {
    const adapter = new HashModeAdapter();
    expect(adapter.getMode()).toBe('hash');
  });

  /**
   * Property 8 (continued): Empty hash returns root path
   */
  it('should return root path for empty hash', () => {
    const adapter = new HashModeAdapter();
    (window.location as any).hash = '';

    expect(adapter.getCurrentPath()).toBe('/');
  });
});


describe('History Mode URL Format (Property 9)', () => {
  beforeEach(() => {
    resetRouterMode();
    // Save original
    originalLocation = window.location;
    // Mock location
    Object.defineProperty(window, 'location', {
      value: { ...mockLocation },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // Restore original
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  /**
   * Property 9: History Mode URL Format
   * buildUrl should produce clean URLs without hash
   */
  it('should build clean URLs without hash for history mode', () => {
    fc.assert(
      fc.property(pathArbitrary, (path) => {
        const adapter = new HistoryModeAdapter();
        const url = adapter.buildUrl(path);

        // URL should not contain hash-based routing
        expect(url).not.toContain('#/');
        // URL should be clean: origin + path
        expect(url).toBe(`${window.location.origin}${path}`);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9 (continued): History mode URLs with base path
   */
  it('should build URLs with base path in history mode', () => {
    fc.assert(
      fc.property(
        pathArbitrary,
        fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-zA-Z0-9-_]+$/.test(s)),
        (path, baseName) => {
          const base = '/' + baseName;
          const adapter = new HistoryModeAdapter(base);
          const url = adapter.buildUrl(path);

          // URL should include base path
          expect(url).toBe(`${window.location.origin}${base}${path}`);
          // URL should not contain hash
          expect(url).not.toContain('#');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9 (continued): History mode URLs with query strings
   */
  it('should build URLs with query strings in history mode', () => {
    fc.assert(
      fc.property(pathArbitrary, queryArbitrary, (path, search) => {
        const adapter = new HistoryModeAdapter();
        const url = adapter.buildUrl(path, search);

        // URL should contain path and search without hash
        expect(url).toBe(`${window.location.origin}${path}${search}`);
        expect(url).not.toContain('#');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9 (continued): Path extraction from pathname
   */
  it('should correctly extract path from pathname', () => {
    fc.assert(
      fc.property(pathArbitrary, (path) => {
        const adapter = new HistoryModeAdapter();
        
        // Set the pathname
        (window.location as any).pathname = path;

        const extractedPath = adapter.getCurrentPath();

        expect(extractedPath).toBe(path);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9 (continued): Path extraction with base path
   */
  it('should extract path correctly when base path is configured', () => {
    fc.assert(
      fc.property(
        pathArbitrary,
        fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-zA-Z0-9-_]+$/.test(s)),
        (path, baseName) => {
          const base = '/' + baseName;
          const adapter = new HistoryModeAdapter(base);
          
          // Set the pathname with base
          (window.location as any).pathname = base + path;

          const extractedPath = adapter.getCurrentPath();

          // Should extract path without base
          expect(extractedPath).toBe(path);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9 (continued): getMode returns 'history'
   */
  it('should return history as the mode', () => {
    const adapter = new HistoryModeAdapter();
    expect(adapter.getMode()).toBe('history');
  });

  /**
   * Property 9 (continued): Empty pathname returns root path
   */
  it('should return root path for empty pathname', () => {
    const adapter = new HistoryModeAdapter();
    (window.location as any).pathname = '';

    expect(adapter.getCurrentPath()).toBe('/');
  });

  /**
   * Property 9 (continued): Trailing slash in base is removed
   */
  it('should handle trailing slash in base path', () => {
    fc.assert(
      fc.property(
        pathArbitrary,
        fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-zA-Z0-9-_]+$/.test(s)),
        (path, baseName) => {
          const baseWithSlash = '/' + baseName + '/';
          const baseWithoutSlash = '/' + baseName;
          
          const adapter = new HistoryModeAdapter(baseWithSlash);
          const url = adapter.buildUrl(path);

          // Base trailing slash should be removed
          expect(url).toBe(`${window.location.origin}${baseWithoutSlash}${path}`);
        }
      ),
      { numRuns: 100 }
    );
  });
});


describe('Path Parsing Consistency (Property 10)', () => {
  beforeEach(() => {
    resetRouterMode();
    // Save original
    originalLocation = window.location;
    // Mock location
    Object.defineProperty(window, 'location', {
      value: { ...mockLocation },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // Restore original
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  /**
   * Property 10: Path Parsing Consistency
   * getCurrentPath should return correct path based on configured mode
   */
  it('should parse path consistently based on router mode', () => {
    fc.assert(
      fc.property(pathArbitrary, (path) => {
        // Test hash mode
        const hashAdapter = new HashModeAdapter();
        (window.location as any).hash = '#' + path;
        (window.location as any).pathname = '/';
        
        const hashPath = hashAdapter.getCurrentPath();
        expect(hashPath).toBe(path);

        // Test history mode
        const historyAdapter = new HistoryModeAdapter();
        (window.location as any).hash = '';
        (window.location as any).pathname = path;
        
        const historyPath = historyAdapter.getCurrentPath();
        expect(historyPath).toBe(path);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10 (continued): Hash mode ignores pathname for path extraction
   */
  it('should extract path from hash in hash mode regardless of pathname', () => {
    fc.assert(
      fc.property(pathArbitrary, pathArbitrary, (hashPath, pathnamePath) => {
        const adapter = new HashModeAdapter();
        
        // Set both hash and pathname to different values
        (window.location as any).hash = '#' + hashPath;
        (window.location as any).pathname = pathnamePath;

        const extractedPath = adapter.getCurrentPath();

        // Should use hash, not pathname
        expect(extractedPath).toBe(hashPath);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10 (continued): History mode ignores hash for path extraction
   */
  it('should extract path from pathname in history mode regardless of hash', () => {
    fc.assert(
      fc.property(pathArbitrary, pathArbitrary, (pathnamePath, hashPath) => {
        const adapter = new HistoryModeAdapter();
        
        // Set both pathname and hash to different values
        (window.location as any).pathname = pathnamePath;
        (window.location as any).hash = '#' + hashPath;

        const extractedPath = adapter.getCurrentPath();

        // Should use pathname, not hash
        expect(extractedPath).toBe(pathnamePath);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10 (continued): Query string extraction consistency
   */
  it('should extract query string consistently based on router mode', () => {
    fc.assert(
      fc.property(pathArbitrary, queryArbitrary, (path, search) => {
        // Skip empty search for this test
        if (!search) return true;

        // Test hash mode - query is in hash
        const hashAdapter = new HashModeAdapter();
        (window.location as any).hash = '#' + path + search;
        (window.location as any).search = '';
        
        const hashSearch = hashAdapter.getCurrentSearch();
        expect(hashSearch).toBe(search);

        // Test history mode - query is in search
        const historyAdapter = new HistoryModeAdapter();
        (window.location as any).hash = '';
        (window.location as any).search = search;
        
        const historySearch = historyAdapter.getCurrentSearch();
        expect(historySearch).toBe(search);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10 (continued): createRouterMode creates correct adapter type
   */
  it('should create correct adapter type based on mode config', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('hash', 'history') as fc.Arbitrary<RouterMode>,
        (mode) => {
          resetRouterMode();
          const adapter = createRouterMode({ mode });

          expect(adapter.getMode()).toBe(mode);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10 (continued): getRouterMode returns consistent adapter
   */
  it('should return same adapter instance from getRouterMode', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('hash', 'history') as fc.Arbitrary<RouterMode>,
        (mode) => {
          resetRouterMode();
          const created = createRouterMode({ mode });
          const retrieved = getRouterMode();

          expect(retrieved).toBe(created);
          expect(retrieved.getMode()).toBe(mode);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10 (continued): Default mode is history when not initialized
   */
  it('should default to history mode when not initialized', () => {
    resetRouterMode();
    const adapter = getRouterMode();

    expect(adapter.getMode()).toBe('history');
  });
});


describe('Browser Navigation Event Handling (Property 11)', () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetRouterMode();
    // Save original
    originalLocation = window.location;
    // Mock location
    Object.defineProperty(window, 'location', {
      value: { ...mockLocation },
      writable: true,
      configurable: true,
    });
    
    // Spy on event listeners
    addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    // Restore original
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
    
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  /**
   * Property 11: Browser Navigation Event Handling
   * Hash mode should listen to hashchange event
   */
  it('should listen to hashchange event in hash mode', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10 }), (callCount) => {
        addEventListenerSpy.mockClear();
        
        const adapter = new HashModeAdapter();
        const callbacks: Array<() => void> = [];
        
        // Setup multiple listeners
        for (let i = 0; i < callCount; i++) {
          const callback = vi.fn();
          callbacks.push(callback);
          adapter.setupListener(callback);
        }

        // Verify hashchange listeners were added
        const hashchangeCalls = addEventListenerSpy.mock.calls.filter(
          (call) => call[0] === 'hashchange'
        );
        expect(hashchangeCalls.length).toBe(callCount);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11 (continued): History mode should listen to popstate event
   */
  it('should listen to popstate event in history mode', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10 }), (callCount) => {
        addEventListenerSpy.mockClear();
        
        const adapter = new HistoryModeAdapter();
        const callbacks: Array<() => void> = [];
        
        // Setup multiple listeners
        for (let i = 0; i < callCount; i++) {
          const callback = vi.fn();
          callbacks.push(callback);
          adapter.setupListener(callback);
        }

        // Verify popstate listeners were added
        const popstateCalls = addEventListenerSpy.mock.calls.filter(
          (call) => call[0] === 'popstate'
        );
        expect(popstateCalls.length).toBe(callCount);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11 (continued): Cleanup function removes the correct listener
   */
  it('should remove hashchange listener when cleanup is called in hash mode', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 5 }), (listenerCount) => {
        removeEventListenerSpy.mockClear();
        
        const adapter = new HashModeAdapter();
        const cleanups: Array<() => void> = [];
        
        // Setup listeners
        for (let i = 0; i < listenerCount; i++) {
          const cleanup = adapter.setupListener(vi.fn());
          cleanups.push(cleanup);
        }

        // Call all cleanups
        cleanups.forEach((cleanup) => cleanup());

        // Verify hashchange listeners were removed
        const hashchangeRemoveCalls = removeEventListenerSpy.mock.calls.filter(
          (call) => call[0] === 'hashchange'
        );
        expect(hashchangeRemoveCalls.length).toBe(listenerCount);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11 (continued): Cleanup function removes the correct listener in history mode
   */
  it('should remove popstate listener when cleanup is called in history mode', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 5 }), (listenerCount) => {
        removeEventListenerSpy.mockClear();
        
        const adapter = new HistoryModeAdapter();
        const cleanups: Array<() => void> = [];
        
        // Setup listeners
        for (let i = 0; i < listenerCount; i++) {
          const cleanup = adapter.setupListener(vi.fn());
          cleanups.push(cleanup);
        }

        // Call all cleanups
        cleanups.forEach((cleanup) => cleanup());

        // Verify popstate listeners were removed
        const popstateRemoveCalls = removeEventListenerSpy.mock.calls.filter(
          (call) => call[0] === 'popstate'
        );
        expect(popstateRemoveCalls.length).toBe(listenerCount);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11 (continued): Callback is invoked when event fires
   */
  it('should invoke callback when hashchange event fires', () => {
    const adapter = new HashModeAdapter();
    const callback = vi.fn();
    
    adapter.setupListener(callback);

    // Simulate hashchange event
    const event = new Event('hashchange');
    window.dispatchEvent(event);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  /**
   * Property 11 (continued): Callback is invoked when popstate event fires
   */
  it('should invoke callback when popstate event fires', () => {
    const adapter = new HistoryModeAdapter();
    const callback = vi.fn();
    
    adapter.setupListener(callback);

    // Simulate popstate event
    const event = new Event('popstate');
    window.dispatchEvent(event);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  /**
   * Property 11 (continued): Multiple callbacks are all invoked
   */
  it('should invoke all registered callbacks when event fires', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('hash', 'history') as fc.Arbitrary<RouterMode>,
        fc.integer({ min: 1, max: 5 }),
        (mode, callbackCount) => {
          const adapter = mode === 'hash' 
            ? new HashModeAdapter() 
            : new HistoryModeAdapter();
          const callbacks = Array.from({ length: callbackCount }, () => vi.fn());
          
          // Register all callbacks
          callbacks.forEach((cb) => adapter.setupListener(cb));

          // Simulate the appropriate event
          const eventType = mode === 'hash' ? 'hashchange' : 'popstate';
          const event = new Event(eventType);
          window.dispatchEvent(event);

          // All callbacks should be called
          callbacks.forEach((cb) => {
            expect(cb).toHaveBeenCalledTimes(1);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11 (continued): Cleanup prevents callback from being invoked
   */
  it('should not invoke callback after cleanup is called', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('hash', 'history') as fc.Arbitrary<RouterMode>,
        (mode) => {
          const adapter = mode === 'hash' 
            ? new HashModeAdapter() 
            : new HistoryModeAdapter();
          const callback = vi.fn();
          
          const cleanup = adapter.setupListener(callback);
          
          // Call cleanup before event
          cleanup();

          // Simulate the appropriate event
          const eventType = mode === 'hash' ? 'hashchange' : 'popstate';
          const event = new Event(eventType);
          window.dispatchEvent(event);

          // Callback should not be called
          expect(callback).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11 (continued): Each mode uses correct event type exclusively
   */
  it('should use correct event type for each mode', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('hash', 'history') as fc.Arbitrary<RouterMode>,
        (mode) => {
          addEventListenerSpy.mockClear();
          
          const adapter = mode === 'hash' 
            ? new HashModeAdapter() 
            : new HistoryModeAdapter();
          
          adapter.setupListener(vi.fn());

          const expectedEvent = mode === 'hash' ? 'hashchange' : 'popstate';
          const unexpectedEvent = mode === 'hash' ? 'popstate' : 'hashchange';

          // Should have added listener for expected event
          const expectedCalls = addEventListenerSpy.mock.calls.filter(
            (call) => call[0] === expectedEvent
          );
          expect(expectedCalls.length).toBe(1);

          // Should not have added listener for unexpected event
          const unexpectedCalls = addEventListenerSpy.mock.calls.filter(
            (call) => call[0] === unexpectedEvent
          );
          expect(unexpectedCalls.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
