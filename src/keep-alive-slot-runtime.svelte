<script lang="ts">
  import { getAllContexts, mount, unmount, onDestroy, untrack } from 'svelte';
  import type { Component, Snippet } from 'svelte';
  import { ROUTE_ALIVE_CONTEXT } from './keep-alive';
  import KeepAliveSlotView from './keep-alive-slot-view.svelte';

  /**
   * Parking keep-alive slot (same host park/restore strategy as route keep-alive).
   * Deferred mount avoids Svelte #16695 inert trees after re-parenting.
   */
  interface Props {
    active: boolean;
    cacheKey: string;
    __bsrAnchor: Node;
    /** Stable DOM parent for park/restore (preferred over anchor.parentNode). */
    outlet?: HTMLElement | null;
    children?: Snippet<[string | number]>;
    branchKey?: string | number;
    component?: Component<any> | null;
    componentProps?: Record<string, unknown>;
  }

  const {
    active,
    cacheKey,
    __bsrAnchor,
    outlet = null,
    children,
    branchKey = 0,
    component = null,
    componentProps = {},
  }: Props = $props();

  const parentContext = getAllContexts();
  const aliveCtx = $state({ active: false });

  const parking = document.createElement('div');
  const host = document.createElement('div');
  host.style.width = '100%';
  host.style.height = '100%';
  parking.appendChild(host);

  let instance: Record<string, any> | null = null;
  let mounting = false;
  let outletParent: ParentNode | null = null;
  let destroyed = false;

  const slotProps = $state({
    children: undefined as Snippet<[string | number]> | undefined,
    branchKey: 0 as string | number,
    component: null as Component<any> | null,
    componentProps: {} as Record<string, unknown>,
  });

  function resolveOutletParent(): ParentNode | null {
    if (outlet) {
      outletParent = outlet;
      return outlet;
    }
    const live = __bsrAnchor.parentNode;
    if (live) {
      outletParent = live;
      return live;
    }
    return outletParent;
  }

  function restoreToOutlet(): boolean {
    const parent = resolveOutletParent();
    if (!parent) return false;

    parking.dataset.bsrKeepAliveParking = cacheKey;
    host.dataset.bsrKeepAliveHost = cacheKey;
    host.dataset.bsrKeepAliveActive = '1';

    if (__bsrAnchor.parentNode === parent) {
      parent.insertBefore(host, __bsrAnchor);
    } else {
      parent.appendChild(host);
    }
    return true;
  }

  function parkFromOutlet(): void {
    host.dataset.bsrKeepAliveActive = '0';
    if (outlet) {
      outletParent = outlet;
    } else if (__bsrAnchor.parentNode) {
      outletParent = __bsrAnchor.parentNode;
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
    // Re-run when `outlet` binds after first paint so restore can succeed.
    void outlet;
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
