import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  transformKeepAliveMarkup,
  keepAlivePreprocess,
  hasLibraryKeepAliveImport,
  resolveKeepAliveLocalNames,
} from '../src/keep-alive-preprocess';

const libImport = `<script>import { KeepAlive } from 'better-svelte-router';</script>\n`;

describe('keepAlivePreprocess / transformKeepAliveMarkup', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rewrites an if / else-if / else chain into activeKey + children snippet', () => {
    const input = `${libImport}<KeepAlive max={10}>
  {#if tab === 'a'}
    <PageA />
  {:else if tab === 'b'}
    <PageB />
  {:else}
    <PageC />
  {/if}
</KeepAlive>`;

    const { code, transforms } = transformKeepAliveMarkup(input, { warn: false });
    expect(transforms).toBe(1);
    expect(code).toContain("(tab === 'a') ? 0");
    expect(code).toContain('activeKey={');
    expect(code).toContain('max={10}');
    expect(code).toContain('{#snippet children(__bsr_k)}');
    expect(code).not.toContain("{#if tab === 'a'}");
  });

  it('preserves include/exclude/cacheKey attrs on rewrite', () => {
    const input = `${libImport}<KeepAlive max={3} include={['A']} exclude={/B/} cacheKey={id}>
  {#if tab === 'a'}
    <PageA />
  {/if}
</KeepAlive>`;
    const { code } = transformKeepAliveMarkup(input, { warn: false });
    expect(code).toContain("include={['A']}");
    expect(code).toContain('exclude={/B/}');
    expect(code).toContain('cacheKey={id}');
    expect(code).toContain('activeKey=');
  });

  it('uses -1 when if-chain has no else and no branch matches', () => {
    const input = `${libImport}<KeepAlive>
  {#if tab === 'a'}
    <PageA />
  {:else if tab === 'b'}
    <PageB />
  {/if}
</KeepAlive>`;

    const { code } = transformKeepAliveMarkup(input, { warn: false });
    expect(code).toContain(': (-1)');
  });

  it('rewrites svelte:component into is + props', () => {
    const input = `${libImport}<KeepAlive max={5} cacheKey={uid}>
  <svelte:component this={Current} foo={bar} />
</KeepAlive>`;

    const { code, transforms } = transformKeepAliveMarkup(input, { warn: false });
    expect(transforms).toBe(1);
    expect(code).toContain('is={Current}');
    expect(code).toContain('props={{ foo: bar }}');
    expect(code).toContain('cacheKey={uid}');
    expect(code).not.toContain('svelte:component');
  });

  it('leaves non-KeepAlive markup unchanged', () => {
    const input = `<div>{#if x}<A />{/if}</div>`;
    const { code, transforms } = transformKeepAliveMarkup(input, { warn: false });
    expect(transforms).toBe(0);
    expect(code).toBe(input);
  });

  it('does not rewrite KeepAlive without a better-svelte-router import', () => {
    const input = `<KeepAlive>{#if ok}<A />{/if}</KeepAlive>`;
    const { code, transforms } = transformKeepAliveMarkup(input, { warn: false });
    expect(transforms).toBe(0);
    expect(code).toBe(input);
  });

  it('does not rewrite KeepAlive imported from another package', () => {
    const input = `<script>import { KeepAlive } from 'other-lib';</script>
<KeepAlive>{#if ok}<A />{/if}</KeepAlive>`;
    const { transforms } = transformKeepAliveMarkup(input, { warn: false });
    expect(transforms).toBe(0);
  });

  it('auto-discovers KeepAlive as KA without tag option', () => {
    const input = `<script>import { KeepAlive as KA } from 'better-svelte-router';</script>
<KA>{#if ok}<A />{/if}</KA>`;
    const { code, transforms } = transformKeepAliveMarkup(input, { warn: false });
    expect(transforms).toBe(1);
    expect(code).toContain('<KA');
    expect(code).toContain('activeKey=');
  });

  it('matches subpath imports from better-svelte-router/...', () => {
    const input = `<script>import { KeepAlive } from 'better-svelte-router/ somehow';</script>
<KeepAlive>{#if ok}<A />{/if}</KeepAlive>`;
    expect(resolveKeepAliveLocalNames(input)).toEqual(['KeepAlive']);
    const { transforms } = transformKeepAliveMarkup(input, { warn: false });
    expect(transforms).toBe(1);
  });

  it('collects re-export aliases from export { KeepAlive as KA } from', () => {
    expect(
      resolveKeepAliveLocalNames(
        `export { KeepAlive as KA } from 'better-svelte-router'`
      )
    ).toEqual(['KA']);
  });

  it('hasLibraryKeepAliveImport detects named and aliased imports', () => {
    expect(
      hasLibraryKeepAliveImport(
        `import { KeepAlive } from 'better-svelte-router'`,
        'KeepAlive'
      )
    ).toBe(true);
    expect(
      hasLibraryKeepAliveImport(
        `import { KeepAlive as KA } from 'better-svelte-router'`,
        'KA'
      )
    ).toBe(true);
    expect(
      hasLibraryKeepAliveImport(
        `import { KeepAlive as KA } from 'better-svelte-router'`,
        'KeepAlive'
      )
    ).toBe(false);
  });

  it('warns and skips unsupported KeepAlive children', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const input = `${libImport}<KeepAlive><div>hi</div></KeepAlive>`;
    const { code, transforms } = transformKeepAliveMarkup(input, { warn: true });
    expect(transforms).toBe(0);
    expect(code).toBe(input);
    expect(warn).toHaveBeenCalled();
  });

  it('preprocessor markup() returns transformed code', () => {
    const pp = keepAlivePreprocess({ warn: false });
    const input = `${libImport}<KeepAlive>{#if ok}<A />{/if}</KeepAlive>`;
    const result = pp.markup({ content: input });
    expect(result.code).toContain('activeKey=');
  });

  it('from: null transforms without requiring an import (escape hatch)', () => {
    const input = `<KeepAlive>{#if ok}<A />{/if}</KeepAlive>`;
    const { transforms } = transformKeepAliveMarkup(input, {
      warn: false,
      from: null,
    });
    expect(transforms).toBe(1);
  });
});
