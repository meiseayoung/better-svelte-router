<!--
  404 Page Example
  Demonstrates wildcard routes and back navigation
-->
<script lang="ts">
  import { routerState, back, push } from 'better-svelte-router';
</script>

<div class="not-found">
  <div class="content">
    <h1>404</h1>
    <h2>Page Not Found</h2>
    <p>Sorry, the page <code>{routerState.pathname}</code> does not exist.</p>
    
    <div class="actions">
      <button onclick={() => back()}>
        ← Go Back
      </button>
      <button onclick={() => push('/home')} class="primary">
        Go Home
      </button>
    </div>
  </div>
</div>

<style>
  .not-found {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f5f6fa;
  }

  .content {
    text-align: center;
    padding: 2rem;
  }

  h1 {
    font-size: 8rem;
    margin: 0;
    color: #3498db;
    line-height: 1;
  }

  h2 {
    margin: 0 0 1rem;
    color: #2c3e50;
  }

  p {
    color: #7f8c8d;
    margin-bottom: 2rem;
  }

  code {
    background: #ecf0f1;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-family: monospace;
  }

  .actions {
    display: flex;
    gap: 1rem;
    justify-content: center;
  }

  button {
    padding: 0.75rem 1.5rem;
    border: 1px solid #bdc3c7;
    background: white;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
    transition: all 0.2s;
  }

  button:hover {
    border-color: #3498db;
    color: #3498db;
  }

  button.primary {
    background: #3498db;
    color: white;
    border-color: #3498db;
  }

  button.primary:hover {
    background: #2980b9;
  }
</style>
