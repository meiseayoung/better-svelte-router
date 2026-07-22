<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { IRoute, LazyComponent } from './types';
  import type { ResolvedKeepAlive } from './keep-alive';
  import RouterView from './router-view.svelte';

  /**
   * Renders a single route's component (sync or lazy) and nested RouterView.
   * Shared by the default destroy-on-leave path and keep-alive caches.
   */
  interface Props {
    route: IRoute;
    fullPath: string;
    errorSnippet?: Snippet<[Error]>;
    loadingSnippet?: Snippet;
    isLazyComponent: (component: unknown) => component is LazyComponent;
    getLazyComponentPromise: (lazy: LazyComponent) => Promise<{ default: any }>;
    /** Passed to nested RouterViews when this route has `keepAlive.deep`. */
    keepAliveInherit?: ResolvedKeepAlive | null;
  }

  const {
    route,
    fullPath,
    errorSnippet,
    loadingSnippet,
    isLazyComponent,
    getLazyComponentPromise,
    keepAliveInherit = null,
  }: Props = $props();
</script>

{#if route.component}
  {#if isLazyComponent(route.component)}
    {@const importPromise = getLazyComponentPromise(route.component)}
    {#await importPromise}
      {#if loadingSnippet}
        {@render loadingSnippet()}
      {/if}
    {:then module}
      {@const DynamicComponent = module.default}
      <DynamicComponent>
        {#if Array.isArray(route.children)}
          <RouterView
            routes={route.children}
            prefix={fullPath}
            error={errorSnippet}
            loading={loadingSnippet}
            {keepAliveInherit}
          />
        {/if}
      </DynamicComponent>
    {:catch err}
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
    {@const StaticComponent = route.component}
    <StaticComponent>
      {#if Array.isArray(route.children)}
        <RouterView
          routes={route.children}
          prefix={fullPath}
          error={errorSnippet}
          loading={loadingSnippet}
          {keepAliveInherit}
        />
      {/if}
    </StaticComponent>
  {/if}
{:else if Array.isArray(route.children)}
  <RouterView
    routes={route.children}
    prefix={fullPath}
    error={errorSnippet}
    loading={loadingSnippet}
    {keepAliveInherit}
  />
{/if}
