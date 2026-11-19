/** The two reads of a load, in the order they depend on each other. */
export type Kind = "geometry" | "encoding";

/**
 * **The reads of one load**: one in flight per kind, all under one signal. A newer read of a kind
 * makes an older one's answer stale — it is dropped, not applied — and `stop` ends them all: the signal
 * aborts, every answer still to come is stale, and the next read gets a signal of its own.
 */
export function createReads() {
  const ticket: Record<Kind, number> = { geometry: 0, encoding: 0 };
  const pending: Record<Kind, boolean> = { geometry: false, encoding: false };
  let controller = new AbortController();
  return {
    /** Whether any read is still to answer. */
    busy: () => pending.geometry || pending.encoding,
    run<T>(kind: Kind, ask: (signal: AbortSignal) => Promise<T>, done: (value: T) => void, failed: (error: unknown) => void): void {
      const mine = ++ticket[kind];
      pending[kind] = true;
      const settle = (apply: () => void) => () => {
        if (ticket[kind] !== mine) return;
        pending[kind] = false;
        apply();
      };
      ask(controller.signal).then(
        (value) => settle(() => done(value))(),
        (error: unknown) => settle(() => failed(error))(),
      );
    },
    stop(): void {
      controller.abort();
      controller = new AbortController();
      for (const kind of Object.keys(ticket) as Kind[]) {
        ticket[kind]++;
        pending[kind] = false;
      }
    },
  };
}
