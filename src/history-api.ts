/**
 * Thin wrappers around the History API, following vue-router's pattern:
 * try pushState/replaceState first; on failure fall back to location.assign/replace.
 *
 * Hash-mode replace on Android additionally skips replaceState entirely — those
 * WebViews often accept replaceState without updating the back-forward list.
 */

/**
 * Whether hash-mode `history.replaceState` is reliable for updating the
 * session-history entry (back-forward list + preserving `history.state`).
 *
 * Android is treated as unreliable (modern WebViews included), similar in spirit
 * to vue-router 3 blacklisting buggy Android UAs from `supportsPushState`.
 */
export function supportsReliableHashReplaceState(): boolean {
  if (typeof window === 'undefined') return false;
  if (!window.history || typeof window.history.replaceState !== 'function') {
    return false;
  }
  const ua = window.navigator?.userAgent ?? '';
  if (/Android/i.test(ua)) return false;
  return true;
}

/**
 * Replace the current history entry's URL, preserving existing `history.state`
 * (including the router's position tag) and refreshing `timestamp`.
 *
 * On failure (e.g. Safari's 100-call quota), falls back to `location.replace`.
 */
export function replaceHistoryUrl(
  url: string,
  stateExtra: Record<string, unknown> = {}
): void {
  const prev = (window.history.state as Record<string, unknown> | null) ?? {};
  try {
    window.history.replaceState(
      { ...prev, ...stateExtra, timestamp: Date.now() },
      '',
      url
    );
  } catch {
    window.location.replace(url);
  }
}

/**
 * Push a new history entry. On failure, falls back to `location.assign`.
 */
export function pushHistoryUrl(
  url: string,
  stateExtra: Record<string, unknown> = {}
): void {
  try {
    window.history.pushState({ ...stateExtra, timestamp: Date.now() }, '', url);
  } catch {
    window.location.assign(url);
  }
}
