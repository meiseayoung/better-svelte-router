/** App-managed memory stack snapshot (library does not persist this). */
export const STACK_KEY = 'bsr-memory-reload-demo-stack';

export interface StackSnapshot {
  entries: string[];
  index: number;
}

export function loadStackSnapshot(): StackSnapshot | null {
  try {
    const raw = sessionStorage.getItem(STACK_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(STACK_KEY);
    const parsed = JSON.parse(raw) as Partial<StackSnapshot>;
    if (!Array.isArray(parsed.entries) || typeof parsed.index !== 'number') {
      return null;
    }
    return { entries: parsed.entries, index: parsed.index };
  } catch {
    return null;
  }
}

export function saveStackSnapshot(entries: string[], index: number): void {
  sessionStorage.setItem(STACK_KEY, JSON.stringify({ entries, index } satisfies StackSnapshot));
}
