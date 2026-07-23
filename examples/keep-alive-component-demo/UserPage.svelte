<script lang="ts">
  interface Props {
    id: string;
  }

  let { id }: Props = $props();
  let count = $state(0);
</script>

<div class="page">
  <h2>User #{id}</h2>
  <p>
    Same component, separate cache entries via <code>cacheKey</code>. Counter for
    this id: <strong>{count}</strong>
  </p>
  <button type="button" onclick={() => (count += 1)}>+1</button>
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
    font-size: 0.85em;
  }
  button {
    margin-top: 0.5rem;
    padding: 0.4rem 0.75rem;
    cursor: pointer;
  }
</style>
