<script lang="ts">
  import { push } from 'better-svelte-router';
</script>

<section>
  <h2>Home</h2>
  <p>Start here, then push a few routes so the memory stack grows.</p>
  <button type="button" onclick={() => push('/list')}>Go to List</button>
</section>

<style>
  section {
    display: grid;
    gap: 0.75rem;
  }

  h2 {
    margin: 0;
    font-size: 1.2rem;
  }

  p {
    margin: 0;
    color: #9aa7b5;
    line-height: 1.45;
  }

  button {
    justify-self: start;
    border: 0;
    border-radius: 8px;
    padding: 0.55rem 0.9rem;
    background: #2a6f6a;
    color: #e7fffb;
    font: inherit;
    cursor: pointer;
  }

  button:hover {
    background: #348781;
  }
</style>
