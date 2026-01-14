import type { NavigationGuard, NavigationGuardResult, AfterEachHook } from './types';

/**
 * Navigation guards module for controlling route access.
 * Provides beforeEach guards and afterEach hooks for navigation lifecycle.
 */

/** Array of registered beforeEach guards */
const beforeGuards: NavigationGuard[] = [];

/** Array of registered afterEach hooks */
const afterHooks: AfterEachHook[] = [];

/**
 * Registers a navigation guard that runs before each navigation.
 * Guards are executed in the order they were registered.
 * 
 * @param guard - The navigation guard function
 * @returns A function to remove the guard
 * 
 * @example
 * const removeGuard = beforeEach((from, to) => {
 *   if (!isAuthenticated && to.startsWith('/admin')) {
 *     return '/login'; // redirect
 *   }
 *   return true; // allow navigation
 * });
 * 
 * // Later, to remove the guard:
 * removeGuard();
 */
export function beforeEach(guard: NavigationGuard): () => void {
  beforeGuards.push(guard);
  return () => {
    const index = beforeGuards.indexOf(guard);
    if (index > -1) {
      beforeGuards.splice(index, 1);
    }
  };
}

/**
 * Registers a hook that runs after each successful navigation.
 * Hooks are executed in the order they were registered.
 * 
 * @param hook - The after navigation hook function
 * @returns A function to remove the hook
 * 
 * @example
 * const removeHook = afterEach((from, to) => {
 *   console.log(`Navigated from ${from} to ${to}`);
 *   analytics.trackPageView(to);
 * });
 * 
 * // Later, to remove the hook:
 * removeHook();
 */
export function afterEach(hook: AfterEachHook): () => void {
  afterHooks.push(hook);
  return () => {
    const index = afterHooks.indexOf(hook);
    if (index > -1) {
      afterHooks.splice(index, 1);
    }
  };
}

/**
 * Executes all registered beforeEach guards sequentially.
 * Stops execution if a guard returns false or a redirect path.
 * If a guard throws an error, navigation is cancelled and the error is logged.
 * 
 * @param from - The path being navigated from
 * @param to - The path being navigated to
 * @returns Promise resolving to:
 *   - `true` if all guards allow navigation
 *   - `false` if any guard cancels navigation or throws an error
 *   - `string` if any guard requests a redirect
 */
export async function runGuards(from: string, to: string): Promise<boolean | string> {
  for (const guard of beforeGuards) {
    try {
      const result: NavigationGuardResult = await guard(from, to);
      
      // Guard returned false - cancel navigation
      if (result === false) {
        return false;
      }
      
      // Guard returned a string - redirect to that path
      if (typeof result === 'string') {
        return result;
      }
      
      // Guard returned true, undefined, or void - continue to next guard
    } catch (error) {
      // Log error and cancel navigation
      console.error('[Router] Error in beforeEach guard:', error);
      return false;
    }
  }
  
  // All guards passed
  return true;
}

/**
 * Executes all registered afterEach hooks.
 * Called after successful navigation (not cancelled by guards).
 * Errors in individual hooks are caught and logged to prevent
 * one failing hook from blocking others.
 * 
 * @param from - The path navigated from
 * @param to - The path navigated to
 */
export function runAfterHooks(from: string, to: string): void {
  for (const hook of afterHooks) {
    try {
      hook(from, to);
    } catch (error) {
      // Log error but continue executing other hooks
      console.error('[Router] Error in afterEach hook:', error);
    }
  }
}

/**
 * Clears all registered guards and hooks.
 * Useful for testing or resetting router state.
 */
export function clearGuards(): void {
  beforeGuards.length = 0;
  afterHooks.length = 0;
}

/**
 * Gets the current number of registered beforeEach guards.
 * Useful for testing.
 * @internal This function is intended for testing purposes only.
 */
export function getBeforeGuardsCount(): number {
  return beforeGuards.length;
}

/**
 * Gets the current number of registered afterEach hooks.
 * Useful for testing.
 * @internal This function is intended for testing purposes only.
 */
export function getAfterHooksCount(): number {
  return afterHooks.length;
}
