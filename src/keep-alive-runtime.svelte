<script lang="ts">
  import { getAllContexts, mount, unmount, onDestroy, untrack } from 'svelte';
  import type { Snippet } from 'svelte';
  import type { IRoute, LazyComponent } from './types';
  import type { ResolvedKeepAlive } from './keep-alive';
  import { ROUTE_ALIVE_CONTEXT } from './keep-alive';
  import RouteComponent from './route-component.svelte';

  /**
   * Parking keep-alive with reliable restore.
   *
   * Earlier bug: `if (!__bsrAnchor.parentNode) return` drops restore, so
   * parked nodes never return → dead UI. Fix: remember the outlet parent and
   * always put the mount host back where it was taken from.
   *
   * Move only a stable `host` (mount target). Never move Svelte-owned children
   * out from under `host` — that desyncs lazy updates / event bindings.
   *
   * Svelte #16695: `mount()` inside an `$effect` attaches the instance to the
   * parent effect tree; re-parenting that DOM then marks the tree inert
   * (reactivity / events die even after restore). Defer mount to a microtask
   * so the instance is its own effect root and can be parked/restored safely.
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

  const parentContext = getAllContexts();

  const aliveCtx = $state({ active: false });
  const routeProps = $state({} as {
    route: IRoute;
    fullPath: string;
    errorSnippet?: Snippet<[Error]>;
    loadingSnippet?: Snippet;
    isLazyComponent: Props['isLazyComponent'];
    getLazyComponentPromise: Props['getLazyComponentPromise'];
    keepAliveInherit: ResolvedKeepAlive | null;
  });

  /** Off-document lot for parked hosts. */
  const parking = document.createElement('div');
  /** Stable mount target; this is the only node we re-parent. */
  const host = document.createElement('div');
  host.style.width = '100%';
  host.style.height = '100%';
  parking.appendChild(host);

  let instance: Record<string, any> | null = null;
  /** True while a deferred mount microtask is queued. */
  let mounting = false;
  /** Parent we took the host from / must put it back into. */
  let outletParent: ParentNode | null = null;
  let destroyed = false;

  function resolveOutletParent(): ParentNode | null {
    const live = __bsrAnchor.parentNode;
    if (live) {
      outletParent = live;
      return live;
    }
    return outletParent;
  }

  /** Put host back exactly before the anchor in the remembered outlet. */
  function restoreToOutlet(): boolean {
    const parent = resolveOutletParent();
    if (!parent) return false;

    parking.dataset.bsrKeepAliveParking = cacheKey;
    host.dataset.bsrKeepAliveHost = cacheKey;
    host.dataset.bsrKeepAliveActive = '1';

    // Prefer: insertBefore(anchor) when anchor still lives under that parent.
    if (__bsrAnchor.parentNode === parent) {
      parent.insertBefore(host, __bsrAnchor);
    } else {
      // Anchor briefly detached — still return to the same parent.
      parent.appendChild(host);
    }
    return true;
  }

  function parkFromOutlet(): void {
    host.dataset.bsrKeepAliveActive = '0';
    // Capture parent at park time so restore has a source of truth.
    if (__bsrAnchor.parentNode) {
      outletParent = __bsrAnchor.parentNode;
    } else if (host.parentNode && host.parentNode !== parking) {
      outletParent = host.parentNode;
    }
    parking.appendChild(host);
  }

  function syncPlacement(isActive: boolean): void {
    if (isActive) {
      if (!restoreToOutlet()) {
        // Outlet not ready yet (reconcile) — retry once on next frame.
        requestAnimationFrame(() => {
          if (!destroyed && active) restoreToOutlet();
        });
      }
    } else {
      parkFromOutlet();
    }
  }

  function ensureMounted(): void {
    if (instance || mounting || destroyed) return;
    mounting = true;

    // Defer out of the current reaction so mount() is not a child of this
    // KeepAliveBoundary effect (Svelte #16695).
    queueMicrotask(() => {
      mounting = false;
      if (destroyed || instance) return;

      instance = mount(RouteComponent, {
        target: host,
        props: routeProps,
        context: new Map([...parentContext, [ROUTE_ALIVE_CONTEXT, aliveCtx]]),
      });
      untrack(() => syncPlacement(active));
    });
  }

  $effect.pre(() => {
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
    const isActive = active;
    untrack(() => {
      ensureMounted();
      if (instance) syncPlacement(isActive);
    });
  });

  onDestroy(() => {
    destroyed = true;
    parkFromOutlet();
    if (instance) {
      unmount(instance);
      instance = null;
    }
    outletParent = null;
  });
</script>
