<script lang="ts">
  import { onMount } from 'svelte';

  let count = $state(0);
  let mounts = $state(0);
  let note = $state('');

  onMount(() => {
    mounts += 1;
  });
</script>

<section>
  <h2>Fresh <span class="tag">keepAlive: false</span></h2>
  <p class="meta">
    onMount: <strong>{mounts}</strong> (should increase on every visit)
  </p>
  <div class="row">
    <button type="button" onclick={() => (count += 1)}>count = {count}</button>
  </div>
  <label>
    This input is also lost on leave
    <input bind:value={note} placeholder="Cleared after you leave and come back" />
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
    background: #3d2a2a;
    color: #f0a8a8;
  }

  .meta {
    margin: 0 0 1rem;
    color: #9aa7b5;
    font-size: 0.85rem;
  }

  .row {
    margin-bottom: 1rem;
  }

  button,
  input {
    font: inherit;
  }

  button {
    padding: 0.55rem 0.9rem;
    border-radius: 8px;
    border: 1px solid #2a3542;
    background: #1a222c;
    color: #e7ecf1;
    cursor: pointer;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    font-size: 0.9rem;
    color: #c5d0da;
  }

  input {
    padding: 0.6rem 0.75rem;
    border-radius: 8px;
    border: 1px solid #2a3542;
    background: #0f1419;
    color: #e7ecf1;
  }

  strong {
    color: #e7ecf1;
  }
</style>
