<script lang="ts">
  import { RouterView, createRouterMode, routerState } from 'better-svelte-router';
  import { routes } from './routes';
  import { loadStackSnapshot } from './stack-storage';

  const snapshot = loadStackSnapshot();

  createRouterMode({
    mode: 'memory',
    syncHash: true,
    initialEntries: snapshot?.entries,
    initialIndex: snapshot?.index,
  });

  const restored = !!snapshot;

  $effect(() => {
    const title = routerState.meta.title;
    document.title = title ? `${title} · memory reload demo` : 'memory reload demo';
  });
</script>

<div class="app">
  <header>
    <h1>memory reload demo</h1>
    <p>
      Memory mode keeps the stack in JS only. Use
      <code>initialEntries</code> / <code>getEntries()</code> yourself if you need
      back/forward after a hard reload.
    </p>
    {#if restored}
      <p class="banner">Restored stack from <code>sessionStorage</code> via <code>initialEntries</code>.</p>
    {/if}
  </header>
  <RouterView {routes} />
</div>

<style>
  :global(body) {
    margin: 0;
    font-family: 'Segoe UI', system-ui, sans-serif;
    background: #0f1419;
    color: #e7ecf1;
  }

  :global(*),
  :global(*::before),
  :global(*::after) {
    box-sizing: border-box;
  }

  .app {
    max-width: 720px;
    margin: 0 auto;
    padding: 1.5rem;
  }

  header h1 {
    margin: 0 0 0.35rem;
    font-size: 1.5rem;
    font-weight: 650;
  }

  header p {
    margin: 0 0 0.75rem;
    color: #9aa7b5;
    line-height: 1.45;
    font-size: 0.95rem;
  }

  header code {
    font-size: 0.85em;
    color: #7dd3c0;
  }

  .banner {
    margin: 0 0 1.25rem !important;
    padding: 0.55rem 0.75rem;
    border-radius: 8px;
    background: #1d3a38;
    color: #9ff0e4 !important;
  }
</style>
