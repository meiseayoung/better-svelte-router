<script lang="ts">
  import type { Component, Snippet } from 'svelte';
  import { untrack } from 'svelte';
  import {
    DEFAULT_KEEP_ALIVE_MAX,
    KeepAliveLRU,
    getComponentDisplayName,
    shouldKeepAliveCache,
    type KeepAliveMatchPattern,
  } from './keep-alive';
  import KeepAliveSlot from './keep-alive-slot';

  /**
   * Experimental Vue-style KeepAlive runtime (pair with `keepAlivePreprocess`).
   *
   * Modes:
   * - Snippet: `activeKey` + `children(key)` (preprocessor rewrites `{#if}` into this)
   * - Dynamic: `is`/`this` + optional `props` + optional `cacheKey`
   * - Passthrough: children without `activeKey` / `this` → render without caching
   *
   * Placement uses the outer `$$anchor` from `KeepAlive.ts` so every slot shares
   * one stable insert point — no wrapper element in the parent tree.
   */
  interface Props {
    /** Captured by `KeepAlive.ts` — shared park/restore anchor. */
    __bsrAnchor: Node;
    /** Active cache key (branch index / explicit key). `-1` / null = hide when caching. */
    activeKey?: string | number | null;
    /**
     * Explicit cache identity (Vue child vnode `key`). When set with `is`/`this`,
     * different values keep separate instances of the same component.
     * Named `cacheKey` (not `key`) to avoid clashing with Svelte's keyed blocks.
     */
    cacheKey?: string | number | null;
    /** Dynamic component (preferred; like Vue `<component :is>`). */
    is?: Component<any> | null;
    /** Alias of `is` (mirrors `<svelte:component this>`). */
    this?: Component<any> | null;
    /** Props forwarded to `is`/`this` when set. */
    props?: Record<string, unknown>;
    /** LRU cap. */
    max?: number;
    /** Only cache matches (name, cache key, RegExp, or component ref). */
    include?: KeepAliveMatchPattern | null;
    /** Never cache matches. */
    exclude?: KeepAliveMatchPattern | null;
    /** Snippet receiving the frozen branch key. */
    children?: Snippet<[string | number]>;
  }

  const {
    __bsrAnchor,
    activeKey = null,
    cacheKey: explicitKey = null,
    is: isComponent = null,
    this: thisComponent = null,
    props: componentProps = {},
    max = DEFAULT_KEEP_ALIVE_MAX,
    include = null,
    exclude = null,
    children,
  }: Props = $props();

  const dynamicComponent = $derived(isComponent ?? thisComponent);

  let lru = new KeepAliveLRU(DEFAULT_KEEP_ALIVE_MAX);
  let cacheKeys = $state<string[]>([]);
  /** Component captured at first visit for each dynamic-component cache key. */
  let storedComponents = $state<Record<string, Component<any>>>({});
  /**
   * Current view that should render but not join the durable LRU
   * (failed include / matched exclude).
   */
  let ephemeral = $state<{
    cacheKey: string;
    branchKey: string | number;
    component: Component<any> | null;
  } | null>(null);

  const componentIds = new WeakMap<object, number>();
  let nextComponentId = 1;

  function componentCacheKey(comp: object): string {
    let id = componentIds.get(comp);
    if (id == null) {
      id = nextComponentId++;
      componentIds.set(comp, id);
    }
    return `comp:${id}`;
  }

  /** True when caller gave caching inputs (preprocess output or manual API). */
  const cachingConfigured = $derived(
    dynamicComponent != null ||
      (activeKey !== null && activeKey !== undefined)
  );

  const resolvedKey = $derived.by((): string | null => {
    if (!cachingConfigured) return null;

    // Snippet / preprocess mode: identity is the branch index (`activeKey`).
    if (children && activeKey !== null && activeKey !== undefined) {
      if (activeKey === -1) return null;
      return String(activeKey);
    }

    // Dynamic component mode: explicit `cacheKey` (Vue vnode key) or component identity.
    if (dynamicComponent) {
      if (explicitKey !== null && explicitKey !== undefined) {
        return `key:${String(explicitKey)}`;
      }
      return componentCacheKey(dynamicComponent);
    }
    return null;
  });

  /** No cache config → plain render (preprocess miss / unsupported children). */
  const passthrough = $derived(Boolean(children) && !cachingConfigured);

  const branchKeyFor = (cacheKey: string): string | number => {
    if (cacheKey.startsWith('comp:') || cacheKey.startsWith('key:')) {
      return cacheKey;
    }
    const asNum = Number(cacheKey);
    return Number.isNaN(asNum) ? cacheKey : asNum;
  };

  $effect.pre(() => {
    const key = resolvedKey;
    const nextMax = max;
    const comp = dynamicComponent;
    const caching = cachingConfigured;
    const inc = include;
    const exc = exclude;
    const snippetMode = Boolean(children);

    untrack(() => {
      if (!caching) {
        ephemeral = null;
        return;
      }
      if (lru.max !== Math.max(1, nextMax)) {
        lru = new KeepAliveLRU(nextMax);
        for (const k of cacheKeys) {
          lru.touch(k, key ?? undefined);
        }
      }

      if (key == null) {
        ephemeral = null;
        return;
      }

      const name = getComponentDisplayName(comp);
      const cacheable = shouldKeepAliveCache(inc, exc, {
        name,
        component: snippetMode ? null : comp,
        cacheKey: key,
      });

      if (!cacheable) {
        // Drop from durable cache if it was previously included.
        if (lru.delete(key)) {
          const next = { ...storedComponents };
          delete next[key];
          storedComponents = next;
          cacheKeys = [...lru.keys];
        }
        ephemeral = {
          cacheKey: `ephemeral:${key}`,
          branchKey: branchKeyFor(key),
          component: snippetMode ? null : (comp ?? null),
        };
        return;
      }

      ephemeral = null;

      if (comp && !snippetMode && !storedComponents[key]) {
        storedComponents = { ...storedComponents, [key]: comp };
      }
      const evicted = lru.touch(key, key);
      if (evicted.length) {
        const next = { ...storedComponents };
        for (const e of evicted) delete next[e];
        storedComponents = next;
      }
      cacheKeys = [...lru.keys];
    });
  });
</script>

{#if passthrough}
  <!-- Rewrite missed or unsupported children: render without caching. -->
  {@render children?.(0)}
{:else}
  {#each cacheKeys as cacheKey (cacheKey)}
    <KeepAliveSlot
      active={ephemeral == null && resolvedKey === cacheKey}
      {cacheKey}
      placementAnchor={__bsrAnchor}
      {children}
      branchKey={branchKeyFor(cacheKey)}
      component={
        children
          ? null
          : (storedComponents[cacheKey] ??
              (resolvedKey === cacheKey ? dynamicComponent : null))
      }
      componentProps={children ? {} : componentProps}
    />
  {/each}
  {#if ephemeral}
    <KeepAliveSlot
      active={true}
      cacheKey={ephemeral.cacheKey}
      placementAnchor={__bsrAnchor}
      {children}
      branchKey={ephemeral.branchKey}
      component={children ? null : ephemeral.component}
      componentProps={children ? {} : componentProps}
    />
  {/if}
{/if}
