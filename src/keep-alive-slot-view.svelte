<script lang="ts">
  import type { Component, Snippet } from 'svelte';

  /**
   * Mount target for one KeepAlive cache entry.
   * Either renders a snippet with a frozen branch key, or a dynamic component.
   */
  interface Props {
    children?: Snippet<[string | number]>;
    branchKey?: string | number;
    component?: Component<any> | null;
    componentProps?: Record<string, unknown>;
  }

  const {
    children,
    branchKey = 0,
    component = null,
    componentProps = {},
  }: Props = $props();
</script>

{#if children}
  {@render children(branchKey)}
{:else if component}
  {@const Comp = component}
  <Comp {...componentProps} />
{/if}
