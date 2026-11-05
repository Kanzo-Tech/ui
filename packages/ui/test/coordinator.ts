import { QueryError, type Coordinator, type MosaicClient } from "@uwdata/mosaic-core";
import { answerOf } from "./engine";

export type Row = Record<string, unknown>;

/** What `SUMMARIZE` answers over the sightings: a categorical field and a numeric one. */
export const FIELDS: Row[] = [
  { column_name: "region", column_type: "VARCHAR", approx_unique: 4, min: "a", max: "d", count: 10 },
  { column_name: "bounty", column_type: "DOUBLE", approx_unique: 9, min: 1, max: 9, count: 10 },
];

/**
 * jsdom has no DuckDB, so a test's coordinator is a double that plays the moves a real one makes
 * against a client: connect, answer `requestQuery` with `answer`'s rows (a throw reaches
 * `queryError` as a `QueryError`, as `Coordinator.updateClient` wraps it), forget on disconnect, and
 * re-ask when the client's `filterBy` moves. The re-ask is `updateSelection`'s: a disabled client
 * keeps the request until enabled, and a client the active clause exempts is left alone. `query`
 * answers `SUMMARIZE` with `fields`.
 */
export function stubCoordinator(answer: (sql: string) => Row[] = () => [], fields?: Row[]) {
  const connected = new Set<MosaicClient>();
  const queries: string[] = [];
  const listeners = new Map<MosaicClient, () => void>();
  const coordinator = {
    query: async (sql: string) => (fields && sql.startsWith("SUMMARIZE") ? answerOf(fields) : []),
    connect(client: MosaicClient) {
      connected.add(client);
      client.coordinator = coordinator as unknown as Coordinator;
      client.initialize();
      const selection = client.filterBy;
      if (!selection) return;
      const rerun = () => {
        if (!client.enabled) return void client.requestQuery();
        const filter = selection.predicate(client);
        if (!filter) return;
        void coordinator.requestQuery(client, client.query(filter));
      };
      selection.addEventListener("value", rerun);
      listeners.set(client, rerun);
    },
    disconnect(client: MosaicClient) {
      connected.delete(client);
      const rerun = listeners.get(client);
      if (rerun) client.filterBy?.removeEventListener("value", rerun);
      listeners.delete(client);
      client.coordinator = null;
    },
    requestQuery(client: MosaicClient, query: unknown) {
      if (query == null) return Promise.resolve();
      const sql = String(query);
      queries.push(sql);
      return Promise.resolve()
        .then(() => answer(sql))
        .then(
          (rows) => client.queryResult(rows).update(),
          (error: unknown) => client.queryError(new QueryError(error, sql)),
        );
    },
    clear() {},
  };
  return { coordinator: coordinator as unknown as Coordinator, connected, queries };
}
