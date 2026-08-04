"use client";

import { MosaicClient, type Coordinator, type Query } from "@kanzo-tech/ui/analytics";

/**
 * One unfiltered read of a relation, as a throwaway client.
 *
 * A client rather than a bare `coordinator.query()`, which is the rule `useChartQuery` states: a
 * widget that queries outside the client protocol drifts out of the crossfilter. Sometimes the drift
 * is exactly what you want — a fixed topology to draw, the ids failing a shape — and then the client
 * disconnects as soon as it has answered.
 */
/**
 * `build` may return a raw SQL string as well as a `Query`.
 *
 * Mosaic executes whatever a client's `query()` hands back, and not every read is expressible with
 * the builder — a windowed CTE that numbers its own rows is the case that forced this. Narrowing it
 * to `Query` was describing the builder rather than the protocol.
 */
export function onceQuery(
  coordinator: Coordinator,
  build: () => Query | string,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const client = new (class extends MosaicClient {
      override query() {
        return build();
      }
      override queryResult(data: unknown): this {
        resolve(data);
        queueMicrotask(() => coordinator.disconnect(this));
        return this;
      }
      override queryError(error: Error): this {
        reject(error);
        queueMicrotask(() => coordinator.disconnect(this));
        return this;
      }
    })();
    coordinator.connect(client);
  });
}
