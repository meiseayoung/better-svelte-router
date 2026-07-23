<script lang="ts">
  import { onMount } from 'svelte';
  import { onActivated, onDeactivated } from '../../src/on-keep-alive.svelte';

  interface Props {
    onMountCount?: (n: number) => void;
    onActivatedCount?: (n: number) => void;
    onDeactivatedCount?: (n: number) => void;
  }

  let { onMountCount, onActivatedCount, onDeactivatedCount }: Props = $props();

  let count = $state(0);
  let mounts = 0;
  let activates = 0;
  let deactivates = 0;

  onMount(() => {
    mounts += 1;
    onMountCount?.(mounts);
  });

  onActivated(() => {
    activates += 1;
    onActivatedCount?.(activates);
  });

  onDeactivated(() => {
    deactivates += 1;
    onDeactivatedCount?.(deactivates);
  });
</script>

<div data-testid="counter-root">
  <span data-testid="label">A</span>
  <span data-testid="count">{count}</span>
  <button type="button" data-testid="inc" onclick={() => (count += 1)}>+1</button>
</div>
