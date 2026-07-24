<script lang="ts">
  /**
   * Demo sections:
   * 1. Vue-like `{#if}` (rewritten by keepAlivePreprocess)
   * 2. Dynamic `is` + `cacheKey` + `props`
   * 3. `include` / `exclude`
   *
   * KeepAlive itself adds no wrapper element: each cache slot park/restores a
   * mount host before Svelte's `$$anchor` (same strategy as route meta.keepAlive).
   * The dashed `.stage` boxes below are owned by this demo, not by KeepAlive.
   */
  import { KeepAlive } from 'better-svelte-router';
  import PageA from './PageA.svelte';
  import PageB from './PageB.svelte';
  import PageC from './PageC.svelte';
  import UserPage from './UserPage.svelte';

  type Tab = 'a' | 'b' | 'c';
  let tab = $state<Tab>('a');

  let userId = $state('1');

  type Dyn = 'a' | 'b' | 'c';
  let dyn = $state<Dyn>('a');
  const dynComponent = $derived(
    dyn === 'a' ? PageA : dyn === 'b' ? PageB : PageC
  );

  let stageIf = $state<HTMLElement | null>(null);
  let stageUser = $state<HTMLElement | null>(null);
  let stageFilter = $state<HTMLElement | null>(null);
  let probeMsg = $state('Click “Probe DOM” after a page renders.');

  function probe(stage: HTMLElement | null, label: string) {
    if (!stage) {
      probeMsg = `${label}: stage not ready`;
      return;
    }
    const hasRoot = !!stage.querySelector('.bsr-keep-alive-root');
    const host = stage.querySelector('[data-bsr-keep-alive-host]');
    const page = stage.querySelector('.page');
    const hostParent = host?.parentElement;
    probeMsg = [
      `${label}:`,
      `wrapper .bsr-keep-alive-root = ${hasRoot ? 'YES (unexpected)' : 'none'}`,
      `host parent = ${hostParent === stage ? '.stage (direct child)' : hostParent?.tagName ?? 'n/a'}`,
      `page under host = ${page && host?.contains(page) ? 'yes' : 'no'}`,
    ].join(' · ');
  }
</script>

<div class="app">
  <header>
    <h1>KeepAlive component demo</h1>
    <p>
      Three APIs: preprocess <code>&#123;#if&#125;</code>, dynamic
      <code>is</code>/<code>cacheKey</code>, and <code>include</code>/<code>exclude</code>.
      KeepAlive adds <strong>no wrapper element</strong> — only a mount
      <code>host</code> re-parented before the component anchor (like route
      <code>meta.keepAlive</code>).
    </p>
  </header>

  <p class="probe" data-testid="probe">{probeMsg}</p>

  <section>
    <h2>1. Preprocess <code>&#123;#if&#125;</code></h2>
    <p class="hint">
      Source stays Vue-like; <code>keepAlivePreprocess</code> rewrites to
      <code>activeKey</code> + snippet. Local state should survive tab switches.
    </p>
    <nav>
      <button type="button" class:active={tab === 'a'} onclick={() => (tab = 'a')}>A</button>
      <button type="button" class:active={tab === 'b'} onclick={() => (tab = 'b')}>B</button>
      <button type="button" class:active={tab === 'c'} onclick={() => (tab = 'c')}>C</button>
      <button type="button" class="probe-btn" onclick={() => probe(stageIf, 'Section 1')}>
        Probe DOM
      </button>
    </nav>
    <div class="stage" bind:this={stageIf} data-testid="stage-if">
      <KeepAlive max={10}>
        {#if tab === 'a'}
          <PageA />
        {:else if tab === 'b'}
          <PageB />
        {:else}
          <PageC />
        {/if}
      </KeepAlive>
    </div>
  </section>

  <section>
    <h2>2. Dynamic <code>is</code> + <code>cacheKey</code></h2>
    <p class="hint">
      <code>&lt;KeepAlive is=&#123;UserPage&#125; cacheKey=&#123;id&#125; props=&#123;&#123; id &#125;&#125; /&gt;</code>
      — same component, separate instances per id.
    </p>
    <nav>
      <button
        type="button"
        class:active={userId === '1'}
        onclick={() => (userId = '1')}>User 1</button
      >
      <button
        type="button"
        class:active={userId === '2'}
        onclick={() => (userId = '2')}>User 2</button
      >
      <button
        type="button"
        class:active={userId === '3'}
        onclick={() => (userId = '3')}>User 3</button
      >
      <button type="button" class="probe-btn" onclick={() => probe(stageUser, 'Section 2')}>
        Probe DOM
      </button>
    </nav>
    <div class="stage" bind:this={stageUser} data-testid="stage-user">
      <KeepAlive is={UserPage} cacheKey={userId} props={{ id: userId }} max={5} />
    </div>
  </section>

  <section>
    <h2>3. <code>include</code> / <code>exclude</code></h2>
    <p class="hint">
      <code>include=&#123;[PageA, PageB]&#125;</code> caches A/B;
      <code>exclude=&#123;[PageC]&#125;</code> forces C to remount (see its
      <code>onMount</code> count).
    </p>
    <nav>
      <button type="button" class:active={dyn === 'a'} onclick={() => (dyn = 'a')}>A</button>
      <button type="button" class:active={dyn === 'b'} onclick={() => (dyn = 'b')}>B</button>
      <button type="button" class:active={dyn === 'c'} onclick={() => (dyn = 'c')}>C</button>
      <button type="button" class="probe-btn" onclick={() => probe(stageFilter, 'Section 3')}>
        Probe DOM
      </button>
    </nav>
    <div class="stage" bind:this={stageFilter} data-testid="stage-filter">
      <KeepAlive
        is={dynComponent}
        include={[PageA, PageB]}
        exclude={[PageC]}
        max={5}
      />
    </div>
  </section>
