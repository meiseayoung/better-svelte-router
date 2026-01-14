<!--
  Main Layout Component Example
  Demonstrates how parent components render child routes in nested routing
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
    // Use native navigation since state is cleared
    location.href = '/login';
  }
</script>

<div class="layout">
  <header class="header">
    <div class="logo">My App</div>
    
    <nav class="nav">
      <a href="/home" class:active={routerState.pathname === '/home'}>
        Home
      </a>
      <a href="/users" class:active={routerState.pathname.startsWith('/users')}>
        Users
      </a>
      {#if authState.isAdmin}
        <a href="/admin" class:active={routerState.pathname.startsWith('/admin')}>
          Admin
        </a>
      {/if}
    </nav>

    <div class="user-info">
      {#if authState.isAuthenticated}
        <span>Welcome, {authState.user?.name}</span>
        <button onclick={handleLogout}>Logout</button>
      {:else}
        <a href="/login">Login</a>
      {/if}
    </div>
  </header>

  <main class="main">
    <!-- Render child routes -->
    <RouterView {routes} {prefix} />
  </main>

  <footer class="footer">
    <p>© 2024 My App. Built with better-svelte-router</p>
  </footer>
</div>

<style>
  .layout {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .header {
    display: flex;
    align-items: center;
    padding: 1rem 2rem;
    background: #2c3e50;
    color: white;
  }

  .logo {
    font-size: 1.5rem;
    font-weight: bold;
  }

  .nav {
    margin-left: 2rem;
    display: flex;
    gap: 1rem;
  }

  .nav a {
    color: #ecf0f1;
    text-decoration: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    transition: background 0.2s;
  }

  .nav a:hover,
  .nav a.active {
    background: #34495e;
  }

  .user-info {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .user-info button {
    padding: 0.5rem 1rem;
    background: #e74c3c;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .user-info a {
    color: #3498db;
  }

  .main {
    flex: 1;
    padding: 2rem;
  }

  .footer {
    padding: 1rem 2rem;
    background: #ecf0f1;
    text-align: center;
    color: #7f8c8d;
  }
</style>
