<script lang="ts">
  import { mount, unmount, onDestroy, untrack } from 'svelte';
  import type { Snippet } from 'svelte';
  import type { IRoute, LazyComponent } from './types';
  import type { ResolvedKeepAlive } from './keep-alive';
  import { ROUTE_ALIVE_CONTEXT } from './keep-alive';
  import RouteComponent from './route-component.svelte';

  /**
   * Empty template (0 DOM). `mount`s RouteComponent into a detached parking
   * host, then moves those nodes before `__bsrAnchor` when active.
   */
  interface Props {
    active: boolean;
    cacheKey: string;
    __bsrAnchor: Node;
    route: IRoute;
    fullPath: string;
    errorSnippet?: Snippet<[Error]>;
    loadingSnippet?: Snippet;
    isLazyComponent: (component: unknown) => component is LazyComponent;
    getLazyComponentPromise: (lazy: LazyComponent) => Promise<{ default: any }>;
    keepAliveInherit?: ResolvedKeepAlive | null;
  }

  const {
    active,
    cacheKey,
    __bsrAnchor,
    route,
    fullPath,
    errorSnippet,
    loadingSnippet,
    isLazyComponent,
    getLazyComponentPromise,
    keepAliveInherit = null,
  }: Props = $props();

  const aliveCtx = $state({ active: false });
  // Filled in `$effect.pre` so we don't capture initial prop snapshots.
  const routeProps = $state({} as {
    route: IRoute;
    fullPath: string;
    errorSnippet?: Snippet<[Error]>;
    loadingSnippet?: Snippet;
    isLazyComponent: Props['isLazyComponent'];
    getLazyComponentPromise: Props['getLazyComponentPromise'];
    keepAliveInherit: ResolvedKeepAlive | null;
  });

  const parking = document.createElement('div');

  let instance: Record<string, any> | null = null;
  /** Top-level nodes owned by this instance (outlet or parking). */
  let owned: Node[] = [];

  function flushParkingToOutlet(): void {
    const parent = __bsrAnchor.parentNode;
    if (!parent) return;
    while (parking.firstChild) {
      const node = parking.firstChild;
      parent.insertBefore(node, __bsrAnchor);
      if (!owned.includes(node)) owned.push(node);
    }
  }

  function parkOwned(): void {
    for (const node of owned) parking.appendChild(node);
  }

  function syncPlacement(isActive: boolean): void {
    if (!__bsrAnchor.parentNode) return;
    if (isActive) flushParkingToOutlet();
    else parkOwned();
  }

  $effect.pre(() => {
    parking.dataset.bsrKeepAliveParking = cacheKey;
    routeProps.route = route;
    routeProps.fullPath = fullPath;
    routeProps.errorSnippet = errorSnippet;
    routeProps.loadingSnippet = loadingSnippet;
    routeProps.isLazyComponent = isLazyComponent;
    routeProps.getLazyComponentPromise = getLazyComponentPromise;
    routeProps.keepAliveInherit = keepAliveInherit;
    aliveCtx.active = active;
  });

  $effect(() => {
    if (!instance) {
      instance = mount(RouteComponent, {
        target: parking,
        props: routeProps,
        context: new Map([[ROUTE_ALIVE_CONTEXT, aliveCtx]]),
      });
      owned = Array.from(parking.childNodes);
    }

    const isActive = active;
    untrack(() => syncPlacement(isActive));
  });

  // Lazy/async renders may append into parking after the first sync.
  $effect(() => {
    if (!instance) return;
    const observer = new MutationObserver(() => {
      untrack(() => {
        if (active) flushParkingToOutlet();
        else {
          for (const node of Array.from(parking.childNodes)) {
            if (!owned.includes(node)) owned.push(node);
          }
        }
      });
    });
    observer.observe(parking, { childList: true });
    return () => observer.disconnect();
  });

  onDestroy(() => {
    parkOwned();
    if (instance) {
      unmount(instance);
      instance = null;
    }
    owned = [];
  });
</script>
