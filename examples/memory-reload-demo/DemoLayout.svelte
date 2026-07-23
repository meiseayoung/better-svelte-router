<script lang="ts">
  import type { Snippet } from 'svelte';
  import { push, back, forward, reload, getRouterMode, routerState } from 'better-svelte-router';
  import { saveStackSnapshot } from './stack-storage';

  interface Props {
    children?: Snippet;
  }

  let { children }: Props = $props();

  const stackView = $derived.by(() => {
    void routerState.pathname;
    void routerState.search;
    const adapter = getRouterMode();
    return {
      entries: adapter.getEntries?.() ?? [],
      index: adapter.getIndex?.() ?? 0,
      hash: window.location.hash,
    };
  });

  function reloadWithStack() {
    const adapter = getRouterMode();
    if (adapter.getEntries && adapter.getIndex) {
      saveStackSnapshot(adapter.getEntries(), adapter.getIndex());
    }
    reload();
  }

  function reloadOnly() {
    reload();
  }
</script>

<div class="layout">
  <nav>
    <button type="button" class:active={routerState.pathname === '/home'} onclick={() => push('/home')}>
      Home
    </button>
    <button type="button" class:active={routerState.pathname === '/list'} onclick={() => push('/list')}>
      List
    </button>
    <button type="button" class:active={routerState.pathname.startsWith('/detail/')} onclick={() => push('/detail/1')}>
      Detail
    </button>
  </nav>

  <div class="panel">
    <div class="meta">
      <div><span>pathname</span> <code>{routerState.pathname}{routerState.search}</code></div>
      <div><span>location.hash</span> <code>{stackView.hash || '(empty)'}</code></div>
      <div><span>stack index</span> <code>{stackView.index}</code></div>
    </div>

    <ol class="stack">
      {#each stackView.entries as entry, i}
        <li class:current={i === stackView.index}>{entry}</li>
      {/each}
    </ol>

    <div class="actions">
      <button type="button" onclick={() => back()}>back()</button>
      <button type="button" onclick={() => forward()}>forward()</button>
      <button type="button" class="primary" onclick={reloadWithStack}>Reload + restore stack</button>
      <button type="button" class="warn" onclick={reloadOnly}>Reload only</button>
    </div>
  </div>

  <main>
    {@render children?.()}
  </main>
</div>

<style>
  .layout {
    display: grid;
    gap: 1rem;
  }

  nav,
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  nav button,
  .actions button {
    border: 1px solid #2b3642;
    border-radius: 8px;
    padding: 0.45rem 0.8rem;
    background: #1a222c;
    color: #e7ecf1;
    font: inherit;
    cursor: pointer;
  }

  nav button.active {
    border-color: #3d9b92;
    background: #1d3a38;
    color: #9ff0e4;
  }

  .actions .primary {
    border-color: #3d9b92;
    background: #2a6f6a;
    color: #e7fffb;
  }

  .actions .warn {
    border-color: #8a5a2b;
    background: #4a3218;
    color: #ffd7a8;
  }

  .panel {
    display: grid;
    gap: 0.75rem;
    padding: 0.9rem 1rem;
    border: 1px solid #2b3642;
    border-radius: 12px;
    background: #151b22;
  }

  .meta {
    display: grid;
    gap: 0.35rem;
    font-size: 0.9rem;
  }

  .meta span {
    display: inline-block;
    min-width: 7.5rem;
    color: #9aa7b5;
  }

  .meta code,
  .stack {
    color: #7dd3c0;
  }

  .stack {
    margin: 0;
    padding-left: 1.25rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.88rem;
    line-height: 1.55;
  }

  .stack li.current {
    color: #ffe08a;
    font-weight: 650;
  }

  main {
    padding: 1rem;
    border: 1px solid #2b3642;
    border-radius: 12px;
    background: #12171d;
  }
</style>
