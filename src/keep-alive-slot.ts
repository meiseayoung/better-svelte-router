/**
 * Capture Svelte's `$$anchor` (zero template DOM) for a KeepAlive cache slot.
 */
import type { ComponentInternals } from 'svelte';
import Runtime from './keep-alive-slot-runtime.svelte';

export default function KeepAliveSlot(
  $$anchor: ComponentInternals,
  $$props: Record<string, unknown>
): void {
  $$props.__bsrAnchor = $$anchor as unknown as Node;
  Runtime($$anchor, $$props);
}
