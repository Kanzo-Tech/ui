/**
 * loaders.gl's `RequestScheduler`, issuing a **batch** where it issues a request, with one slot:
 * DuckDB-WASM is one worker behind one port, so a second statement queues behind the first rather
 * than overlapping it, and fossil reads a run of consecutive tiles as one statement only when it is
 * handed them in one call (`/docs/design/graph`, *one batch in flight*).
 *
 * Priorities are asked again each time a slot frees, the debounce settles or `prune` runs. A negative
 * priority is a request nobody wants any more: queued, it resolves `null` without ever being issued;
 * in flight, its batch is aborted only once no request in it is wanted — a batch that still answers
 * someone finishes, and answers everyone in it.
 */

/** A request's answer, its batch's failure, or `null` when it was never issued or was aborted. */
export type Outcome<R> = { readonly value: R } | { readonly error: unknown } | null;

interface Request<T, R> {
  readonly handle: T;
  readonly priority: (handle: T) => number;
  readonly resolve: (outcome: Outcome<R>) => void;
  settled: boolean;
  dropped: boolean;
}

interface Flight<T, R> {
  readonly requests: readonly Request<T, R>[];
  readonly controller: AbortController;
}

export interface SchedulerOptions<T, R> {
  /** One call for a batch: an answer per handle, in the order given. */
  run: (handles: readonly T[], signal: AbortSignal) => Promise<readonly R[]>;
  /** Batches running at once. */
  maxRequests?: number;
  /** Quiet time, in milliseconds, before the queue is issued — a pan settles before it asks. */
  debounceTime?: number;
}

export class RequestScheduler<T, R> {
  readonly #run: SchedulerOptions<T, R>["run"];
  readonly #max: number;
  readonly #debounce: number;
  #queue: Request<T, R>[] = [];
  #flights = new Set<Flight<T, R>>();
  #timer: ReturnType<typeof setTimeout> | null = null;

  constructor({ debounceTime = 0, maxRequests = 1, run }: SchedulerOptions<T, R>) {
    this.#run = run;
    this.#max = maxRequests;
    this.#debounce = debounceTime;
  }

  schedule(handle: T, priority: (handle: T) => number): Promise<Outcome<R>> {
    return new Promise((resolve) => {
      this.#queue.push({ handle, priority, resolve, settled: false, dropped: false });
      this.#wake();
    });
  }

  /** How many requests are queued, and how many batches are running. */
  get size(): { queued: number; active: number } {
    return { queued: this.#queue.length, active: this.#flights.size };
  }

  /** The caller no longer wants `handle`'s answer: it resolves `null` now, wherever it is. */
  cancel(handle: T): void {
    this.#queue = this.#queue.filter((request) => {
      if (request.handle !== handle) return true;
      settle(request, null);
      return false;
    });
    for (const flight of this.#flights) {
      for (const request of flight.requests) {
        if (request.handle !== handle) continue;
        request.dropped = true;
        settle(request, null);
      }
    }
    this.prune();
  }

  /** Drops queued requests nobody wants, and aborts a batch in which nobody wants anything. */
  prune(): void {
    this.#queue = this.#queue.filter((request) => {
      if (request.priority(request.handle) >= 0) return true;
      settle(request, null);
      return false;
    });
    for (const flight of this.#flights) {
      const wanted = flight.requests.some((r) => !r.dropped && r.priority(r.handle) >= 0);
      if (!wanted) flight.controller.abort();
    }
  }

  /** Every queued request resolves `null`, and every running batch is aborted. */
  clear(): void {
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = null;
    for (const request of this.#queue) settle(request, null);
    this.#queue = [];
    for (const flight of this.#flights) flight.controller.abort();
  }

  #wake(): void {
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      this.#timer = null;
      this.#issue();
    }, this.#debounce);
  }

  #issue(): void {
    this.prune();
    if (this.#flights.size >= this.#max || this.#queue.length === 0) return;
    const ranked = this.#queue.map((request) => ({ request, priority: request.priority(request.handle) }));
    ranked.sort((a, b) => a.priority - b.priority);
    this.#queue = [];
    void this.#fly({ requests: ranked.map(({ request }) => request), controller: new AbortController() });
  }

  async #fly(flight: Flight<T, R>): Promise<void> {
    this.#flights.add(flight);
    const { controller, requests } = flight;
    try {
      const answers = await this.#run(
        requests.map((request) => request.handle),
        controller.signal,
      );
      if (answers.length !== requests.length) {
        throw new Error(`a batch of ${requests.length} was answered with ${answers.length}`);
      }
      requests.forEach((request, i) => settle(request, controller.signal.aborted ? null : { value: answers[i] as R }));
    } catch (error) {
      for (const request of requests) settle(request, controller.signal.aborted ? null : { error });
    } finally {
      this.#flights.delete(flight);
      if (this.#queue.length > 0) this.#issue();
    }
  }
}

function settle<T, R>(request: Request<T, R>, outcome: Outcome<R>): void {
  if (request.settled) return;
  request.settled = true;
  request.resolve(outcome);
}
