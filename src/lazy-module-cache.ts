import type { LazyComponent } from './types';

/**
 * Failed lazy-chunk URLs remembered so `reload()` can revalidate them before
 * a hard navigation. WKWebView / the HTML module map may stick a failed
 * response to the same URL; a document-only cache-bust does not change chunk
 * URLs, so we `fetch(..., { cache: 'reload' })` first when the network is back.
 *
 * Separately, opt-in `lazyHeadCheck` probes chunks with HEAD (+ unique
 * `_bsr_probe`) before `import()` so a missing chunk never poisons the module
 * map — see `probeLazyModule` / `LazyChunkError` / `retryLazyLoad`.
 */

const failedModuleUrls = new Set<string>();

/** Max time to wait for chunk revalidation before forcing location.replace. */
export const REVALIDATE_TIMEOUT_MS = 3000;

/** Query key appended to every HEAD probe so WKWebView never serves a cached HEAD. */
export const LAZY_PROBE_PARAM = '_bsr_probe';

/**
 * Why a lazy chunk failed to load.
 * - `network`: HEAD `fetch` threw (offline, DNS, CORS abort, etc.)
 * - `http`: HEAD returned a non-success status (e.g. 404 / 500)
 * - `import`: HEAD succeeded (or was skipped) but dynamic `import()` failed
 */
export type LazyChunkErrorReason = 'network' | 'http' | 'import';

/** Result of a HEAD probe against a lazy chunk URL. */
export interface LazyProbeResult {
  ok: boolean;
  status: number | null;
  probeUrl: string;
  /** Set when `ok` is false. */
  reason?: Exclude<LazyChunkErrorReason, 'import'>;
}

type LazyRetryHandler = () => void;

const lazyRetryHandlers = new Set<LazyRetryHandler>();

/**
 * Error thrown when a lazy chunk fails HEAD probe (or import after probe).
 * `retry()` clears RouterView caches and re-runs the load (HEAD then import).
 *
 * Use `reason` to distinguish offline/network vs HTTP miss vs import failure:
 * `err.reason === 'network'`.
 */
export class LazyChunkError extends Error {
  readonly url: string;
  readonly status: number | null;
  readonly reason: LazyChunkErrorReason;
  private readonly retryFn: () => void;

  constructor(
    message: string,
    options: {
      url: string;
      status?: number | null;
      reason: LazyChunkErrorReason;
      retry: () => void;
      cause?: unknown;
    }
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'LazyChunkError';
    this.url = options.url;
    this.status = options.status ?? null;
    this.reason = options.reason;
    this.retryFn = options.retry;
  }

  /** True when the HEAD probe failed because `fetch` threw (likely offline). */
  get isNetwork(): boolean {
    return this.reason === 'network';
  }

  /** Re-probe and re-import the failed lazy chunk. */
  retry(): void {
    this.retryFn();
  }
}

/**
 * Extract the module specifier from a lazy loader via `Function#toString`.
 * Works when the bundler left a string literal in `import("...")` /
 * `import('...')` / `import(\`...\`)` (Vite production often uses backticks).
 */
