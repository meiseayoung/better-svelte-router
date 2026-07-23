<script lang="ts">
  import { onMount } from 'svelte';

  let mounts = $state(0);
  onMount(() => {
    mounts += 1;
  });
</script>

<div class="page">
  <h2>Page C</h2>
  <p>
    <code>onMount</code> count for this instance: <strong>{mounts}</strong>
    (stays 1 if kept alive).
  </p>
</div>

<style>
  .page {
    padding: 1rem;
    border: 1px solid #2a3540;
    border-radius: 8px;
    background: #151b22;
  }
  code {
    color: #7dd3c0;
  }
</style>
