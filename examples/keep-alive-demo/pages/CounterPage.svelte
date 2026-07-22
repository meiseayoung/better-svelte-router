<script lang="ts">
  import { whileRouteActive } from 'better-svelte-router';
  import { onMount } from 'svelte';

  let count = $state(0);
  let mounts = $state(0);
  let ticks = $state(0);

  onMount(() => {
    mounts += 1;
  });

  whileRouteActive(() => {
    const id = setInterval(() => {
      ticks += 1;
    }, 1000);
    return () => clearInterval(id);
  });
</script>

<section>
  <h2>Counter <span class="tag">deep inherit</span></h2>
  <p class="meta">
    onMount: <strong>{mounts}</strong>
    · foreground seconds: <strong>{ticks}</strong> (should pause when inactive)
  </p>
  <div class="row">
    <button type="button" onclick={() => (count -= 1)}>−</button>
    <span class="count">{count}</span>
    <button type="button" onclick={() => (count += 1)}>+</button>
  </div>
  <p class="tip">Bump the number, leave this tab, then return — count and mounts should both persist.</p>
</section>

<style>
  h2 {
    margin: 0 0 0.5rem;
    font-size: 1.15rem;
  }

  .tag {
    font-size: 0.7rem;
    vertical-align: middle;
    margin-left: 0.35rem;
    padding: 0.15rem 0.4rem;
    border-radius: 999px;
    background: #1e3d36;
    color: #7dd3c0;
  }

  .meta {
    margin: 0 0 1rem;
    color: #9aa7b5;
    font-size: 0.85rem;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  button {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 8px;
    border: 1px solid #2a3542;
    background: #1a222c;
    color: #e7ecf1;
    font-size: 1.25rem;
    cursor: pointer;
  }

  button:hover {
    border-color: #4f7cac;
  }

  .count {
    font-size: 2rem;
    font-variant-numeric: tabular-nums;
    min-width: 3ch;
    text-align: center;
  }

  .tip {
    margin: 1rem 0 0;
    color: #8b98a8;
    font-size: 0.85rem;
  }

  strong {
    color: #e7ecf1;
  }
</style>
