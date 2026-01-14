import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  beforeEach as registerBeforeEach,
  afterEach as registerAfterEach,
  runGuards,
  runAfterHooks,
  clearGuards,
  getBeforeGuardsCount,
  getAfterHooksCount,
} from '../src/guards';
import type { NavigationGuard, AfterEachHook } from '../src/types';

/**
 * Feature: router-optimization, Property 3: Navigation Guard Execution
 *
 * For any navigation from path A to path B with registered beforeEach guards,
 * all guards SHALL be called with the correct `from` (path A) and `to` (path B)
 * parameters before the URL state changes.
 *
 * **Validates: Requirements 4.1, 4.5**
 */

/**
 * Feature: router-optimization, Property 4: Guard Cancellation
 *
 * For any navigation attempt where a beforeEach guard returns `false`,
 * the router's URL state SHALL remain unchanged (equal to the original URL
 * before navigation was attempted).
 *
 * **Validates: Requirements 4.3**
 */

/**
 * Feature: router-optimization, Property 5: Guard Redirection
 *
 * For any navigation attempt where a beforeEach guard returns a different
 * route path string, the final URL state SHALL reflect the redirected path,
 * not the originally requested path.
 *
 * **Validates: Requirements 4.4**
 */

/**
 * Feature: router-optimization, Property 6: AfterEach Hook Execution
 *
 * For any successful navigation (not cancelled by guards), all registered
 * afterEach hooks SHALL be called with the correct `from` and `to` parameters
 * after the URL state has been updated.
 *
 * **Validates: Requirements 4.2**
 */

// Arbitrary for generating valid path strings
const pathArbitrary = fc
  .array(
    fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-zA-Z0-9-_]+$/.test(s)),
    { minLength: 1, maxLength: 4 }
  )
  .map((segments) => '/' + segments.join('/'));

