<!--
  System Settings Page Example
-->
<script lang="ts">
  import { replace } from 'better-svelte-router';

  let siteName = $state('My App');
  let allowRegistration = $state(true);
  let maintenanceMode = $state(false);
  let saved = $state(false);

  function handleSave() {
    // Simulate save
    saved = true;
    setTimeout(() => saved = false, 2000);
  }

  function handleReset() {
    siteName = 'My App';
    allowRegistration = true;
    maintenanceMode = false;
  }
</script>

<div class="settings">
  <form onsubmit|preventDefault={handleSave}>
    <div class="form-section">
      <h2>Basic Settings</h2>
      
      <div class="form-group">
        <label for="siteName">Site Name</label>
        <input 
          id="siteName"
          type="text" 
          bind:value={siteName}
        />
      </div>
    </div>

    <div class="form-section">
      <h2>Feature Toggles</h2>
      
      <div class="form-group checkbox">
        <label>
          <input type="checkbox" bind:checked={allowRegistration} />
          Allow User Registration
        </label>
        <p class="hint">When disabled, new users cannot register</p>
      </div>

      <div class="form-group checkbox">
        <label>
          <input type="checkbox" bind:checked={maintenanceMode} />
          Maintenance Mode
        </label>
        <p class="hint">When enabled, regular users cannot access the system</p>
      </div>
    </div>

    <div class="form-actions">
      <button type="button" class="secondary" onclick={handleReset}>
        Reset
      </button>
      <button type="submit" class="primary">
        Save Settings
      </button>
    </div>

    {#if saved}
      <div class="success-message">
        ✓ Settings saved
      </div>
    {/if}
  </form>
</div>

<style>
  .settings {
    max-width: 600px;
  }

  .form-section {
    background: white;
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .form-section h2 {
    margin: 0 0 1rem;
    font-size: 1.125rem;
    color: #2c3e50;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #ecf0f1;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group:last-child {
    margin-bottom: 0;
  }

  .form-group > label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: #34495e;
  }

  .form-group input[type="text"] {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 1rem;
    box-sizing: border-box;
  }

  .form-group input[type="text"]:focus {
    outline: none;
    border-color: #3498db;
  }

  .form-group.checkbox label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  .form-group.checkbox input[type="checkbox"] {
    width: 18px;
    height: 18px;
  }

  .hint {
    margin: 0.25rem 0 0 1.75rem;
    font-size: 0.875rem;
    color: #7f8c8d;
  }

  .form-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
  }

  button {
    padding: 0.75rem 1.5rem;
    border-radius: 4px;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  button.secondary {
    background: white;
    border: 1px solid #ddd;
    color: #34495e;
  }

  button.secondary:hover {
    border-color: #bdc3c7;
  }

  button.primary {
    background: #3498db;
    border: none;
    color: white;
  }

  button.primary:hover {
    background: #2980b9;
  }

  .success-message {
    margin-top: 1rem;
    padding: 0.75rem;
    background: #d4edda;
    color: #155724;
    border-radius: 4px;
    text-align: center;
  }
</style>
