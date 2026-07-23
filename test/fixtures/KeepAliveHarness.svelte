<script lang="ts">
  import KeepAlive from '../../src/KeepAlive.svelte';
  import PageA from './KeepAlivePageA.svelte';
  import PageB from './KeepAlivePageB.svelte';

  interface Props {
    include?: any;
    exclude?: any;
    max?: number;
    onMountA?: (n: number) => void;
    onMountB?: (n: number) => void;
    onActivatedA?: (n: number) => void;
    onDeactivatedA?: (n: number) => void;
  }

  let {
    include = null,
    exclude = null,
    max = 10,
    onMountA,
    onMountB,
    onActivatedA,
    onDeactivatedA,
  }: Props = $props();

  let which = $state<'a' | 'b'>('a');
  let userKey = $state<string | null>(null);
</script>

<div data-testid="harness">
  <button type="button" data-testid="goto-a" onclick={() => (which = 'a')}>A</button>
  <button type="button" data-testid="goto-b" onclick={() => (which = 'b')}>B</button>
  <button type="button" data-testid="key-u1" onclick={() => (userKey = 'u1')}>key u1</button>
  <button type="button" data-testid="key-u2" onclick={() => (userKey = 'u2')}>key u2</button>

  <KeepAlive
    is={which === 'a' ? PageA : PageB}
    cacheKey={userKey}
    props={
      which === 'a'
        ? {
            onMountCount: onMountA,
            onActivatedCount: onActivatedA,
            onDeactivatedCount: onDeactivatedA,
          }
        : {
            onMountCount: onMountB,
          }
    }
    {max}
    {include}
    {exclude}
  />
</div>