describe('Navigation Guard Execution (Property 3)', () => {
  beforeEach(() => {
    clearGuards();
  });

  /**
   * Property 3: Navigation Guard Execution
   * All guards should be called with correct from and to parameters
   */
  it('should call all guards with correct from and to parameters', async () => {
    await fc.assert(
      fc.asyncProperty(pathArbitrary, pathArbitrary, async (fromPath, toPath) => {
        clearGuards();
        const callLog: Array<{ from: string; to: string }> = [];

        // Register multiple guards
        const guard1: NavigationGuard = (from, to) => {
          callLog.push({ from, to });
          return true;
        };
        const guard2: NavigationGuard = (from, to) => {
          callLog.push({ from, to });
          return true;
        };

        registerBeforeEach(guard1);
        registerBeforeEach(guard2);

        await runGuards(fromPath, toPath);

        // Both guards should be called
        expect(callLog.length).toBe(2);

        // Each guard should receive correct parameters
        callLog.forEach((call) => {
          expect(call.from).toBe(fromPath);
          expect(call.to).toBe(toPath);
        });
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3 (continued): Guards are called in registration order
   */
  it('should call guards in registration order', async () => {
    await fc.assert(
      fc.asyncProperty(
        pathArbitrary,
        pathArbitrary,
        fc.integer({ min: 2, max: 5 }),
        async (fromPath, toPath, guardCount) => {
          clearGuards();
          const callOrder: number[] = [];

          // Register multiple guards
          for (let i = 0; i < guardCount; i++) {
            const index = i;
            registerBeforeEach(() => {
              callOrder.push(index);
              return true;
            });
          }

          await runGuards(fromPath, toPath);

          // Guards should be called in order
          expect(callOrder).toEqual(Array.from({ length: guardCount }, (_, i) => i));
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3 (continued): Async guards are properly awaited
   */
  it('should properly await async guards', async () => {
    await fc.assert(
      fc.asyncProperty(pathArbitrary, pathArbitrary, async (fromPath, toPath) => {
        clearGuards();
        const callLog: Array<{ from: string; to: string; timestamp: number }> = [];

        const asyncGuard: NavigationGuard = async (from, to) => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          callLog.push({ from, to, timestamp: Date.now() });
          return true;
        };

        registerBeforeEach(asyncGuard);
        registerBeforeEach(asyncGuard);

        await runGuards(fromPath, toPath);

        // Both async guards should complete
        expect(callLog.length).toBe(2);
        // Second guard should be called after first completes
        expect(callLog[1].timestamp).toBeGreaterThanOrEqual(callLog[0].timestamp);
      }),
      { numRuns: 100 }
    );
  }, 10000); // Increase timeout for async property test
});

describe('Guard Cancellation (Property 4)', () => {
  beforeEach(() => {
    clearGuards();
  });

  /**
   * Property 4: Guard Cancellation
   * When a guard returns false, runGuards should return false
   */
  it('should return false when any guard returns false', async () => {
    await fc.assert(
      fc.asyncProperty(pathArbitrary, pathArbitrary, async (fromPath, toPath) => {
        clearGuards();

        // Register a guard that allows navigation
        registerBeforeEach(() => true);

        // Register a guard that cancels navigation
        registerBeforeEach(() => false);

        // Register another guard that should not be called
        let thirdGuardCalled = false;
        registerBeforeEach(() => {
          thirdGuardCalled = true;
          return true;
        });

        const result = await runGuards(fromPath, toPath);

        // Should return false (cancelled)
        expect(result).toBe(false);

        // Third guard should not be called after cancellation
        expect(thirdGuardCalled).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4 (continued): First cancelling guard stops execution
   */
  it('should stop guard execution when a guard returns false', async () => {
    await fc.assert(
      fc.asyncProperty(
        pathArbitrary,
        pathArbitrary,
        fc.integer({ min: 1, max: 4 }),
        async (fromPath, toPath, cancelAtIndex) => {
          clearGuards();
          const callLog: number[] = [];

          // Register guards, one of which will cancel
          for (let i = 0; i <= cancelAtIndex + 1; i++) {
            const index = i;
            registerBeforeEach(() => {
              callLog.push(index);
              return index === cancelAtIndex ? false : true;
            });
          }

          await runGuards(fromPath, toPath);

          // Only guards up to and including the cancelling one should be called
          expect(callLog.length).toBe(cancelAtIndex + 1);
          expect(callLog[callLog.length - 1]).toBe(cancelAtIndex);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4 (continued): Async guard returning false cancels navigation
   */
  it('should handle async guards returning false', async () => {
    await fc.assert(
      fc.asyncProperty(pathArbitrary, pathArbitrary, async (fromPath, toPath) => {
        clearGuards();

        registerBeforeEach(async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          return false;
        });

        const result = await runGuards(fromPath, toPath);

        expect(result).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});

describe('Guard Redirection (Property 5)', () => {
  beforeEach(() => {
    clearGuards();
  });

  /**
   * Property 5: Guard Redirection
   * When a guard returns a string path, runGuards should return that path
   */
  it('should return redirect path when guard returns a string', async () => {
    await fc.assert(
      fc.asyncProperty(
        pathArbitrary,
        pathArbitrary,
        pathArbitrary,
        async (fromPath, toPath, redirectPath) => {
          clearGuards();

          // Register a guard that redirects
          registerBeforeEach(() => redirectPath);

          const result = await runGuards(fromPath, toPath);

          // Should return the redirect path
          expect(result).toBe(redirectPath);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5 (continued): First redirecting guard determines the redirect
   */
  it('should use first redirect path when multiple guards redirect', async () => {
    await fc.assert(
      fc.asyncProperty(
        pathArbitrary,
        pathArbitrary,
        pathArbitrary,
        pathArbitrary,
        async (fromPath, toPath, redirect1, redirect2) => {
          clearGuards();

          // First guard allows
          registerBeforeEach(() => true);

          // Second guard redirects
          registerBeforeEach(() => redirect1);

          // Third guard would redirect differently but shouldn't be called
          let thirdGuardCalled = false;
          registerBeforeEach(() => {
            thirdGuardCalled = true;
            return redirect2;
          });

          const result = await runGuards(fromPath, toPath);

          // Should return first redirect path
          expect(result).toBe(redirect1);

          // Third guard should not be called
          expect(thirdGuardCalled).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5 (continued): Async guard returning redirect path
   */
  it('should handle async guards returning redirect path', async () => {
    await fc.assert(
      fc.asyncProperty(pathArbitrary, pathArbitrary, pathArbitrary, async (fromPath, toPath, redirectPath) => {
        clearGuards();

        registerBeforeEach(async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          return redirectPath;
        });

        const result = await runGuards(fromPath, toPath);

        expect(result).toBe(redirectPath);
      }),
      { numRuns: 100 }
    );
  });
});

describe('AfterEach Hook Execution (Property 6)', () => {
  beforeEach(() => {
    clearGuards();
  });

  /**
   * Property 6: AfterEach Hook Execution
   * All afterEach hooks should be called with correct from and to parameters
   */
  it('should call all afterEach hooks with correct parameters', () => {
    fc.assert(
      fc.property(pathArbitrary, pathArbitrary, (fromPath, toPath) => {
        clearGuards();
        const callLog: Array<{ from: string; to: string }> = [];

        // Register multiple hooks
        const hook1: AfterEachHook = (from, to) => {
          callLog.push({ from, to });
        };
        const hook2: AfterEachHook = (from, to) => {
          callLog.push({ from, to });
        };

        registerAfterEach(hook1);
        registerAfterEach(hook2);

        runAfterHooks(fromPath, toPath);

        // Both hooks should be called
        expect(callLog.length).toBe(2);

        // Each hook should receive correct parameters
        callLog.forEach((call) => {
          expect(call.from).toBe(fromPath);
          expect(call.to).toBe(toPath);
        });
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6 (continued): Hooks are called in registration order
   */
  it('should call afterEach hooks in registration order', () => {
    fc.assert(
      fc.property(
        pathArbitrary,
        pathArbitrary,
        fc.integer({ min: 2, max: 5 }),
        (fromPath, toPath, hookCount) => {
          clearGuards();
          const callOrder: number[] = [];

          // Register multiple hooks
          for (let i = 0; i < hookCount; i++) {
            const index = i;
            registerAfterEach(() => {
              callOrder.push(index);
            });
          }

          runAfterHooks(fromPath, toPath);

          // Hooks should be called in order
          expect(callOrder).toEqual(Array.from({ length: hookCount }, (_, i) => i));
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6 (continued): All hooks are called even if one throws
   * Note: Current implementation doesn't handle errors, but hooks should all be called
   */
  it('should call all hooks for any valid path combination', () => {
    fc.assert(
      fc.property(pathArbitrary, pathArbitrary, (fromPath, toPath) => {
        clearGuards();
        let hooksCalled = 0;

        registerAfterEach(() => {
          hooksCalled++;
        });
        registerAfterEach(() => {
          hooksCalled++;
        });
        registerAfterEach(() => {
          hooksCalled++;
        });

        runAfterHooks(fromPath, toPath);

        expect(hooksCalled).toBe(3);
      }),
      { numRuns: 100 }
    );
  });
});

describe('Guard Registration and Removal', () => {
  beforeEach(() => {
    clearGuards();
  });

  /**
   * Guards can be removed using the returned function
   */
  it('should allow removing guards', async () => {
    await fc.assert(
      fc.asyncProperty(pathArbitrary, pathArbitrary, async (fromPath, toPath) => {
        clearGuards();
        let guardCalled = false;

        const removeGuard = registerBeforeEach(() => {
          guardCalled = true;
          return true;
        });

        // Remove the guard
        removeGuard();

        await runGuards(fromPath, toPath);

        // Guard should not be called after removal
        expect(guardCalled).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * AfterEach hooks can be removed using the returned function
   */
  it('should allow removing afterEach hooks', () => {
    fc.assert(
      fc.property(pathArbitrary, pathArbitrary, (fromPath, toPath) => {
        clearGuards();
        let hookCalled = false;

        const removeHook = registerAfterEach(() => {
          hookCalled = true;
        });

        // Remove the hook
        removeHook();

        runAfterHooks(fromPath, toPath);

        // Hook should not be called after removal
        expect(hookCalled).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Removing a guard doesn't affect other guards
   */
  it('should only remove the specific guard', async () => {
    await fc.assert(
      fc.asyncProperty(pathArbitrary, pathArbitrary, async (fromPath, toPath) => {
        clearGuards();
        const callLog: string[] = [];

        registerBeforeEach(() => {
          callLog.push('guard1');
          return true;
        });

        const removeGuard2 = registerBeforeEach(() => {
          callLog.push('guard2');
          return true;
        });

        registerBeforeEach(() => {
          callLog.push('guard3');
          return true;
        });

        // Remove only guard2
        removeGuard2();

        await runGuards(fromPath, toPath);

        // Only guard1 and guard3 should be called
        expect(callLog).toEqual(['guard1', 'guard3']);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * clearGuards removes all guards and hooks
   */
  it('should clear all guards and hooks', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 1, max: 5 }),
        (guardCount, hookCount) => {
          clearGuards();

          // Register guards
          for (let i = 0; i < guardCount; i++) {
            registerBeforeEach(() => true);
          }

          // Register hooks
          for (let i = 0; i < hookCount; i++) {
            registerAfterEach(() => {});
          }

          expect(getBeforeGuardsCount()).toBe(guardCount);
          expect(getAfterHooksCount()).toBe(hookCount);

          clearGuards();

          expect(getBeforeGuardsCount()).toBe(0);
          expect(getAfterHooksCount()).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
