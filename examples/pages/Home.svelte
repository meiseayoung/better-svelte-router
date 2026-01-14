<!--
  Home Page Example
  Demonstrates reactive state and programmatic navigation
-->
<script lang="ts">
  import { routerState, push } from 'better-svelte-router';
  import { authState } from '../guards/auth';

  async function goToUsers() {
    const success = await push('/users');
    if (!success) {
      console.log('Navigation was cancelled or redirected');
    }
  }

  async function goToUserDetail(id: string) {
    await push(`/users/${id}`);
  }
</script>

<div class="home">
  <h1>Welcome to better-svelte-router</h1>
  
  <section class="info-card">
    <h2>Current Route State</h2>
    <dl>
      <dt>Path</dt>
      <dd>{routerState.pathname}</dd>
      
      <dt>Full URL</dt>
      <dd>{routerState.href}</dd>
      
      <dt>Query Params</dt>
      <dd>{JSON.stringify(routerState.query)}</dd>
      
      <dt>Page Title</dt>
      <dd>{routerState.meta.title ?? 'None'}</dd>
    </dl>
  </section>

  <section class="actions">
    <h2>Programmatic Navigation Examples</h2>
    
    <div class="button-group">
      <button onclick={goToUsers}>
        View User List
      </button>
      
      <button onclick={() => goToUserDetail('123')}>
        View User #123
      </button>
      
      <button onclick={() => push('/users', { page: 1, limit: 10 })}>
        Navigate with Query Params
      </button>
    </div>
  </section>

  {#if authState.isAuthenticated}
    <section class="user-card">
      <h2>Current User</h2>
      <p>ID: {authState.user?.id}</p>
      <p>Name: {authState.user?.name}</p>
      <p>Role: {authState.user?.role}</p>
    </section>
  {:else}
    <section class="login-prompt">
      <p>You are not logged in, some features are restricted</p>
      <a href="/login">Login Now</a>
    </section>
  {/if}
</div>

<style>
  .home {
    max-width: 800px;
    margin: 0 auto;
  }

  h1 {
    color: #2c3e50;
    margin-bottom: 2rem;
  }

  section {
    background: white;
    padding: 1.5rem;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    margin-bottom: 1.5rem;
  }

  section h2 {
    margin-top: 0;
    color: #34495e;
    font-size: 1.25rem;
  }

  dl {
    display: grid;
    grid-template-columns: 120px 1fr;
    gap: 0.5rem;
  }

  dt {
    font-weight: bold;
    color: #7f8c8d;
  }

  dd {
    margin: 0;
    font-family: monospace;
    background: #f8f9fa;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
  }

  .button-group {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  button {
    padding: 0.75rem 1.5rem;
    background: #3498db;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
    transition: background 0.2s;
  }

  button:hover {
    background: #2980b9;
  }

  .login-prompt {
    text-align: center;
    background: #fff3cd;
  }

  .login-prompt a {
    color: #3498db;
    font-weight: bold;
  }
</style>
