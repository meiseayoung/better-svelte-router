<!--
  Admin Dashboard Example
-->
<script lang="ts">
  import { routerState } from 'better-svelte-router';

  // Simulated statistics
  const stats = [
    { label: 'Total Users', value: 1234, icon: '👥', color: '#3498db' },
    { label: 'Today Visits', value: 567, icon: '📊', color: '#2ecc71' },
    { label: 'Active Sessions', value: 89, icon: '🔥', color: '#e74c3c' },
    { label: 'System Load', value: '23%', icon: '⚡', color: '#f39c12' },
  ];
</script>

<div class="dashboard">
  <div class="stats-grid">
    {#each stats as stat}
      <div class="stat-card" style="--accent-color: {stat.color}">
        <div class="stat-icon">{stat.icon}</div>
        <div class="stat-content">
          <div class="stat-value">{stat.value}</div>
          <div class="stat-label">{stat.label}</div>
        </div>
      </div>
    {/each}
  </div>

  <div class="info-section">
    <h2>Route Info</h2>
    <dl>
      <dt>Current Path</dt>
      <dd>{routerState.pathname}</dd>
      <dt>Page Title</dt>
      <dd>{routerState.meta.title}</dd>
      <dt>Requires Auth</dt>
      <dd>{routerState.meta.requiresAuth ? 'Yes' : 'No'}</dd>
      <dt>Requires Admin</dt>
      <dd>{routerState.meta.requiresAdmin ? 'Yes' : 'No'}</dd>
    </dl>
  </div>
</div>

<style>
  .dashboard {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1.5rem;
  }

  .stat-card {
    background: white;
    border-radius: 8px;
    padding: 1.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    border-left: 4px solid var(--accent-color);
  }

  .stat-icon {
    font-size: 2rem;
  }

  .stat-value {
    font-size: 1.75rem;
    font-weight: bold;
    color: #2c3e50;
  }

  .stat-label {
    color: #7f8c8d;
    font-size: 0.875rem;
  }

  .info-section {
    background: white;
    border-radius: 8px;
    padding: 1.5rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .info-section h2 {
    margin: 0 0 1rem;
    color: #2c3e50;
  }

  dl {
    display: grid;
    grid-template-columns: 120px 1fr;
    gap: 0.5rem;
    margin: 0;
  }

  dt {
    font-weight: 500;
    color: #7f8c8d;
  }

  dd {
    margin: 0;
    color: #2c3e50;
  }
</style>
