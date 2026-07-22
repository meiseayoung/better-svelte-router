/**
 * Svelte 5 component entry: capture `$$anchor`, emit zero DOM nodes.
 * Runtime mounts the route tree off-document and moves nodes before the anchor.
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
