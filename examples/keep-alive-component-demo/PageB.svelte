<script lang="ts">
  let text = $state('');
</script>

<div class="page">
  <h2>Page B</h2>
  <label>
    Draft (should survive tab switches when cached)
    <input bind:value={text} placeholder="type something…" />
  </label>
  <p class="hint">Value: {text || '(empty)'}</p>
</div>

<style>
  .page {
    padding: 1rem;
    border: 1px solid #2a3540;
    border-radius: 8px;
    background: #151b22;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-size: 0.9rem;
  }
  input {
    padding: 0.4rem 0.5rem;
    border-radius: 4px;
    border: 1px solid #3a4654;
    background: #0f1419;
    color: inherit;
  }
  .hint {
    margin: 0.75rem 0 0;
    color: #9aa7b5;
    font-size: 0.85rem;
  }
</style>
