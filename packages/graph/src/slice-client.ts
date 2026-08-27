"use client";

import { MosaicClient } from "@kanzo-tech/mosaic";
import type { Coordinator, FilterExpr, Selection } from "@kanzo-tech/mosaic";
import { SUPERSEDED } from "./bounded";

/**
 * One read of a corpus, as a client of the page's coordinator.
 *
 * **A source used to query outside the protocol, and that was the whole defect.** `onceQuery`
 * connected a throwaway `MosaicClient` per query, took the answer and disconnected — a second query
 * path beside the one every chart on the page uses, and one that no selection could reach. So a
 * graph inside a crossfilter had to be joined to it from outside: something else asked which ids
 * survived, and the canvas painted grey over the ones that had not. Two round trips, a full scan and
 * a texture upload, to express a `WHERE` clause.
 *
 * A read is the same protocol a histogram uses, in the two directions it runs:
 *
 *   `query(filter)` — the coordinator hands us the page's predicate and we build the SQL around it,
 *     so what comes back is *what survives* rather than everything with a mask beside it.
 *   `queryResult(data)` — the answer, whether we asked for it or the page's filters moved.
 *
 * **The second direction is the one that pays.** A selection change re-runs this read with the new
 * predicate and no camera involvement at all: the coordinator already walks its clients on every
 * selection update, so a graph that is one of them is re-queried the way a plot is. Nothing
 * subscribes to anything, and there is no window where the picture and the page's filters disagree.
 *
 * **Not `makeClient`.** That helper takes a `query` and a `queryResult` as options and is right for a
 * client with one standing question. A slice is two reads that have to arrive together, over a
 * question the camera rewrites — so what is needed is a handle the source can re-aim, which is a
 * class with a method rather than a closure fixed at construction.
 */
export class SliceRead extends MosaicClient {
  #coordinator: Coordinator;
  #build: ((filter: FilterExpr) => string) | null = null;
  #settle: { resolve: (data: unknown) => void; reject: (error: unknown) => void } | null = null;
  #onAnswer: ((data: unknown) => void) | null = null;
  #connected = false;

  /**
   * @param filterBy The crossfilter this read lives inside, if any. The unfiltered reads — how big
   *   the corpus is, where it is, what its tile footers say — take none: those are facts about the
   *   corpus rather than about what the page is looking at, and filtering them would make
   *   "20,000 of 1,000,000" a fraction of itself.
   */
  constructor(coordinator: Coordinator, filterBy?: Selection) {
    super(filterBy);
    this.#coordinator = coordinator;
  }

  /**
   * Pre-aggregation cannot help here, and saying so costs a getter instead of a query.
   *
   * `preaggColumns` reaches the same "no" by calling `query()` and finding a string where it wanted a
   * `SelectQuery` — a slice is a CTE over window functions and is not expressible in the builder —
   * but it calls `query()` to find out, on every selection change. The claim is true rather than
   * defensive: the filter decides which rows are numbered, so it moves the groupby domain outright,
   * which is exactly what this flag is asked about.
   */
  override get filterStable(): boolean {
    return false;
  }

  /**
   * What the rest of the page is filtering by, right now.
   *
   * The same value the coordinator would hand `query()`. A source that needs the predicate *before*
   * it can build SQL — because it has to know which relation to point at, or because it is assembling
   * one answer out of two reads — asks here rather than reaching into the selection and re-deriving
   * the client exemption by hand.
   */
  get predicate(): FilterExpr {
    return this.filterBy?.predicate(this) ?? [];
  }

  /**
   * Ask, and *keep* the question. The coordinator issues, consolidates, caches and re-runs it.
   *
   * `build` is retained rather than consumed, because it is the standing question: after the page
   * filters something the camera is still over the same rectangle, so the coordinator re-running this
   * with a new predicate is precisely the query anybody would have written by hand.
   */
  ask(build: (filter: FilterExpr) => string): Promise<unknown> {
    this.#build = build;
    const answer = new Promise<unknown>((resolve, reject) => {
      // A superseded question is settled rather than dropped. The camera moves faster than DuckDB
      // answers, so the previous promise has a caller awaiting it; leaving it unsettled leaves that
      // caller's `finally` unrun and the loop reporting a query in flight for the rest of the session.
      this.#settle?.reject(SUPERSEDED);
      this.#settle = { resolve, reject };
    });
    if (this.#connected) {
      this.requestQuery();
    } else {
      // Connected on first use rather than at construction, and that is what keeps a null question
      // out of the protocol: a connected client is one the coordinator may re-query on any selection
      // change, and before the first camera question there is nothing to re-query it *with*.
      // `connect` initializes, and initializing requests a query — so the opening read is issued by
      // the coordinator's own lifecycle rather than beside it.
      this.#connected = true;
      this.#coordinator.connect(this);
    }
    return answer;
  }

  /**
   * Where an answer goes when nobody asked for it — which is the page's filters moving.
   *
   * Told apart from a pull by which of the two is outstanding rather than by a flag, so the two
   * cannot disagree: an answer settles the promise when one is waiting, and is reported here when
   * none is.
   */
  set onAnswer(handle: ((data: unknown) => void) | null) {
    this.#onAnswer = handle;
  }

  /** Let go: no more queries, and the coordinator stops walking us on every selection change. */
  release(): void {
    this.#settle?.reject(SUPERSEDED);
    this.#settle = null;
    this.#onAnswer = null;
    this.#build = null;
    if (this.#connected) {
      this.#connected = false;
      this.#coordinator.disconnect(this);
    }
  }

  override query(filter: FilterExpr = []): string | null {
    return this.#build?.(filter) ?? null;
  }

  override queryResult(data: unknown): this {
    const settle = this.#settle;
    this.#settle = null;
    if (settle) settle.resolve(data);
    else this.#onAnswer?.(data);
    return this;
  }

  override queryError(error: Error): this {
    const settle = this.#settle;
    this.#settle = null;
    if (settle) settle.reject(error);
    return this;
  }
}
