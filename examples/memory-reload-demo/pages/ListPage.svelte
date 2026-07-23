<script lang="ts">
  import { push } from 'better-svelte-router';
</script>

<section>
  <h2>List</h2>
  <p>Open a detail page to deepen the stack.</p>
  <div class="row">
    <button type="button" onclick={() => push('/detail/1')}>Detail #1</button>
    <button type="button" onclick={() => push('/detail/2')}>Detail #2</button>
  </div>
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

  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  button {
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
