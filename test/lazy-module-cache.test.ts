import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  LazyChunkError,
  LAZY_PROBE_PARAM,
  clearLazyRetryHandlers,
  createProbeToken,
  drainFailedModuleUrls,
  extractImportUrlFromLoader,
  getModuleResolveBase,
  loadLazyComponent,
  probeLazyModule,
  registerLazyRetryHandler,
  rememberFailedModuleUrl,
  revalidateFailedModules,
  retryLazyLoad,
  toAbsoluteModuleUrl,
  withProbeQuery,
} from '../src/lazy-module-cache';
import { createRouterMode, isLazyHeadCheckEnabled, resetRouterMode } from '../src/router-mode';

describe('lazy-module-cache', () => {
  beforeEach(() => {
    drainFailedModuleUrls();
    clearLazyRetryHandlers();
    resetRouterMode();
  });

  afterEach(() => {
    drainFailedModuleUrls();
    clearLazyRetryHandlers();
    resetRouterMode();
    vi.restoreAllMocks();
  });

  it('extractImportUrlFromLoader reads string / backtick import specifiers', () => {
    // Use Function so Vite does not rewrite/analyze the dynamic import at transform time.
    const single = new Function('return import(\'./a.js\')') as () => Promise<{ default: unknown }>;
    const quoted = new Function('return import("./quoted.js")') as () => Promise<{ default: unknown }>;
    const backtick = new Function('return import(`./bt.js`)') as () => Promise<{ default: unknown }>;
    expect(extractImportUrlFromLoader(single)).toBe('./a.js');
    expect(extractImportUrlFromLoader(quoted)).toBe('./quoted.js');
    expect(extractImportUrlFromLoader(backtick)).toBe('./bt.js');
  });

  it('withProbeQuery appends a unique _bsr_probe token', () => {
    const url = withProbeQuery('https://example.com/assets/a.js', 'tok1');
    expect(url).toContain(`${LAZY_PROBE_PARAM}=tok1`);
    expect(createProbeToken()).toMatch(/^[a-z0-9]+-[a-z0-9]+$/i);
  });

  it('getModuleResolveBase prefers the index entry module directory', () => {
    document.body.innerHTML = `
      <script type="module" src="/assets/polyfill.js"></script>
      <script type="module" src="/assets/index-abc.js"></script>
    `;
    expect(getModuleResolveBase(document, window.location)).toBe(
      new URL('/assets/', window.location.href).href
    );
    expect(toAbsoluteModuleUrl('./chunk.js', 'https://app/assets/')).toBe(
      'https://app/assets/chunk.js'
    );
  });

  it('probeLazyModule treats 2xx and 405 as ok; other statuses as http; throw as network', async () => {
    const ok = await probeLazyModule('https://example.com/a.js', async () =>
      new Response(null, { status: 200 })
    );
    expect(ok.ok).toBe(true);

    const methodNotAllowed = await probeLazyModule('https://example.com/a.js', async () =>
      new Response(null, { status: 405 })
    );
    expect(methodNotAllowed.ok).toBe(true);

    const missing = await probeLazyModule('https://example.com/a.js', async () =>
      new Response(null, { status: 404 })
    );
    expect(missing).toMatchObject({ ok: false, status: 404, reason: 'http' });

    const offline = await probeLazyModule('https://example.com/a.js', async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(offline).toMatchObject({ ok: false, status: null, reason: 'network' });
  });

  it('loadLazyComponent skips import when HEAD fails and exposes LazyChunkError.retry', async () => {
    const lazy = vi.fn(async () => ({ default: {} }));
    Object.defineProperty(lazy, 'toString', {
      value: () => '() => import("./missing.js")',
    });

    const retry = vi.fn();
    await expect(
      loadLazyComponent(lazy as any, {
        headCheck: true,
        retry,
        fetchImpl: async () => new Response(null, { status: 404 }),
      })
    ).rejects.toMatchObject({
      name: 'LazyChunkError',
      reason: 'http',
      status: 404,
    });
    expect(lazy).not.toHaveBeenCalled();
    expect(drainFailedModuleUrls()).toEqual(['./missing.js']);

    const err = await loadLazyComponent(lazy as any, {
      headCheck: true,
      retry,
      fetchImpl: async () => {
        throw new Error('offline');
      },
    }).catch((e) => e);
    expect(err).toBeInstanceOf(LazyChunkError);
    expect(err.isNetwork).toBe(true);
    err.retry();
    expect(retry).toHaveBeenCalled();
  });

  it('loadLazyComponent wraps import failures when headCheck is on', async () => {
    const lazy = Object.assign(
      async () => {
        throw new Error('boom');
      },
      { toString: () => '() => import("./x.js")' }
    );

    await expect(
      loadLazyComponent(lazy, {
        headCheck: true,
        retry: () => {},
        fetchImpl: async () => new Response(null, { status: 200 }),
      })
    ).rejects.toMatchObject({
      name: 'LazyChunkError',
      reason: 'import',
    });
  });

  it('retryLazyLoad invokes registered handlers', () => {
    const a = vi.fn();
    const b = vi.fn();
    const off = registerLazyRetryHandler(a);
    registerLazyRetryHandler(b);
    retryLazyLoad();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    off();
    retryLazyLoad();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
  });

  it('revalidateFailedModules fetches remembered URLs with cache reload', async () => {
    rememberFailedModuleUrl('./a.js');
    rememberFailedModuleUrl('./b.js');
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));
    await revalidateFailedModules(fetchImpl as any, 0);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ cache: 'reload' });
    expect(drainFailedModuleUrls()).toEqual([]);
  });

  it('createRouterMode toggles isLazyHeadCheckEnabled and reset clears it', () => {
    expect(isLazyHeadCheckEnabled()).toBe(false);
    createRouterMode({ mode: 'hash', lazyHeadCheck: true });
    expect(isLazyHeadCheckEnabled()).toBe(true);
    resetRouterMode();
    expect(isLazyHeadCheckEnabled()).toBe(false);
  });
});
