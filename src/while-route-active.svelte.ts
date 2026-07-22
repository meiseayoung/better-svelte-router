/**
 * Run side effects only while the current keep-alive route instance is active.
 * Must be called during component initialization (same rules as `$effect`).
 *
 * Captures keep-alive context up front (`getContext` is init-only), then
 * re-runs when `active` flips so cleanup runs on deactivate.
 *
 * @example
 * whileRouteActive(() => {
 *   const id = setInterval(poll, 5000);
 *   return () => clearInterval(id);
 * });
 */
import { getRouteAlive } from './keep-alive.js';

export function whileRouteActive(run: () => void | (() => void)): void {
  const alive = getRouteAlive();

  $effect(() => {
    if (!(alive?.active ?? true)) return;
    return run();
  });
}
