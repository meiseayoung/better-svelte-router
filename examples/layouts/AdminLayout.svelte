<!--
  Admin Panel Layout Example
  Demonstrates separate layout and sidebar navigation
-->
<script lang="ts">
  import { RouterView, routerState } from 'better-svelte-router';
  import type { IRoute } from 'better-svelte-router';
  import { authState, logout } from '../guards/auth';

  interface Props {
    routes: IRoute[];
    prefix?: string;
  }

  let { routes, prefix = '' }: Props = $props();

  function handleLogout() {
    logout();
    location.href = '/login';
  }
</script>

<div class="admin-layout">
  <aside class="sidebar">
    <div class="sidebar-header">
      <h2>Admin Panel</h2>
    </div>
    
    <nav class="sidebar-nav">
      <a href="/admin/dashboard" class:active={routerState.pathname === '/admin/dashboard'}>
        📊 Dashboard
      </a>
      <a href="/admin/settings" class:active={routerState.pathname === '/admin/settings'}>
        ⚙️ Settings
      </a>
      <hr />
      <a href="/home">
        🏠 Back to Home
      </a>
    </nav>

    <div class="sidebar-footer">
      <span>{authState.user?.name}</span>
      <button onclick={handleLogout}>Logout</button>
    </div>
  </aside>

  <main class="admin-main">
    <header class="admin-header">
      <h1>{routerState.meta.title ?? 'Admin Panel'}</h1>
    </header>
    
    <div class="admin-content">
      <RouterView {routes} {prefix} />
    </div>
  </main>
</div>

<style>
  .admin-layout {
    display: flex;
    min-height: 100vh;
  }

  .sidebar {
    width: 250px;
    background: #1a252f;
    color: white;
    display: flex;
    flex-direction: column;
  }

  .sidebar-header {
    padding: 1.5rem;
    border-bottom: 1px solid #2c3e50;
  }

  .sidebar-header h2 {
    margin: 0;
    font-size: 1.25rem;
  }

  .sidebar-nav {
    flex: 1;
    padding: 1rem 0;
  }

  .sidebar-nav a {
    display: block;
    padding: 0.75rem 1.5rem;
    color: #bdc3c7;
    text-decoration: none;
    transition: all 0.2s;
  }

  .sidebar-nav a:hover,
  .sidebar-nav a.active {
    background: #2c3e50;
    color: white;
  }

  .sidebar-nav hr {
    border: none;
    border-top: 1px solid #2c3e50;
    margin: 1rem 0;
  }

  .sidebar-footer {
    padding: 1rem 1.5rem;
    border-top: 1px solid #2c3e50;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .sidebar-footer button {
    padding: 0.25rem 0.5rem;
    background: #e74c3c;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
  }

  .admin-main {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .admin-header {
    padding: 1rem 2rem;
    background: white;
    border-bottom: 1px solid #ecf0f1;
  }

  .admin-header h1 {
    margin: 0;
    font-size: 1.5rem;
    color: #2c3e50;
  }

  .admin-content {
    flex: 1;
    padding: 2rem;
    background: #f5f6fa;
  }
</style>
