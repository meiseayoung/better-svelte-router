<!--
  User Detail Page Example
  Demonstrates dynamic route parameter usage
-->
<script lang="ts">
  import { routerState, back, push } from 'better-svelte-router';

  interface Props {
    params: { id: string };
  }

  let { params }: Props = $props();

  // Simulated user data
  const usersData: Record<string, { name: string; email: string; role: string; bio: string; joinedAt: string }> = {
    '1': { name: 'Alice', email: 'alice@example.com', role: 'admin', bio: 'System administrator, responsible for platform operations.', joinedAt: '2023-01-15' },
    '2': { name: 'Bob', email: 'bob@example.com', role: 'user', bio: 'Frontend developer, passionate about open source.', joinedAt: '2023-03-20' },
    '3': { name: 'Charlie', email: 'charlie@example.com', role: 'user', bio: 'Full-stack developer, Svelte enthusiast.', joinedAt: '2023-05-10' },
    '4': { name: 'Diana', email: 'diana@example.com', role: 'moderator', bio: 'Community moderator, responsible for content review.', joinedAt: '2023-02-28' },
    '5': { name: 'Eve', email: 'eve@example.com', role: 'user', bio: 'UI/UX designer, pursuing the ultimate experience.', joinedAt: '2023-06-01' },
  };

  let user = $derived(usersData[params.id]);
</script>

<div class="user-detail">
  <nav class="breadcrumb">
    <a href="/users">User List</a>
    <span>/</span>
    <span>User Detail</span>
  </nav>

  {#if user}
    <div class="user-card">
      <div class="user-avatar">
        {user.name.charAt(0)}
      </div>
      
      <div class="user-info">
        <h1>{user.name}</h1>
        <span class="role-badge role-{user.role}">{user.role}</span>
      </div>

      <div class="user-details">
        <div class="detail-item">
          <label>User ID</label>
          <span>{params.id}</span>
        </div>
        <div class="detail-item">
          <label>Email</label>
          <span>{user.email}</span>
        </div>
        <div class="detail-item">
          <label>Joined</label>
          <span>{user.joinedAt}</span>
        </div>
        <div class="detail-item full-width">
          <label>Bio</label>
          <p>{user.bio}</p>
        </div>
      </div>

      <div class="debug-info">
        <h3>Route Params Debug</h3>
        <pre>params: {JSON.stringify(params, null, 2)}</pre>
        <pre>pathname: {routerState.pathname}</pre>
      </div>
    </div>
  {:else}
    <div class="not-found">
      <h2>User Not Found</h2>
      <p>User with ID {params.id} was not found</p>
    </div>
  {/if}

  <div class="actions">
    <button onclick={() => back()}>← Back</button>
    <button onclick={() => push('/users')}>Back to List</button>
  </div>
</div>

<style>
  .user-detail {
    max-width: 800px;
    margin: 0 auto;
  }

  .breadcrumb {
    margin-bottom: 1.5rem;
    color: #7f8c8d;
  }

  .breadcrumb a {
    color: #3498db;
    text-decoration: none;
  }

  .breadcrumb a:hover {
    text-decoration: underline;
  }

  .breadcrumb span {
    margin: 0 0.5rem;
  }

  .user-card {
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    padding: 2rem;
  }

  .user-avatar {
    width: 80px;
    height: 80px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    font-size: 2rem;
    font-weight: bold;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1rem;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .user-info h1 {
    margin: 0;
    color: #2c3e50;
  }

  .role-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
  }

  .role-admin { background: #e74c3c; color: white; }
  .role-moderator { background: #f39c12; color: white; }
  .role-user { background: #3498db; color: white; }

  .user-details {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    padding: 1.5rem 0;
    border-top: 1px solid #ecf0f1;
    border-bottom: 1px solid #ecf0f1;
  }

  .detail-item {
    display: flex;
    flex-direction: column;
  }

  .detail-item.full-width {
    grid-column: 1 / -1;
  }

  .detail-item label {
    font-size: 0.875rem;
    color: #7f8c8d;
    margin-bottom: 0.25rem;
  }

  .detail-item span,
  .detail-item p {
    color: #2c3e50;
    margin: 0;
  }

  .debug-info {
    margin-top: 1.5rem;
    padding: 1rem;
    background: #f8f9fa;
    border-radius: 4px;
  }

  .debug-info h3 {
    margin: 0 0 0.5rem;
    font-size: 0.875rem;
    color: #7f8c8d;
  }

  .debug-info pre {
    margin: 0.25rem 0;
    font-size: 0.875rem;
    color: #34495e;
  }

  .not-found {
    text-align: center;
    padding: 3rem;
    background: white;
    border-radius: 8px;
  }

  .not-found h2 {
    color: #e74c3c;
  }

  .actions {
    display: flex;
    gap: 1rem;
    margin-top: 1.5rem;
  }

  .actions button {
    padding: 0.75rem 1.5rem;
    border: 1px solid #ddd;
    background: white;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .actions button:hover {
    border-color: #3498db;
    color: #3498db;
  }
</style>
