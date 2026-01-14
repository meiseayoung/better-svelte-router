<!--
  User List Page Example
  Demonstrates query parameter usage and list navigation
-->
<script lang="ts">
  import { routerState, push, replace } from 'better-svelte-router';

  // Simulated user data
  const users = [
    { id: '1', name: 'Alice', email: 'alice@example.com', role: 'admin' },
    { id: '2', name: 'Bob', email: 'bob@example.com', role: 'user' },
    { id: '3', name: 'Charlie', email: 'charlie@example.com', role: 'user' },
    { id: '4', name: 'Diana', email: 'diana@example.com', role: 'moderator' },
    { id: '5', name: 'Eve', email: 'eve@example.com', role: 'user' },
  ];

  // Get current page and search term from query params
  let currentPage = $derived(parseInt(routerState.query.page || '1'));
  let searchTerm = $derived(routerState.query.search || '');

  // Filter users
  let filteredUsers = $derived(
    users.filter(user => 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  // Search handler
  function handleSearch(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    // Use replace to avoid creating too many history entries
    replace('/users', { search: value || undefined, page: 1 });
  }

  // Pagination handler
  function goToPage(page: number) {
    push('/users', { ...routerState.query, page });
  }
</script>

<div class="user-list">
  <header class="page-header">
    <h1>User Management</h1>
    <div class="search-box">
      <input 
        type="text" 
        placeholder="Search users..."
        value={searchTerm}
        oninput={handleSearch}
      />
    </div>
  </header>

  <div class="query-info">
    <span>Current query params: {JSON.stringify(routerState.query)}</span>
  </div>

  <table class="user-table">
    <thead>
      <tr>
        <th>ID</th>
        <th>Name</th>
        <th>Email</th>
        <th>Role</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      {#each filteredUsers as user}
        <tr>
          <td>{user.id}</td>
          <td>{user.name}</td>
          <td>{user.email}</td>
          <td>
            <span class="role-badge role-{user.role}">{user.role}</span>
          </td>
          <td>
            <a href="/users/{user.id}" class="view-link">View Details</a>
          </td>
        </tr>
      {:else}
        <tr>
          <td colspan="5" class="empty">No matching users found</td>
        </tr>
      {/each}
    </tbody>
  </table>

  <div class="pagination">
    <button onclick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}>
      Previous
    </button>
    <span>Page {currentPage}</span>
    <button onclick={() => goToPage(currentPage + 1)}>
      Next
    </button>
  </div>
</div>

<style>
  .user-list {
    max-width: 1000px;
    margin: 0 auto;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .page-header h1 {
    margin: 0;
    color: #2c3e50;
  }

  .search-box input {
    padding: 0.5rem 1rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    width: 250px;
  }

  .query-info {
    background: #f8f9fa;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    margin-bottom: 1rem;
    font-family: monospace;
    font-size: 0.875rem;
    color: #7f8c8d;
  }

  .user-table {
    width: 100%;
    border-collapse: collapse;
    background: white;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  th, td {
    padding: 1rem;
    text-align: left;
    border-bottom: 1px solid #ecf0f1;
  }

  th {
    background: #34495e;
    color: white;
    font-weight: 500;
  }

  tr:hover td {
    background: #f8f9fa;
  }

  .role-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
  }

  .role-admin { background: #e74c3c; color: white; }
  .role-moderator { background: #f39c12; color: white; }
  .role-user { background: #3498db; color: white; }

  .view-link {
    color: #3498db;
    text-decoration: none;
  }

  .view-link:hover {
    text-decoration: underline;
  }

  .empty {
    text-align: center;
    color: #7f8c8d;
    padding: 2rem !important;
  }

  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    margin-top: 1.5rem;
  }

  .pagination button {
    padding: 0.5rem 1rem;
    border: 1px solid #ddd;
    background: white;
    border-radius: 4px;
    cursor: pointer;
  }

  .pagination button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .pagination button:hover:not(:disabled) {
    border-color: #3498db;
    color: #3498db;
  }
</style>
