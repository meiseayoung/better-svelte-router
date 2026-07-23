/**
 * Svelte 5 component entry: capture `$$anchor`, emit zero DOM nodes.
 * Passes RouterView's anchor so Runtime can park/restore against the same parent.
 */
import type { ComponentInternals } from 'svelte';
import Runtime from './keep-alive-runtime.svelte';

export default function KeepAliveBoundary(
  $$anchor: ComponentInternals,
  $$props: Record<string, unknown>
): void {
  $$props.__bsrAnchor = $$anchor as unknown as Node;
  Runtime($$anchor, $$props);
}
