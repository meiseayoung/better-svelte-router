<script lang="ts">
  let count = $state(0);
  let label = $state('Page A');
</script>

<div class="page">
  <h2>{label}</h2>
  <p>Local counter (should survive tab switches when cached): <strong>{count}</strong></p>
  <button type="button" onclick={() => (count += 1)}>+1</button>
</div>

<style>
  .page {
    padding: 1rem;
    border: 1px solid #2a3540;
    border-radius: 8px;
    background: #151b22;
  }
  button {
    margin-top: 0.5rem;
    padding: 0.4rem 0.75rem;
    cursor: pointer;
  }
</style>
