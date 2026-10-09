/**
 * The harness model, in Angular CDK's shape: an environment finds a component's host and hands it to
 * a harness, and the harness operates it through a `Handle` that does not know which runner it is in.
 * `playwright(page)` and `dom(container)` are the two environments; every harness runs in both.
 */

/**
 * **How a harness finds an element, in Testing Library's order.** A role and its accessible name
 * first; then text; a CSS selector — a `data-*` attribute — only where nothing accessible says it.
 * `has` keeps the elements that contain a match of its own.
 */
export type By =
  | { role: string; name?: string | RegExp; has?: By }
  | { text: string | RegExp }
  | { css: string };

/** The modifier keys a pointer gesture is made with, by their `KeyboardEvent.key`. */
export type Modifier = "Alt" | "Control" | "Meta" | "Shift";

/** A point in the viewport's CSS pixels: `clientX`, `clientY`. */
export type Point = [number, number];

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One element, as the environment reaches it. Every method acts now and resolves when it is done. */
export interface Handle {
  /** The descendants that match, in document order. */
  find(by: By): Promise<Handle[]>;
  /** The text a reader sees, whitespace collapsed. */
  text(): Promise<string>;
  attribute(name: string): Promise<string | null>;
  /** The element's box in the viewport. */
  rect(): Promise<Rect>;
  /** Scrolls the element into the viewport, so a point measured on it can be pressed. */
  reveal(): Promise<void>;
  /** A click on the element's centre, or at a point in the viewport. */
  click(options?: { at?: Point; with?: readonly Modifier[] }): Promise<void>;
  /** Press at the first point, move through the rest, release at the last — one pointer, held. */
  drag(path: readonly Point[], options?: { with?: readonly Modifier[] }): Promise<void>;
  /** Replace a text field's value, as typing it would. */
  fill(value: string): Promise<void>;
  press(key: string): Promise<void>;
  /**
   * Runs `fn` where the element lives — the page, for Playwright — with the element and `arg`.
   * `fn` is sent as source text, so it closes over nothing; `arg` must survive `structuredClone`.
   */
  evaluate<A, R>(fn: (element: Element, arg: A) => R, arg: A): Promise<R>;
}

/** What an environment is built from: the root every search starts at, and how to wait. */
export interface Driver {
  root: Handle;
  /**
   * Resolves with the first truthy answer of `probe`, asked again until `timeout`, and rejects with
   * `what` after it. The only way a harness waits: on a state, never on a time.
   */
  until<T>(probe: () => Promise<T | null | undefined | false>, what: string): Promise<T>;
}

/** A harness class: how its host is found, and how to build one over it. */
export interface HarnessType<H extends ComponentHarness> {
  new (env: HarnessEnvironment, host: Handle): H;
  readonly by: By;
}

/** A harness class narrowed to one of its hosts — what `Harness.with(...)` returns. */
export interface HarnessQuery<H extends ComponentHarness> {
  readonly type: HarnessType<H>;
  readonly by: By;
}

export class HarnessEnvironment {
  constructor(private readonly driver: Driver) {}

  /** The first host of `query` under the root, waited for until it is in the document. */
  harness<H extends ComponentHarness>(query: HarnessType<H> | HarnessQuery<H>, within: Handle = this.driver.root): Promise<H> {
    const { type, by } = resolve(query);
    return this.until(async () => (await within.find(by))[0], `no ${named(by)} in the document`).then(
      (host) => new type(this, host),
    );
  }

  /** Every host of `query` under the root now, in document order — none is not an error. */
  async harnesses<H extends ComponentHarness>(query: HarnessType<H> | HarnessQuery<H>, within: Handle = this.driver.root): Promise<H[]> {
    const { type, by } = resolve(query);
    return (await within.find(by)).map((host) => new type(this, host));
  }

  /** The root every search starts at: the page, or the container `dom` was given. */
  get root(): Handle {
    return this.driver.root;
  }

  until<T>(probe: () => Promise<T | null | undefined | false>, what: string): Promise<T> {
    return this.driver.until(probe, what);
  }
}

const resolve = <H extends ComponentHarness>(query: HarnessType<H> | HarnessQuery<H>): HarnessQuery<H> =>
  "type" in query ? query : { type: query, by: query.by };

/** A `By` in words, for a wait that ran out: class names do not survive a minifier, so it is not named. */
const named = (by: By): string =>
  "role" in by
    ? `${by.role}${by.name === undefined ? "" : ` "${String(by.name)}"`}${by.has ? ` holding ${named(by.has)}` : ""}`
    : "text" in by
      ? `text "${String(by.text)}"`
      : by.css;

/**
 * **A component, as a test drives it** — Angular CDK's `ComponentHarness`. A subclass names how its
 * host is found in `static by`, and every method is async and waits on a state the component
 * exposes, never on a time.
 */
export abstract class ComponentHarness {
  constructor(
    protected readonly env: HarnessEnvironment,
    readonly host: Handle,
  ) {}

  /** A harness for a part inside this one's host. */
  protected locate<H extends ComponentHarness>(query: HarnessType<H> | HarnessQuery<H>): Promise<H> {
    return this.env.harness(query, this.host);
  }

  /** The first descendant of the host that matches, waited for. */
  protected async one(by: By, what: string, within: Handle = this.host): Promise<Handle> {
    return this.env.until(async () => (await within.find(by))[0], what);
  }

  /** Whether the host, or `element`, is `aria-busy`. */
  protected async ariaBusy(element: Handle = this.host): Promise<boolean> {
    return (await element.attribute("aria-busy")) === "true";
  }
}

/** The modifiers a key list names, as the four booleans a DOM event carries. */
export function modifierFlags(keys: readonly Modifier[] = []) {
  return {
    altKey: keys.includes("Alt"),
    ctrlKey: keys.includes("Control"),
    metaKey: keys.includes("Meta"),
    shiftKey: keys.includes("Shift"),
  };
}
