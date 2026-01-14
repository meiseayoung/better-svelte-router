<!--
  Login Page Example
  Demonstrates form handling and post-login navigation
-->
<script lang="ts">
  import { push, routerState } from 'better-svelte-router';
  import { login } from '../guards/auth';

  let username = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = '';
    loading = true;

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const success = login(username, password);
    
    if (success) {
      // Get redirect target (if any)
      const redirect = routerState.query.redirect || '/home';
      await push(redirect);
    } else {
      error = 'Invalid username or password';
    }
    
    loading = false;
  }
</script>

<div class="login-page">
  <div class="login-card">
    <h1>Login</h1>
    
    <form onsubmit={handleSubmit}>
      {#if error}
        <div class="error-message">{error}</div>
      {/if}
      
      <div class="form-group">
        <label for="username">Username</label>
        <input 
          id="username"
          type="text" 
          bind:value={username}
          placeholder="admin or user"
          disabled={loading}
          required
        />
      </div>
      
      <div class="form-group">
        <label for="password">Password</label>
        <input 
          id="password"
          type="password" 
          bind:value={password}
          placeholder="Same as username"
          disabled={loading}
          required
        />
      </div>
      
      <button type="submit" disabled={loading}>
        {loading ? 'Logging in...' : 'Login'}
      </button>
    </form>

    <div class="hints">
      <p>Test accounts:</p>
      <ul>
        <li><strong>admin / admin</strong> - Admin privileges</li>
        <li><strong>user / user</strong> - Regular user</li>
      </ul>
    </div>
  </div>
</div>

<style>
  .login-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  .login-card {
    background: white;
    padding: 2rem;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    width: 100%;
    max-width: 400px;
  }

  h1 {
    margin: 0 0 1.5rem;
    text-align: center;
    color: #2c3e50;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  label {
    display: block;
    margin-bottom: 0.5rem;
    color: #34495e;
    font-weight: 500;
  }

  input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 1rem;
    box-sizing: border-box;
  }

  input:focus {
    outline: none;
    border-color: #3498db;
    box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
  }

  input:disabled {
    background: #f5f5f5;
  }

  button {
    width: 100%;
    padding: 0.75rem;
    background: #3498db;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 1rem;
    cursor: pointer;
    transition: background 0.2s;
  }

  button:hover:not(:disabled) {
    background: #2980b9;
  }

  button:disabled {
    background: #bdc3c7;
    cursor: not-allowed;
  }

  .error-message {
    background: #fee;
    color: #c0392b;
    padding: 0.75rem;
    border-radius: 4px;
    margin-bottom: 1rem;
    text-align: center;
  }

  .hints {
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid #eee;
    font-size: 0.875rem;
    color: #7f8c8d;
  }

  .hints p {
    margin: 0 0 0.5rem;
  }

  .hints ul {
    margin: 0;
    padding-left: 1.25rem;
  }

  .hints li {
    margin-bottom: 0.25rem;
  }
</style>
