<script lang="ts">
  import type { Snippet } from 'svelte';
  import { routerState } from 'better-svelte-router';

  interface Props {
    children?: Snippet;
  }

  const { children }: Props = $props();

  const tabs = [
    { href: '#/draft', label: 'Draft', keep: true },
    { href: '#/counter', label: 'Counter', keep: true },
    { href: '#/fresh', label: 'Fresh', keep: false },
  ] as const;

  function isActive(href: string): boolean {
    const path = href.replace(/^#/, '');
    return routerState.pathname === path || routerState.pathname === path + '/';
  }
</script>

<nav class="tabs">
  {#each tabs as tab}
    <a
      href={tab.href}
      class:active={isActive(tab.href)}
      data-keep={tab.keep ? 'on' : 'off'}
    >
      {tab.label}
      <span class="badge">{tab.keep ? 'keep-alive' : 'remount'}</span>
    </a>
  {/each}
</nav>

<main class="panel">
  {@render children?.()}
</main>

<aside class="hint">
  path: <code>{routerState.pathname}</code>
  · DevTools → Elements: leaving a keep-alive page parks its nodes off-document (not destroyed).
</aside>

<style>
  .tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }

  .tabs a {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.55rem 0.85rem;
    border-radius: 8px;
    text-decoration: none;
    color: #c5d0da;
    background: #1a222c;
    border: 1px solid #2a3542;
    font-weight: 600;
    font-size: 0.9rem;
  }

  .tabs a:hover {
    border-color: #3d4f63;
  }

  .tabs a.active {
    background: #243041;
    border-color: #4f7cac;
    color: #fff;
  }

  .badge {
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    padding: 0.15rem 0.35rem;
    border-radius: 999px;
    background: #2e3a48;
    color: #9aa7b5;
  }

  a[data-keep='on'] .badge {
    background: #1e3d36;
    color: #7dd3c0;
  }

  a[data-keep='off'] .badge {
    background: #3d2a2a;
    color: #f0a8a8;
  }

  .panel {
    background: #151b22;
    border: 1px solid #2a3542;
    border-radius: 12px;
    padding: 1.25rem;
    min-height: 220px;
  }

  .hint {
    margin-top: 0.85rem;
    font-size: 0.8rem;
    color: #8b98a8;
    line-height: 1.4;
  }

  .hint code {
    color: #7dd3c0;
  }
</style>