export function extractImportUrlFromLoader(lazy: LazyComponent): string | null {
  try {
    const src = lazy.toString();
    const match = src.match(/import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Record a chunk URL that failed to load (idempotent). */
export function rememberFailedModuleUrl(url: string): void {
  if (!url) return;
  failedModuleUrls.add(url);
}

/** Take and clear all remembered failed module URLs. */
export function drainFailedModuleUrls(): string[] {
  const urls = [...failedModuleUrls];
  failedModuleUrls.clear();
  return urls;
}

/**
 * Base URL for resolving relative lazy chunk specifiers (`./chunk.js`).
 * Must be the **entry module's directory** (e.g. `/assets/`), not `location.href`:
 * Vite emits `import(\`./auth-xxx.js\`)` relative to the bundling chunk in
 * `assets/`, while `new URL('./auth.js', location.href)` wrongly targets the
 * document path and HEAD-probes a 404 — RouterView then shows the error snippet
 * on every cold load.
 */
export function getModuleResolveBase(
  doc: Document | null = typeof document !== 'undefined' ? document : null,
  loc: Location | null = typeof location !== 'undefined' ? location : null
): string {
  if (!doc || !loc) return '';
  try {
    const scripts = doc.querySelectorAll('script[type="module"][src]');
    let fallback: string | null = null;
    for (const el of scripts) {
      const src = el.getAttribute('src');
      if (!src || src.startsWith('data:')) continue;
      const abs = new URL(src, loc.href);
      if (!/\.m?js$/i.test(abs.pathname)) continue;
      const dir = new URL('./', abs.href).href;
      // Prefer the app entry (`…/assets/index-*.js`) over polyfills/helpers.
      if (/\/index[^/]*\.m?js$/i.test(abs.pathname)) return dir;
      fallback = dir;
    }
    if (fallback) return fallback;
  } catch {
    // fall through
  }
  return loc.href;
}

/** Resolve a possibly-relative module URL against the entry module directory. */
export function toAbsoluteModuleUrl(
  url: string,
  base: string = getModuleResolveBase()
): string {
  try {
    return new URL(url, base || location.href).href;
  } catch {
    return url;
  }
}

/** Build a unique probe token for `_bsr_probe`. */
export function createProbeToken(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Append (or replace) `_bsr_probe` on a module URL so each HEAD bypasses cache.
 */
export function withProbeQuery(url: string, token: string = createProbeToken()): string {
  const absolute = toAbsoluteModuleUrl(url);
  try {
    const parsed = new URL(absolute);
    parsed.searchParams.set(LAZY_PROBE_PARAM, token);
    return parsed.href;
  } catch {
    const sep = absolute.includes('?') ? '&' : '?';
    return `${absolute}${sep}${LAZY_PROBE_PARAM}=${encodeURIComponent(token)}`;
  }
}

/**
 * HEAD-probe a lazy chunk URL. 2xx and 405 count as "exists"; other statuses
 * are `http` failures; thrown `fetch` errors are `network`. Never calls `import()`.
 */
export async function probeLazyModule(
  url: string,
  fetchImpl: typeof fetch = fetch
): Promise<LazyProbeResult> {
  const probeUrl = withProbeQuery(url);
  if (typeof fetchImpl !== 'function') {
    return { ok: false, status: null, probeUrl, reason: 'network' };
  }
  try {
    const response = await fetchImpl(probeUrl, {
      method: 'HEAD',
      cache: 'no-store',
      credentials: 'same-origin',
    });
    const status = response.status;
    // 405: some static hosts disallow HEAD but the resource exists.
    const ok = (status >= 200 && status < 300) || status === 405;
    if (ok) return { ok: true, status, probeUrl };
    return { ok: false, status, probeUrl, reason: 'http' };
  } catch {
    return { ok: false, status: null, probeUrl, reason: 'network' };
  }
}

/**
 * Load a lazy route module, optionally HEAD-probing first when `headCheck` is on.
 * On probe failure, throws `LazyChunkError` without calling `lazy()`.
 */
export async function loadLazyComponent(
  lazy: LazyComponent,
  options: {
    headCheck: boolean;
    retry: () => void;
    fetchImpl?: typeof fetch;
  }
): Promise<{ default: any }> {
  const url = extractImportUrlFromLoader(lazy);
  const { headCheck, retry, fetchImpl = fetch } = options;

  if (headCheck && url) {
    const probe = await probeLazyModule(url, fetchImpl);
    if (!probe.ok) {
      rememberFailedModuleUrl(url);
      const reason = probe.reason ?? (probe.status == null ? 'network' : 'http');
      const message =
        reason === 'network'
          ? `Lazy chunk unreachable (network): ${url}`
          : `Lazy chunk not found (HTTP ${probe.status}): ${url}`;
      throw new LazyChunkError(message, {
        url,
        status: probe.status,
        reason,
        retry,
      });
    }
  }

  try {
    return await lazy();
  } catch (err) {
    if (url) rememberFailedModuleUrl(url);
    if (!headCheck || err instanceof LazyChunkError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new LazyChunkError(message || 'Failed to load lazy component', {
      url: url ?? '',
      status: null,
      reason: 'import',
      retry,
      cause: err,
    });
  }
}

/**
 * Register a RouterView retry handler (clear cache + bump generation).
 * @returns unregister function
 * @internal
 */
export function registerLazyRetryHandler(handler: LazyRetryHandler): () => void {
  lazyRetryHandlers.add(handler);
  return () => {
    lazyRetryHandlers.delete(handler);
  };
}

/**
 * Retry all registered lazy loads (HEAD probe again, then `import()`).
 * Intended for Retry buttons in the RouterView `error` snippet.
 */
export function retryLazyLoad(): void {
  for (const handler of [...lazyRetryHandlers]) {
    handler();
  }
}

/** Clear retry handlers (tests). @internal */
export function clearLazyRetryHandlers(): void {
  lazyRetryHandlers.clear();
}

/**
 * Best-effort: re-fetch failed chunk URLs with `cache: 'reload'` so a good
 * response can overwrite WKWebView's bad cached failure before hard reload.
 * Always settles (per-URL errors ignored); drains the registry.
 */
export async function revalidateFailedModules(
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = REVALIDATE_TIMEOUT_MS
): Promise<void> {
  const urls = drainFailedModuleUrls();
  if (urls.length === 0 || typeof fetchImpl !== 'function') return;

  const work = Promise.all(
    urls.map(async (url) => {
      const absolute = toAbsoluteModuleUrl(url);
      try {
        await fetchImpl(absolute, { cache: 'reload', credentials: 'same-origin' });
      } catch {
        // Network still down or opaque failure — hard reload proceeds anyway.
      }
    })
  );

  if (timeoutMs <= 0) {
    await work;
    return;
  }

  await Promise.race([
    work,
    new Promise<void>((resolve) => {
      setTimeout(resolve, timeoutMs);
    }),
  ]);
}
