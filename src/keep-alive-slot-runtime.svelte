<script lang="ts">
  import { getAllContexts, mount, unmount, onDestroy, untrack } from 'svelte';
  import type { Component, Snippet } from 'svelte';
  import { ROUTE_ALIVE_CONTEXT } from './keep-alive';
  import KeepAliveSlotView from './keep-alive-slot-view.svelte';

  /**
   * Parking keep-alive slot (same host park/restore strategy as route keep-alive).
   * Deferred mount avoids Svelte #16695 inert trees after re-parenting.
   *
   * When `placementAnchor` is set (experimental `<KeepAlive>`), all slots share
   * that stable insert point so no wrapper element is required in the parent.
   */
  interface Props {
    active: boolean;
    cacheKey: string;
    __bsrAnchor: Node;
    /**
     * Shared park/restore anchor from the parent KeepAlive boundary.
     * Falls back to this slot's own `$$anchor` when omitted.
     */
    placementAnchor?: Node | null;
    children?: Snippet<[string | number]>;
    branchKey?: string | number;
    component?: Component<any> | null;
    componentProps?: Record<string, unknown>;
  }

  const {
    active,
    cacheKey,
    __bsrAnchor,
    placementAnchor = null,
    children,
    branchKey = 0,
    component = null,
    componentProps = {},
  }: Props = $props();

  const parentContext = getAllContexts();
  const aliveCtx = $state({ active: false });

  const parking = document.createElement('div');
  /** Stable mount target; this is the only node we re-parent. */
  const host = document.createElement('div');
  host.style.width = '100%';
  host.style.height = '100%';
  parking.appendChild(host);

  let instance: Record<string, any> | null = null;
  let mounting = false;
  /** Parent we took the host from / must put it back into. */
  let outletParent: ParentNode | null = null;
  let destroyed = false;

  const slotProps = $state({
    children: undefined as Snippet<[string | number]> | undefined,
    branchKey: 0 as string | number,
    component: null as Component<any> | null,
    componentProps: {} as Record<string, unknown>,
  });

  function resolvePlacementAnchor(): Node {
    return placementAnchor ?? __bsrAnchor;
  }

  function resolveOutletParent(): ParentNode | null {
    const live = resolvePlacementAnchor().parentNode;
    if (live) {
      outletParent = live;
      return live;
    }
    return outletParent;
  }

  function restoreToOutlet(): boolean {
    const parent = resolveOutletParent();
    const anchor = resolvePlacementAnchor();
    if (!parent) return false;

    parking.dataset.bsrKeepAliveParking = cacheKey;
    host.dataset.bsrKeepAliveHost = cacheKey;
    host.dataset.bsrKeepAliveActive = '1';

    if (anchor.parentNode === parent) {
      parent.insertBefore(host, anchor);
    } else {
      parent.appendChild(host);
    }
    return true;
  }

  function parkFromOutlet(): void {
    host.dataset.bsrKeepAliveActive = '0';
    const anchor = resolvePlacementAnchor();
    if (anchor.parentNode) {
      outletParent = anchor.parentNode;
    } else if (host.parentNode && host.parentNode !== parking) {
      outletParent = host.parentNode;
    }
    parking.appendChild(host);
  }

  function syncPlacement(isActive: boolean): void {
    if (isActive) {
      if (!restoreToOutlet()) {
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

    queueMicrotask(() => {
      mounting = false;
      if (destroyed || instance) return;

      instance = mount(KeepAliveSlotView, {
        target: host,
        props: slotProps,
        context: new Map([...parentContext, [ROUTE_ALIVE_CONTEXT, aliveCtx]]),
      });
      untrack(() => syncPlacement(active));
    });
  }

  $effect.pre(() => {
    aliveCtx.active = active;
    // While active: refresh snippet/props so the live branch gets parent updates.
    // While parked: freeze slotProps so snippet closures do not re-run against
    // parent switch state (e.g. `tab`) and bleed into cached instances.
    const needsInitialBind =
      slotProps.children === undefined && slotProps.component === null;
    if (active || needsInitialBind) {
      slotProps.children = children;
      slotProps.branchKey = branchKey;
      slotProps.component = component;
      slotProps.componentProps = componentProps;
    }
  });

  $effect(() => {
    const isActive = active;
    // Re-run if the shared KeepAlive anchor becomes available / moves.
    void placementAnchor;
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
