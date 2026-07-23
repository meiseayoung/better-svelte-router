<script lang="ts">
  import { routerState } from 'better-svelte-router';

  const id = $derived(routerState.pathname.split('/').pop() ?? '?');
</script>

<section>
  <h2>Detail #{id}</h2>
  <p>
    Use the panel controls: <strong>Reload + restore stack</strong> should keep
    <code>back()</code> working; <strong>Reload only</strong> drops the stack.
  </p>
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

  code,
  strong {
    color: #7dd3c0;
  }
</style>
