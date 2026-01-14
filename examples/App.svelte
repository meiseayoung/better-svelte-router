<!--
  Root Component Example
  Demonstrates router initialization, guard registration, and reactive state usage
-->
<script lang="ts">
  import { 
    RouterView, 
    routerState, 
    createRouterMode 
  } from 'better-svelte-router';
  import { routes } from './routes';
  import { setupAuthGuard } from './guards/auth';

  // Initialize router mode
  // Options: 'history' (recommended) or 'hash'
  // base: Set when deployed in subdirectory, e.g., '/my-app'
  createRouterMode({ 
    mode: 'history',
    // base: '/my-app'
  });

  // Register authentication guard
  setupAuthGuard();

  // Reactively update page title
  $effect(() => {
    const title = routerState.meta.title;
    document.title = title ? `${title} - My App` : 'My App';
  });
</script>

{#snippet loading()}
  <div class="loading-container">
    <div class="spinner"></div>
    <p>Loading...</p>
  </div>
{/snippet}

{#snippet error(err)}
  <div class="error-container">
    <h2>Failed to Load</h2>
    <p>{err.message}</p>
    <button onclick={() => location.reload()}>Retry</button>
  </div>
{/snippet}

<RouterView {routes} {loading} {error} />

<style>
  :global(body) {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #f3f3f3;
    border-top: 3px solid #3498db;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .error-container {
    text-align: center;
    padding: 2rem;
    color: #e74c3c;
  }

  .error-container button {
    margin-top: 1rem;
    padding: 0.5rem 1rem;
    cursor: pointer;
  }
</style>
