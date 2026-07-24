/**
 * Experimental Vue-style `<KeepAlive>` entry: capture `$$anchor`, emit zero
 * wrapper DOM. Slots park/restore before this anchor (same idea as route
 * `KeepAliveBoundary`).
 */
import type { ComponentInternals } from 'svelte';
import Runtime from './keep-alive-component-runtime.svelte';

export default function KeepAlive(
  $$anchor: ComponentInternals,
  $$props: Record<string, unknown>
): void {
  $$props.__bsrAnchor = $$anchor as unknown as Node;
  Runtime($$anchor, $$props);
}
