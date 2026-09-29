/**
 * loaders.gl's `RequestScheduler`, with one slot: DuckDB-WASM is one worker behind one port, so a
 * second statement queues behind the first rather than overlapping it (`/docs/design/graph`, the
 * filter rule's callout). What the scheduler spends its effort on is the order of the queue.
 *
 * Priorities are asked again each time a slot frees or the debounce settles. A negative priority is
 * a request nobody wants any more, and it resolves `null` without ever being issued; the rest go
 * lowest first.
 */

export interface RequestToken {
  done(): void;
}

interface Request<T> {
  readonly handle: T;
  readonly priority: (handle: T) => number;
  readonly resolve: (token: RequestToken | null) => void;
}

export interface SchedulerOptions {
  /** Requests running at once. */
  maxRequests?: number;
  /** Quiet time, in milliseconds, before the queue is issued — a pan settles before it asks. */
  debounceTime?: number;
}

export class RequestScheduler<T> {
  readonly #max: number;
  readonly #debounce: number;
  #queue: Request<T>[] = [];
  #active = 0;
  #timer: ReturnType<typeof setTimeout> | null = null;

  constructor({ debounceTime = 0, maxRequests = 1 }: SchedulerOptions = {}) {
    this.#max = maxRequests;
    this.#debounce = debounceTime;
  }

  /** Resolves with a token once the request may run, or `null` once nobody wants it. */
  schedule(handle: T, priority: (handle: T) => number): Promise<RequestToken | null> {
    return new Promise((resolve) => {
      this.#queue.push({ handle, priority, resolve });
      this.#wake();
    });
  }

  /** How many requests are queued, and how many are running. */
  get size(): { queued: number; active: number } {
    return { queued: this.#queue.length, active: this.#active };
  }

  /** Every queued request resolves `null`. Running ones finish on their own. */
  clear(): void {
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = null;
    for (const request of this.#queue) request.resolve(null);
    this.#queue = [];
  }

  #wake(): void {
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      this.#timer = null;
      this.#issue();
    }, this.#debounce);
  }

  #issue(): void {
    const ranked: { request: Request<T>; priority: number }[] = [];
    for (const request of this.#queue) {
      const priority = request.priority(request.handle);
      if (priority < 0) request.resolve(null);
      else ranked.push({ request, priority });
    }
    ranked.sort((a, b) => a.priority - b.priority);
    this.#queue = ranked.map(({ request }) => request);
    while (this.#active < this.#max && this.#queue.length > 0) {
      const request = this.#queue.shift() as Request<T>;
      this.#active += 1;
      let settled = false;
      request.resolve({
        done: () => {
          if (settled) return;
          settled = true;
          this.#active -= 1;
          if (this.#queue.length > 0) this.#issue();
        },
      });
    }
  }
}
