/**
 * Keep-alive activation hooks (Vue `onActivated` / `onDeactivated` analogues).
 * Also work under route `meta.keepAlive` via the same context.
 *
 * Must be called during component initialization (same rules as `$effect`).
 */
import { getRouteAlive } from './keep-alive.js';

/**
 * Run when this keep-alive instance becomes active (including first mount).
 * Re-runs after each restore from park. Prefer `whileRouteActive` when you
 * also need cleanup tied to the active period.
 *
 * @example
 * onActivated(() => console.log('shown'));
 */
export function onActivated(fn: () => void): void {
  const alive = getRouteAlive();

  $effect(() => {
    if (!(alive?.active ?? true)) return;
    fn();
  });
}

/**
 * Run when this keep-alive instance is parked (deactivated).
 * Implemented as the cleanup of an “active” effect — also runs if the
 * instance is destroyed while active.
 *
 * @example
 * onDeactivated(() => pauseVideo());
 */
export function onDeactivated(fn: () => void): void {
  const alive = getRouteAlive();

  $effect(() => {
    if (!(alive?.active ?? true)) return;
    return () => {
      fn();
    };
  });
}
