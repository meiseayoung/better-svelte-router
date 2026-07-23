<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    onMountCount?: (n: number) => void;
  }

  let { onMountCount }: Props = $props();

  let count = $state(0);
  let mounts = 0;

  onMount(() => {
    mounts += 1;
    onMountCount?.(mounts);
  });
</script>

<div data-testid="counter-root">
  <span data-testid="label">B</span>
  <span data-testid="count">{count}</span>
  <button type="button" data-testid="inc" onclick={() => (count += 1)}>+1</button>
</div>
