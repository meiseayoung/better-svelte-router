/**
 * Thin wrappers around the History API, following vue-router's pattern:
 * try pushState/replaceState first; on failure fall back to location.assign/replace.
 *
 * Hash-mode replace skips replaceState only on the same old Android WebKits that
 * vue-router 3 blacklists in `supportsPushState` (Android 2.x / 4.0 Mobile Safari
 * without Chrome). Modern Android uses replaceState like other browsers.
 */

/**
 * Whether hash-mode `history.replaceState` is reliable for updating the
 * session-history entry (back-forward list + preserving `history.state`).
 *
 * Aligned with vue-router 3 `supportsPushState`: only old Android 2.x / 4.0
 * Mobile Safari (no Chrome) is treated as unreliable.
 */
export function supportsReliableHashReplaceState(): boolean {
  if (typeof window === 'undefined') return false;
  if (!window.history || typeof window.history.replaceState !== 'function') {
    return false;
  }
  const ua = window.navigator?.userAgent ?? '';
  // Same UA check as vue-router 3 src/util/push-state.js `supportsPushState`.
  if (
    (ua.indexOf('Android 2.') !== -1 || ua.indexOf('Android 4.0') !== -1) &&
    ua.indexOf('Mobile Safari') !== -1 &&
    ua.indexOf('Chrome') === -1 &&
    ua.indexOf('Windows Phone') === -1
  ) {
    return false;
  }
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
