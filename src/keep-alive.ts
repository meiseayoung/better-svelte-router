import { getContext } from 'svelte';
import type { IRoute, KeepAliveKeyMode } from './types';

/** Default max cached instances per keep-alive route in one outlet. */
export const DEFAULT_KEEP_ALIVE_MAX = 10;

/** Context key for route alive state (`active` toggles with visibility). */
export const ROUTE_ALIVE_CONTEXT = Symbol('better-svelte-router:route-alive');

/**
 * Reactive keep-alive status for the current route component tree.
 * When `active` is false the instance is parked off-document; pause timers /
 * subscriptions in `$effect` that depend on `active`.
 */
export interface RouteAliveContext {
  /** Whether this cached instance is the currently matched route. */
  readonly active: boolean;
}

/**
 * Resolved keep-alive config, or `null` when the route should destroy on leave.
 */
export interface ResolvedKeepAlive {
  key: KeepAliveKeyMode;
  max: number;
  deep: boolean;
}

/**
 * Reads keep-alive options from route meta, optionally inheriting from an
 * ancestor `RouterView` when the parent used `keepAlive: { deep: true }`.
 *
 * - `meta.keepAlive === false` → opt out (no inherit)
 * - `meta.keepAlive` unset → use `inherit`
 * - `true` / options → resolve locally
 */
export function resolveKeepAlive(
  route: IRoute,
  inherit: ResolvedKeepAlive | null = null
): ResolvedKeepAlive | null {
  const value = route.meta?.keepAlive;
  if (value === false) return null;
  if (value === undefined) return inherit;
  if (value === true) {
    return { key: 'path', max: DEFAULT_KEEP_ALIVE_MAX, deep: false };
  }
  return {
    key: value.key ?? 'path',
    max: value.max ?? DEFAULT_KEEP_ALIVE_MAX,
    deep: value.deep ?? false,
  };
}

/**
 * Config to pass into a nested `RouterView` when this route enables deep inherit.
 */
export function childKeepAliveInherit(
  config: ResolvedKeepAlive | null
): ResolvedKeepAlive | null {
  return config?.deep ? config : null;
}

/**
 * Builds the cache key for a keep-alive entry.
 */
export function buildKeepAliveCacheKey(
  mode: KeepAliveKeyMode,
  routePath: string,
  pathname: string
): string {
  return mode === 'full' ? pathname : routePath;
}

/**
 * LRU-ordered list of cache keys. Newest keys are at the end.
 * Evicts the oldest key that is not currently active when over `max`.
 */
export class KeepAliveLRU {
  #keys: string[] = [];
  readonly max: number;

  constructor(max: number = DEFAULT_KEEP_ALIVE_MAX) {
    this.max = Math.max(1, max);
  }

  /** Snapshot of keys in LRU order (oldest → newest). */
  get keys(): readonly string[] {
    return this.#keys;
  }

  has(key: string): boolean {
    return this.#keys.includes(key);
  }

  /**
   * Marks `key` as most recently used. Evicts oldest inactive entries
   * until size ≤ max (never evicts `activeKey` when provided).
   * @returns Evicted keys.
   */
  touch(key: string, activeKey?: string): string[] {
    this.#keys = this.#keys.filter((k) => k !== key);
    this.#keys.push(key);

    const evicted: string[] = [];
    while (this.#keys.length > this.max) {
      const idx = this.#keys.findIndex((k) => k !== activeKey);
      if (idx === -1) break;
      evicted.push(this.#keys[idx]!);
      this.#keys.splice(idx, 1);
    }
    return evicted;
  }
}

/**
 * Returns the keep-alive context for the nearest route instance, if any.
 * Outside a keep-alive boundary this returns `undefined` (treat as active).
 */
export function getRouteAlive(): RouteAliveContext | undefined {
  return getContext<RouteAliveContext | undefined>(ROUTE_ALIVE_CONTEXT);
}

/**
 * Convenience: whether the current route instance should run foreground work.
 * Returns `true` when not under a keep-alive boundary.
 */
export function isRouteActive(): boolean {
  return getRouteAlive()?.active ?? true;
}
