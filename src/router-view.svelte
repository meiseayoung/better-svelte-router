<script lang="ts">
  import { onMount, untrack, type Snippet } from 'svelte';
  import type { IRoute, IRouterViewProps, LazyComponent, RoutePath } from './types';
  import { routerState } from './router-state.svelte';
  import { findMatchingRoutes, normalizePath, getRegexp, extractParams } from './matcher';
  import { replace } from './navigation';
  import {
    KeepAliveLRU,
    buildKeepAliveCacheKey,
    resolveKeepAlive,
    childKeepAliveInherit,
    type ResolvedKeepAlive,
  } from './keep-alive';
  import KeepAliveBoundary from './keep-alive-boundary';
  import RouteComponent from './route-component.svelte';
  import RouterView from './router-view.svelte';
  import { isLazyHeadCheckEnabled } from './router-mode';
  import {
    loadLazyComponent,
    registerLazyRetryHandler,
  } from './lazy-module-cache';

  /**
   * RouterView component - renders the matched route component based on current URL.
   * Uses Svelte 5 runes for reactive state management.
   * Routes with `meta.keepAlive` stay mounted and toggle visibility instead of destroying.
   */
  interface Props extends IRouterViewProps {
    /** Custom error snippet for handling component load failures */
    error?: Snippet<[Error]>;
    /** Custom loading snippet shown while lazy components load */
    loading?: Snippet;
    /**
     * Inherited keep-alive from an ancestor with `deep: true`.
     * Internal — set by nested RouterView rendering, not app code.
     */
    keepAliveInherit?: ResolvedKeepAlive | null;
  }

  const {
    routes,
    prefix = '',
    error: errorSnippet,
    loading: loadingSnippet,
    keepAliveInherit = null,
  }: Props = $props();

  /** Bumped on retry so `{#await}` leaves the catch branch and re-probes. */
  let loadGeneration = $state(0);

  // Fallback trigger for the initial guard pass. The router state no longer
  // auto-starts on construction (that raced with `createRouterMode` under async
  // module loading). Apps that call `createRouterMode` start via that call; apps
  // that rely on the default history mode without calling it start here, once a
  // RouterView is mounted. `start()` is idempotent, so this is a no-op if the
  // initial guards already ran.
  // Also register retryLazyLoad / LazyChunkError.retry handlers for this view.
  onMount(() => {
    routerState.start();
    return registerLazyRetryHandler(() => {
      lazyComponentCache.clear();
      loadGeneration++;
    });
  });

  /** Regex to detect lazy import functions (fast path) */
  const hasImportReg = /import\s*\(/;

  /** Cache for lazy component promises to prevent re-fetching */
  const lazyComponentCache = new Map<LazyComponent, Promise<{ default: any }>>();

  /** Per-route keep-alive LRU stores, keyed by the route's full pattern path. */
  const keepAliveCaches = new Map<string, KeepAliveLRU>();

  /**
   * Checks if a component is a lazy-loaded component.
   *
   * Detection strategy:
   * 1. Fast path: the function source still contains a dynamic `import(...)` call.
   * 2. Robust fallback: arity. Svelte 5 components and snippets are always invoked
   *    with at least one argument (`$$anchor`), so their compiled functions declare
   *    arity >= 1. A lazy route loader is conventionally `() => import('...')`, a
   *    zero-arg function. Relying on arity survives bundlers (Vite/webpack/rollup)
   *    that rewrite `import(...)` into helpers such as `__vite_ssr_dynamic_import__`,
   *    which would otherwise defeat the source-string check and cause the component
   *    to silently render nothing.
   *
   * @param component - The component to check
   * @returns True if the component is a lazy import function
   */
  function isLazyComponent(component: unknown): component is LazyComponent {
    if (typeof component !== 'function') return false;
    if (hasImportReg.test(component.toString())) return true;
    return component.length === 0;
  }

  function retryLazyComponent(lazyComponent: LazyComponent): void {
    lazyComponentCache.delete(lazyComponent);
    loadGeneration++;
  }

  /**
   * Gets or creates a cached promise for lazy component loading.
   * Prevents re-fetching the same component on re-renders.
   * Rejected promises are not kept: WKWebView / the module map may stick a
   * failed response to the chunk URL; clearing lets a later attempt run again
   * (and records the URL so `reload()` can revalidate before hard navigation).
   *
   * When `lazyHeadCheck` is enabled, HEAD-probes the chunk URL first so a
   * missing file never calls `import()` (avoids sticky 404s in WKWebView).
   */
  function getLazyComponentPromise(lazyComponent: LazyComponent): Promise<{ default: any }> {
    // Depend on loadGeneration so retries invalidate `{#await}`.
    void loadGeneration;

    if (!lazyComponentCache.has(lazyComponent)) {
      const retry = () => retryLazyComponent(lazyComponent);
      const promise = loadLazyComponent(lazyComponent, {
        headCheck: isLazyHeadCheckEnabled(),
        retry,
      }).catch((err) => {
        lazyComponentCache.delete(lazyComponent);
        throw err;
      });

      lazyComponentCache.set(lazyComponent, promise);
    }
    return lazyComponentCache.get(lazyComponent)!;
  }

  /**
   * Gets the current pathname from router state.
   * The base path is already handled by the router mode adapter.
   */
  function getCurrentPathname(): string {
    return routerState.pathname || '/';
  }

  /**
   * Computed matched routes using $derived.
   * Automatically updates when routerState.pathname changes.
   */
  const matchedRoutes = $derived.by(() => {
    const pathname = getCurrentPathname();
    return findMatchingRoutes(routes, pathname, prefix);
  });

  /**
   * Get the current matched route (first match in hierarchy).
   */
  const currentMatch = $derived(matchedRoutes[0] ?? null);

  /**
   * Get the deepest matched route (for meta information).
   */
  const deepestMatch = $derived(matchedRoutes[matchedRoutes.length - 1] ?? null);

  /**
   * Effect to handle route redirects.
   * Only redirects if the current path exactly matches the redirect source.
   * Uses untrack to prevent infinite loops when calling replace.
   */
  $effect(() => {
    if (currentMatch?.route.redirect) {
      const currentPathname = getCurrentPathname();
      // Only redirect if we're exactly on the route with redirect, not on a child route
      if (getRegexp(currentMatch.path).test(normalizePath(currentPathname))) {
        const redirectTarget = currentMatch.route.redirect;
        // Replace :param placeholders in the redirect target with actual values
        const params = extractParams(currentMatch.path, normalizePath(currentPathname));
        let resolvedRedirect = redirectTarget;
        for (const [key, value] of Object.entries(params)) {
          resolvedRedirect = resolvedRedirect.replace(`:${key}`, value);
        }
        untrack(() => {
          replace(resolvedRedirect as RoutePath, {});
        });
      }
    }
  });

  /**
   * Effect to update route meta information.
   * Uses the deepest matched route's meta for most specific information.
   */
  $effect(() => {
    if (deepestMatch?.route.meta) {
      const meta = deepestMatch.route.meta;
      untrack(() => {
        routerState.meta = meta;
      });
    } else if (deepestMatch) {
      // Clear meta if route has no meta defined
      untrack(() => {
        routerState.meta = {};
      });
    }
  });

  /**
   * Builds the full path for a route considering the prefix.
   * @param route - The route configuration
   * @returns The normalized full path
   */
  function buildFullPath(route: IRoute): string {
    return normalizePath(prefix === '/' ? `/${route.path}` : `${prefix}/${route.path}`);
  }

  /**
   * Checks if a route matches the current pathname.
   * @param route - The route to check
   * @returns True if the route matches
   */
  function routeMatches(route: IRoute): boolean {
    const fullPath = buildFullPath(route);
    // Check if this route is in the matched routes
    return matchedRoutes.some((match) => match.path === fullPath);
  }

  function getOrCreateCache(routePath: string, max: number): KeepAliveLRU {
    let cache = keepAliveCaches.get(routePath);
    if (!cache || cache.max !== max) {
      cache = new KeepAliveLRU(max);
      keepAliveCaches.set(routePath, cache);
    }
    return cache;
  }

  /**
   * Cache keys for a keep-alive route. Touches the active key during render
   * so navigation updates the LRU without a separate effect.
   */
  function keepAliveKeys(route: IRoute, fullPath: string): string[] {
    const config = resolveKeepAlive(route, keepAliveInherit);
    if (!config) return [];

    const cache = getOrCreateCache(fullPath, config.max);
    if (routeMatches(route)) {
      const pathname = normalizePath(getCurrentPathname());
      const key = buildKeepAliveCacheKey(config.key, fullPath, pathname);
      cache.touch(key, key);
    }
    return [...cache.keys];
  }

  function isKeepAliveActive(route: IRoute, fullPath: string, cacheKey: string): boolean {
    if (!routeMatches(route)) return false;
    const config = resolveKeepAlive(route, keepAliveInherit);
    if (!config) return false;
    const pathname = normalizePath(getCurrentPathname());
    return buildKeepAliveCacheKey(config.key, fullPath, pathname) === cacheKey;
  }
</script>

<!--
  RouterView Template
  Renders matched routes with support for:
  - Lazy-loaded components with error handling
  - Nested routes via recursive self-import
  - Custom error and loading snippets
  - Optional mount-based keep-alive via meta.keepAlive
-->
{#each routes as route, i (`${i}:${route.path}`)}
  {@const fullPath = buildFullPath(route)}
  {@const matched = routeMatches(route)}
  {@const keepAlive = resolveKeepAlive(route, keepAliveInherit)}
  {@const nestedInherit = childKeepAliveInherit(keepAlive)}
  {@const currentPathname = getCurrentPathname()}
  {@const isExactMatch = getRegexp(fullPath).test(normalizePath(currentPathname))}

  {#if keepAlive}
    {#each keepAliveKeys(route, fullPath) as cacheKey (cacheKey)}
      {@const active = isKeepAliveActive(route, fullPath, cacheKey)}
      {#if route.redirect && isExactMatch && active}
        <!-- Redirect handled by $effect -->
      {:else if route.redirect && !isExactMatch && Array.isArray(route.children)}
        <RouterView
          routes={route.children}
          prefix={fullPath}
          error={errorSnippet}
          loading={loadingSnippet}
          keepAliveInherit={nestedInherit}
        />
      {:else}
        <KeepAliveBoundary
          {active}
          {cacheKey}
          {route}
          {fullPath}
          {errorSnippet}
          {loadingSnippet}
          {isLazyComponent}
          {getLazyComponentPromise}
          keepAliveInherit={nestedInherit}
        />
      {/if}
    {/each}
  {:else if matched}
    {#if route.redirect && isExactMatch}
      <!-- Redirect is handled by $effect above, only when exact match -->
    {:else if route.redirect && !isExactMatch && Array.isArray(route.children)}
      <!-- Route has redirect but we're on a child route, render children -->
      <RouterView
        routes={route.children}
        prefix={fullPath}
        error={errorSnippet}
        loading={loadingSnippet}
        keepAliveInherit={nestedInherit}
      />
    {:else}
      <RouteComponent
        {route}
        {fullPath}
        {errorSnippet}
        {loadingSnippet}
        {isLazyComponent}
        {getLazyComponentPromise}
        keepAliveInherit={nestedInherit}
      />
    {/if}
  {/if}
{/each}
