<script lang="ts">
  import { getRouteAlive, isRouteActive } from 'better-svelte-router';
  import { onMount } from 'svelte';

  let text = $state('Type here, switch tabs, then come back');
  let mounts = $state(0);
  const alive = getRouteAlive();

  onMount(() => {
    mounts += 1;
  });

  $effect(() => {
    if (!isRouteActive()) return;
    console.log('[Draft] activated, mounts=', mounts);
  });
</script>

<section>
  <h2>Draft <span class="tag">deep inherit</span></h2>
  <p class="meta">
    onMount count: <strong>{mounts}</strong>
    · active: <strong>{alive?.active ?? true}</strong>
  </p>
  <label>
    Local draft (state stays in the component)
    <textarea rows="5" bind:value={text}></textarea>
  </label>
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

  label {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    font-size: 0.9rem;
    color: #c5d0da;
  }

  textarea {
    width: 100%;
    resize: vertical;
    padding: 0.75rem;
    border-radius: 8px;
    border: 1px solid #2a3542;
    background: #0f1419;
    color: #e7ecf1;
    font: inherit;
    line-height: 1.4;
  }

  textarea:focus {
    outline: 2px solid #4f7cac;
    outline-offset: 1px;
  }

  strong {
    color: #e7ecf1;
  }
</style>
