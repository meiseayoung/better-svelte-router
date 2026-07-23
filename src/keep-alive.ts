import { getContext } from 'svelte';
import type { Component } from 'svelte';
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
 * Vue-like include/exclude pattern: component name, cache key, RegExp, or
 * component constructor reference (or an array of those).
 */
export type KeepAliveMatchPattern =
  | string
  | RegExp
  | Component<any>
  | ReadonlyArray<string | RegExp | Component<any>>;

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
 * Whether `pattern` matches the given component name, cache key, and/or component ref.
 */
export function matchesKeepAlivePattern(
  pattern: KeepAliveMatchPattern | undefined | null,
  opts: {
    name?: string;
    component?: Component<any> | null;
    cacheKey?: string;
  }
): boolean {
  if (pattern == null) return false;
  const list = Array.isArray(pattern) ? pattern : [pattern];
  return list.some((p) => {
    if (typeof p === 'string') {
      return p === opts.name || p === opts.cacheKey;
    }
    if (p instanceof RegExp) {
      return (
        (opts.name != null && p.test(opts.name)) ||
        (opts.cacheKey != null && p.test(opts.cacheKey))
      );
    }
    return opts.component != null && p === opts.component;
  });
}

/**
 * Vue KeepAlive include/exclude rules:
 * - `exclude` match → do not cache
 * - `include` set and no match → do not cache
 * - otherwise → cache
 */
export function shouldKeepAliveCache(
  include: KeepAliveMatchPattern | undefined | null,
  exclude: KeepAliveMatchPattern | undefined | null,
  opts: {
    name?: string;
    component?: Component<any> | null;
    cacheKey?: string;
  }
): boolean {
  if (exclude != null && matchesKeepAlivePattern(exclude, opts)) return false;
  if (include != null && !matchesKeepAlivePattern(include, opts)) return false;
  return true;
}

/**
 * Best-effort display name for a component (Svelte compile often sets `name`).
 */
export function getComponentDisplayName(
  component: Component<any> | null | undefined
): string | undefined {
  if (!component) return undefined;
  const anyComp = component as { name?: string; displayName?: string };
  return anyComp.name || anyComp.displayName || undefined;
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

  /** Remove a key without touching recency of others. */
  delete(key: string): boolean {
    const before = this.#keys.length;
    this.#keys = this.#keys.filter((k) => k !== key);
    return this.#keys.length !== before;
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
