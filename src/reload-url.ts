/**
 * Document-level query key used by `reload()` so Android WebView sees a URL
 * change and actually navigates. Stripped from history-mode route search and
 * scrubbed from the address bar after boot.
 */
export const RELOAD_CACHE_BUST_PARAM = '_bsr_reload';

/** Ensures bust values stay unique even when `Date.now()` collides. */
let reloadBustSeq = 0;

/** Remove the reload cache-bust param from a document search string. */
export function stripReloadCacheBustSearch(search: string): string {
  if (!search || !search.includes(RELOAD_CACHE_BUST_PARAM)) return search;
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  params.delete(RELOAD_CACHE_BUST_PARAM);
  const next = params.toString();
  return next ? `?${next}` : '';
}

/** Strip `_bsr_reload` from the document URL (everything before `#`). */
function stripBustFromDocumentBase(base: string): string {
  const q = base.indexOf('?');
  if (q < 0) return base;
  return `${base.slice(0, q)}${stripReloadCacheBustSearch(base.slice(q))}`;
}

/**
 * Append a cache-busting query param to the document URL (before `#`).
 * Replaces any prior `_bsr_reload` so repeated `reload()` calls do not accumulate.
 * Value is `${now}_${seq}` so same-millisecond calls still change the URL.
 * Hash/memory route queries live in the fragment and are left unchanged.
 *
 * @param now - timestamp portion (defaults to Date.now(); injectable for tests)
 * @param seq - sequence portion (defaults to an incrementing counter)
 */
export function buildHardReloadUrl(
  url: string,
  now: number = Date.now(),
  seq: number = ++reloadBustSeq
): string {
  const hashIndex = url.indexOf('#');
  const rawBase = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const hash = hashIndex === -1 ? '' : url.slice(hashIndex);
  const base = stripBustFromDocumentBase(rawBase);
  const bust = `${RELOAD_CACHE_BUST_PARAM}=${now}_${seq}`;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}${bust}${hash}`;
}

/**
 * Best-effort: remove `_bsr_reload` from the current address bar via replaceState
 * so the bust does not linger after a hard reload. Does not change the route.
 */
export function scrubReloadCacheBustFromLocation(): void {
  if (typeof window === 'undefined') return;
  const href = window.location.href;
  if (!href.includes(RELOAD_CACHE_BUST_PARAM)) return;

  const hashIndex = href.indexOf('#');
  const rawBase = hashIndex === -1 ? href : href.slice(0, hashIndex);
  const hash = hashIndex === -1 ? '' : href.slice(hashIndex);
  const cleaned = `${stripBustFromDocumentBase(rawBase)}${hash}`;
  if (cleaned === href) return;

  try {
    const prev = (window.history.state as Record<string, unknown> | null) ?? {};
    window.history.replaceState(prev, '', cleaned);
  } catch {
    // Address-bar cleanup is best-effort (quota / sandboxed WebViews).
  }
}
