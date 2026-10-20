/**
 * The harness model, in Angular CDK's shape and with its names: an environment finds a component's
 * host and hands it to a harness, and the harness operates it through a `TestElement` that does not
 * know which runner it is in. `playwright(page)` and `dom(container)` are the two environments; every
 * harness runs in both. Where CDK has an operation, it has CDK's name; where it has none, or its
 * namesake does something else, it keeps its own (`/docs/design/testing#the-names-are-cdks`).
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

/** CDK's `ElementDimensions`: an element's box in the viewport, in CSS pixels. */
export interface ElementDimensions {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * One element, as the environment reaches it — CDK's `TestElement`. Every method acts now and
 * resolves when it is done.
 */
export interface TestElement {
  /** The descendants that match, in document order. */
  find(by: By): Promise<TestElement[]>;
  /** The text a reader sees, whitespace collapsed. */
  text(): Promise<string>;
  getAttribute(name: string): Promise<string | null>;
  /** The element's box in the viewport. */
  getDimensions(): Promise<ElementDimensions>;
  /** Scrolls the element into the viewport, so a point measured on it can be pressed. */
  reveal(): Promise<void>;
  /** A click on the element's centre, or at a point in the viewport. */
  click(options?: { at?: Point; with?: readonly Modifier[] }): Promise<void>;
  /** Press at the first point, move through the rest, release at the last — one pointer, held. */
  drag(path: readonly Point[], options?: { with?: readonly Modifier[] }): Promise<void>;
  /**
   * Replace a text field's value, as typing it would. Not CDK's `setInputValue`, which sets the
   * property and dispatches nothing: this is Playwright's `fill`.
   */
  fill(value: string): Promise<void>;
  /** Presses `key`, by its `KeyboardEvent.key`, on the element. */
  sendKeys(key: string): Promise<void>;
  /**
   * Runs `fn` where the element lives — the page, for Playwright — with the element and `arg`.
   * `fn` is sent as source text, so it closes over nothing; `arg` must survive `structuredClone`.
   */
  evaluate<A, R>(fn: (element: Element, arg: A) => R, arg: A): Promise<R>;
}

/** What an environment is built from: the root every search starts at, and how to wait. */
export interface Driver {
  root: TestElement;
  /**
   * Resolves with the first truthy answer of `probe`, asked again until `timeout`, and rejects with
   * `what` after it. The only way a harness waits: on a state, never on a time.
   */
  until<T>(probe: () => Promise<T | null | undefined | false>, what: string): Promise<T>;
}

/**
 * A harness class — CDK's `ComponentHarnessConstructor`: how its host is found, and how to build one
 * over it. `by` is a Testing Library query — role, name, text — where CDK's `hostSelector` is a CSS
 * selector, so it keeps its own name.
 */
export interface ComponentHarnessConstructor<H extends ComponentHarness> {
  new (env: HarnessEnvironment, host: TestElement): H;
  readonly by: By;
}

/** A harness class narrowed to one of its hosts — what `Harness.with(...)` returns. */
export interface HarnessQuery<H extends ComponentHarness> {
  readonly type: ComponentHarnessConstructor<H>;
  readonly by: By;
}

export class HarnessEnvironment {
  constructor(private readonly driver: Driver) {}

  /** The first host of `query` under the root, waited for until it is in the document. */
  getHarness<H extends ComponentHarness>(
    query: ComponentHarnessConstructor<H> | HarnessQuery<H>,
    within: TestElement = this.driver.root,
  ): Promise<H> {
    const { type, by } = resolve(query);
    return this.until(async () => (await within.find(by))[0], `no ${named(by)} in the document`).then(
      (host) => new type(this, host),
    );
  }

  /** Every host of `query` under the root now, in document order — none is not an error. */
  async getAllHarnesses<H extends ComponentHarness>(
    query: ComponentHarnessConstructor<H> | HarnessQuery<H>,
    within: TestElement = this.driver.root,
  ): Promise<H[]> {
    const { type, by } = resolve(query);
    return (await within.find(by)).map((host) => new type(this, host));
  }

  /** The root every search starts at: the page, or the container `dom` was given. */
  get rootElement(): TestElement {
    return this.driver.root;
  }

  until<T>(probe: () => Promise<T | null | undefined | false>, what: string): Promise<T> {
    return this.driver.until(probe, what);
  }

  /**
   * **What the scripted model `id` was asked**, every call's prompt flattened, in order: read off the
   * model the environment registered for `id` in `@kanzo-tech/llm/local`'s registry, the one the page
   * resolves every model through. None when no script was registered for `id`.
   */
  prompts(id: string): Promise<string[]> {
    return this.driver.root.evaluate((_, model) => {
      const registry = (globalThis as { [key: symbol]: { languageModels: Map<string, { model: { prompts?: string[] } }> } | undefined })[
        Symbol.for("@kanzo-tech/llm/local")
      ];
      return [...(registry?.languageModels.get(model)?.model.prompts ?? [])];
    }, id);
  }
}

const resolve = <H extends ComponentHarness>(query: ComponentHarnessConstructor<H> | HarnessQuery<H>): HarnessQuery<H> =>
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
    readonly host: TestElement,
  ) {}

  /**
   * CDK's `locatorFor`: **the function that finds `query` inside the host**, waited for — a harness
   * for a part when `query` is a harness class or its `with(...)`, an element when it is a `By`. The
   * function takes the element to search instead of the host; a wait that runs out says `what`, or
   * the query in words.
   */
  protected locatorFor<H extends ComponentHarness>(
    query: ComponentHarnessConstructor<H> | HarnessQuery<H>,
  ): (within?: TestElement) => Promise<H>;
  protected locatorFor(query: By, what?: string): (within?: TestElement) => Promise<TestElement>;
  protected locatorFor<H extends ComponentHarness>(
    query: ComponentHarnessConstructor<H> | HarnessQuery<H> | By,
    what?: string,
  ): (within?: TestElement) => Promise<H | TestElement> {
    if (typeof query === "function" || "type" in query) return (within = this.host) => this.env.getHarness(query, within);
    return (within = this.host) =>
      this.env.until(async () => (await within.find(query))[0], what ?? `no ${named(query)} in the harness`);
  }

  /** Whether the host, or `element`, is `aria-busy`. */
  protected async ariaBusy(element: TestElement = this.host): Promise<boolean> {
    return (await element.getAttribute("aria-busy")) === "true";
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
