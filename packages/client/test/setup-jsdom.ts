/**
 * Vitest setup (runs in every environment; the stub is a no-op outside
 * jsdom). 0.1.7: the upstream `Tooltip` primitive sizes and reveals itself
 * through a `ResizeObserver` (test-use ui-primitives src, loaded via the
 * vitest source map): the bubble mounts `visibility: hidden` and only the
 * first observer callback (`borderBoxSize`) flips it visible. jsdom ships
 * neither ResizeObserver nor a layout, so provide a stub that invokes the
 * callback synchronously on `observe` with a nominal box — synchronous
 * because the specs drive the show path through synchronous `act` + fake
 * timers (the real observer's microtask batch would land after the
 * assertion). The 0.1.5 primitives used no observer, hence no setup was
 * needed before the 0.1.7-rc.1 upgrade (U5).
 */
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    private readonly callback: (
      entries: ReadonlyArray<{ target: Element; borderBoxSize: ReadonlyArray<{ inlineSize: number; blockSize: number }> }>,
    ) => void

    constructor(
      callback: (
        entries: ReadonlyArray<{ target: Element; borderBoxSize: ReadonlyArray<{ inlineSize: number; blockSize: number }> }>,
      ) => void,
    ) {
      this.callback = callback
    }

    observe(target: Element): void {
      this.callback([{ target, borderBoxSize: [{ inlineSize: 120, blockSize: 24 }] }])
    }

    unobserve(_target: Element): void {}

    disconnect(): void {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof globalThis.ResizeObserver
}
