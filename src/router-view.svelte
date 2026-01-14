<script lang="ts">
  import { untrack, type Snippet } from 'svelte';
  import type { IRoute, IRouterViewProps, LazyComponent, RoutePath } from './types';
  import { routerState } from './router-state.svelte';
  import { findMatchingRoutes, normalizePath } from './matcher';
  import { replace } from './navigation';
  import RouterView from './router-view.svelte';

  /**
   * RouterView component - renders the matched route component based on current URL.
   * Uses Svelte 5 runes for reactive state management.
   */
  interface Props extends IRouterViewProps {
    /** Custom error snippet for handling component load failures */
    error?: Snippet<[Error]>;
    /** Custom loading snippet shown while lazy components load */
    loading?: Snippet;
  }

  const { routes, prefix = '', error: errorSnippet, loading: loadingSnippet }: Props = $props();

  /** Regex to detect lazy import functions */
  const hasImportReg = /import\s*\(/;

  /** Cache for lazy component promises to prevent re-fetching */
  const lazyComponentCache = new Map<LazyComponent, Promise<{ default: any }>>();

  /**
   * Checks if a component is a lazy-loaded component.
   * @param component - The component to check
   * @returns True if the component is a lazy import function
   */
  function isLazyComponent(component: unknown): component is LazyComponent {
    if (typeof component !== 'function') return false;
    const componentString = component.toString();
    return hasImportReg.test(componentString);
  }

  /**
   * Gets or creates a cached promise for lazy component loading.
   * Prevents re-fetching the same component on re-renders.
   */
  function getLazyComponentPromise(lazyComponent: LazyComponent): Promise<{ default: any }> {
    if (!lazyComponentCache.has(lazyComponent)) {
      lazyComponentCache.set(lazyComponent, lazyComponent());
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
      if (currentMatch.path === normalizePath(currentPathname)) {
        const redirectTarget = currentMatch.route.redirect;
        untrack(() => {
          replace(redirectTarget as RoutePath, {});
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
</script>

<!--
  RouterView Template
  Renders matched routes with support for:
  - Lazy-loaded components with error handling
  - Nested routes via recursive self-import
  - Custom error and loading snippets
-->
{#each routes as route (route.path)}
  {@const fullPath = buildFullPath(route)}
  {#if routeMatches(route)}
    {@const currentPathname = getCurrentPathname()}
    {@const isExactMatch = normalizePath(currentPathname) === fullPath}
    {#if route.redirect && isExactMatch}
      <!-- Redirect is handled by $effect above, only when exact match -->
    {:else if route.redirect && !isExactMatch && Array.isArray(route.children)}
      <!-- Route has redirect but we're on a child route, render children -->
      <RouterView routes={route.children} prefix={fullPath} error={errorSnippet} loading={loadingSnippet} />
    {:else if route.component}
      {#if isLazyComponent(route.component)}
        <!-- Lazy-loaded component with cached promise -->
        {@const importPromise = getLazyComponentPromise(route.component)}
        {#await importPromise}
          <!-- Loading state -->
          {#if loadingSnippet}
            {@render loadingSnippet()}
          {/if}
        {:then module}
          <!-- Dynamic component rendering in Svelte 5 -->
          {@const DynamicComponent = module.default}
          <DynamicComponent>
            {#if Array.isArray(route.children)}
              <RouterView routes={route.children} prefix={fullPath} error={errorSnippet} loading={loadingSnippet} />
            {/if}
          </DynamicComponent>
        {:catch err}
          <!-- Error state with customizable snippet -->
          {#if errorSnippet}
            {@render errorSnippet(err)}
          {:else}
            <div class="router-error">
              <p>Failed to load component</p>
              <pre>{err?.message ?? 'Unknown error'}</pre>
            </div>
          {/if}
        {/await}
      {:else}
        <!-- Synchronous Svelte component - dynamic by default in Svelte 5 -->
        {@const StaticComponent = route.component}
        <StaticComponent>
          {#if Array.isArray(route.children)}
            <RouterView routes={route.children} prefix={fullPath} error={errorSnippet} loading={loadingSnippet} />
          {/if}
        </StaticComponent>
      {/if}
    {:else if Array.isArray(route.children)}
      <!-- Route without component but with children (layout route) -->
      <RouterView routes={route.children} prefix={fullPath} error={errorSnippet} loading={loadingSnippet} />
    {/if}
  {/if}
{/each}