</div>

<style>
  :global(body) {
    margin: 0;
    font-family: 'Segoe UI', system-ui, sans-serif;
    background: #0f1419;
    color: #e7ecf1;
  }

  :global(*),
  :global(*::before),
  :global(*::after) {
    box-sizing: border-box;
  }

  .app {
    max-width: 640px;
    margin: 0 auto;
    padding: 1.5rem;
  }

  header h1 {
    margin: 0 0 0.35rem;
    font-size: 1.45rem;
  }

  header p,
  .hint {
    margin: 0 0 1rem;
    color: #9aa7b5;
    line-height: 1.45;
    font-size: 0.95rem;
  }

  header code,
  h2 code,
  .hint code {
    color: #7dd3c0;
    font-size: 0.85em;
  }

  header strong {
    color: #e7ecf1;
    font-weight: 600;
  }

  .probe {
    margin: 0 0 1.5rem;
    padding: 0.65rem 0.85rem;
    border-radius: 6px;
    border: 1px solid #2a3540;
    background: #121820;
    color: #c5d0da;
    font-size: 0.85rem;
    line-height: 1.4;
    word-break: break-word;
  }

  section {
    margin-bottom: 2rem;
  }

  section h2 {
    margin: 0 0 0.35rem;
    font-size: 1.1rem;
    font-weight: 600;
  }

  nav {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  nav button {
    padding: 0.4rem 0.9rem;
    border-radius: 6px;
    border: 1px solid #3a4654;
    background: #1a222c;
    color: inherit;
    cursor: pointer;
  }

  nav button.active {
    border-color: #7dd3c0;
    color: #7dd3c0;
  }

  nav button.probe-btn {
    border-style: dashed;
    color: #9aa7b5;
  }

  /* Demo-owned frame only — KeepAlive does not create this. */
  .stage {
    min-height: 4rem;
    padding: 0.75rem;
    border: 1px dashed #3a4654;
    border-radius: 8px;
    background: #0c1015;
  }

  .stage :global([data-bsr-keep-alive-host]) {
    outline: 1px dotted rgba(125, 211, 192, 0.35);
    outline-offset: 2px;
  }
</style>
