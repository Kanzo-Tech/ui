"use client";

import { MosaicClient } from "@uwdata/mosaic-core";
import type { Coordinator } from "@kanzo-tech/ui/analytics";
import type { Query } from "@uwdata/mosaic-sql";

/**
 * One unfiltered read of a relation, as a throwaway client.
 *
 * A client rather than a bare `coordinator.query()`, which is the rule `useChartQuery` states: a
 * widget that queries outside the client protocol drifts out of the crossfilter. Sometimes the drift
 * is exactly what you want — a fixed topology to draw, the ids failing a shape — and then the client
 * disconnects as soon as it has answered.
 */
export function onceQuery(coordinator: Coordinator, build: () => Query): Promise<unknown> {
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
