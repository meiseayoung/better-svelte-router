import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import KeepAliveHarness from './fixtures/KeepAliveHarness.svelte';
import PageA from './fixtures/KeepAlivePageA.svelte';

async function tick(times = 3) {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
  }
  flushSync();
}

describe('KeepAlive runtime', () => {
  let target: HTMLElement;
  let instance: Record<string, any> | null = null;

  beforeEach(() => {
    target = document.createElement('div');
    document.body.appendChild(target);
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback) =>
        setTimeout(() => cb(performance.now()), 0) as unknown as number
    );
  });

  afterEach(() => {
    if (instance) {
      unmount(instance);
      instance = null;
    }
    target.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('preserves local state when switching this= components', async () => {
    instance = mount(KeepAliveHarness, { target, props: {} });
    await tick(5);

    const label = () => target.querySelector('[data-testid="label"]');
    const count = () => target.querySelector('[data-testid="count"]');
    const click = (id: string) => {
      (target.querySelector(`[data-testid="${id}"]`) as HTMLButtonElement).click();
      flushSync();
    };

    expect(label()?.textContent).toBe('A');
    click('inc');
    expect(count()?.textContent).toBe('1');

    click('goto-b');
    await tick(5);
    expect(label()?.textContent).toBe('B');

    click('goto-a');
    await tick(5);
    expect(label()?.textContent).toBe('A');
    expect(count()?.textContent).toBe('1');
  });

  it('uses explicit cacheKey for separate instances of the same component', async () => {
    instance = mount(KeepAliveHarness, { target, props: {} });
    await tick(5);

    const count = () => target.querySelector('[data-testid="count"]');
    const click = (id: string) => {
      (target.querySelector(`[data-testid="${id}"]`) as HTMLButtonElement).click();
      flushSync();
    };

    click('key-u1');
    await tick(5);
    expect(target.querySelector('[data-testid="label"]')?.textContent).toBe('A');
    click('inc');
    expect(count()?.textContent).toBe('1');

    click('key-u2');
    await tick(5);
    expect(count()?.textContent).toBe('0');

    click('key-u1');
    await tick(5);
    expect(count()?.textContent).toBe('1');
  });

  it('exclude prevents caching (remounts on return)', async () => {
    let mountTotal = 0;
    instance = mount(KeepAliveHarness, {
      target,
      props: {
        exclude: [PageA],
        onMountA: () => {
          mountTotal += 1;
        },
      },
    });
    await tick(5);

    const count = () => target.querySelector('[data-testid="count"]');
    const click = (id: string) => {
      (target.querySelector(`[data-testid="${id}"]`) as HTMLButtonElement).click();
      flushSync();
    };

    expect(target.querySelector('[data-testid="label"]')?.textContent).toBe('A');
    const mountsAfterFirst = mountTotal;
    expect(mountsAfterFirst).toBeGreaterThanOrEqual(1);

    click('inc');
    expect(count()?.textContent).toBe('1');

    click('goto-b');
    await tick(5);

    click('goto-a');
    await tick(5);

    expect(target.querySelector('[data-testid="label"]')?.textContent).toBe('A');
    expect(count()?.textContent).toBe('0');
    expect(mountTotal).toBeGreaterThan(mountsAfterFirst);
  });

  it('fires onActivated / onDeactivated around park', async () => {
    const activated: number[] = [];
    const deactivated: number[] = [];

    instance = mount(KeepAliveHarness, {
      target,
      props: {
        onActivatedA: (n: number) => activated.push(n),
        onDeactivatedA: (n: number) => deactivated.push(n),
      },
    });
    await tick(5);
    expect(activated.length).toBeGreaterThanOrEqual(1);

    const click = (id: string) => {
      (target.querySelector(`[data-testid="${id}"]`) as HTMLButtonElement).click();
      flushSync();
    };

    click('goto-b');
    await tick(5);
    expect(deactivated.length).toBeGreaterThanOrEqual(1);

    click('goto-a');
    await tick(5);
    expect(activated.length).toBeGreaterThanOrEqual(2);
  });
});
