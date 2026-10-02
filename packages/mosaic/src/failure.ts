import { QueryError } from "@uwdata/mosaic-core";

/**
 * **What a query threw, from what the coordinator hands a client.** From mosaic-core 0.30 a
 * client's `queryError` receives `new QueryError(err, query)`: a fresh `Error` whose message is the
 * original's with the SQL appended, holding the original as `cause` — so its `code` and `data` are
 * one level down, and a host keying on the code finds none. Every `queryError` in this library
 * hands its `onFailure` this instead, the value as it was thrown. A non-`Error` thrown value arrives
 * as mosaic-core made it, an `Error` of its `String`.
 *
 * `coordinator.query` needs none of this: it rejects with what the connector threw, unwrapped.
 */
export function queryFailure(error: unknown): unknown {
  return error instanceof QueryError ? error.cause : error;
}
