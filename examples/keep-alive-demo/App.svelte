<script lang="ts">
  import { RouterView, createRouterMode, routerState } from 'better-svelte-router';
  import { routes } from './routes';

  createRouterMode({ mode: 'hash' });

  $effect(() => {
    const title = routerState.meta.title;
    document.title = title ? `${title} · keep-alive demo` : 'keep-alive demo';
  });
</script>

<div class="app">
  <header>
    <h1>keep-alive demo</h1>
    <p>
      Layout uses <code>meta.keepAlive: {'{ deep: true }'}</code> so
      <code>Draft</code> / <code>Counter</code> inherit caching.
      <code>Fresh</code> sets <code>keepAlive: false</code> to opt out and remount.
    </p>
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
    margin: 0 0 1.25rem;
    color: #9aa7b5;
    line-height: 1.45;
    font-size: 0.95rem;
  }

  header code {
    font-size: 0.85em;
    color: #7dd3c0;
  }
</style>
