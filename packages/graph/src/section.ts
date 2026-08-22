/**
 * The manifest shape, re-declared structurally rather than imported from `@kanzo-tech/theme`.
 *
 * Third instance of the same call in this repository, and the same reasoning each time: the type is
 * a *shape*, the value is data, and importing it would add a dependency to carry no code. Here it
 * also keeps the arrow pointing one way — a section contributes to the core, and the core does not
 * know it exists, so neither package should have to name the other to make that true.
 *
 * `packages/theme/src/sections.ts` is the definition this conforms to. Two structural declarations
 * can drift; what stops it is that a mismatch is a `tsc` error the moment a host passes this to
 * `validateSection`, which `docs/` does.
 */
type PrefCommon_ = { default: string; doc: string; label?: string };
type SectionPrefDecl_ =
  | (PrefCommon_ & { kind: "choice"; options: readonly { value: string; label: string }[] })
  | (PrefCommon_ & { kind: "toggle" })
  | (PrefCommon_ & { kind: "range"; min: number; max: number; step: number });

interface SectionManifest {
  namespace: string;
  version: number;
  tokens?: Readonly<Record<string, { default: string; doc: string }>>;
  prefs?: Readonly<Record<string, SectionPrefDecl_>>;
}

/**
 * The graph's contribution to a host's preferences — its tokens and its choices.
 *
 * **It was `LOOK_SECTION`, and the name was half of it.** The look is five of the sixteen
 * preferences below; the rest are the edge layer, the dot grid and the six force coefficients, which
 * lived in a `Display` interface and a `Sim` interface with their own defaults and their own
 * hand-rolled sliders. One section, one storage shape, one resolution, one renderer.
 *
 * Reached by subpath — `@kanzo-tech/graph/section` — and never imported by
 * `@kanzo-tech/theme`. That direction is the whole design: contributing is *using* a namespace, not
 * registering a type in the core, so a consumer who never installs this package pays nothing and
 * `packages/ui` gains no reference to the graph.
 *
 * ## Four colour tokens are gone, and the rule that removed them is the same one
 *
 * A name is worth having when a theme would plausibly give it a value **different from the token it
 * comes out of**. If it can only ever repeat one, it is not a name, it is a use. Applied here:
 *
 * · `vignette` defaulted to `--background`, and the rim fades *toward the page* — any other value
 *   breaks it. It could never differ, so the canvas reads `--background` directly.
 * · `marquee-edge` and `point-ring-focus` both defaulted to `--primary`. A selection outline IS the
 *   brand; two names for "the brand, solid" is the duplication, not the flexibility.
 * · `marquee` was `(brand, alpha 5)` — a *dilution*, which is a derivation and not a name. It is
 *   `color-mix` where it is drawn.
 *
 * What that costs is the capacity for a tenant to redirect them, and measured against the rule
 * nobody wants it: redirecting `vignette` is breaking it. It is the same rule that removed seventeen
 * level-names from the core's vocabulary, applied to a section rather than to the core — which is
 * the half that had not been done.
 *
 * `grid` survives, and it is the only one that is arguable: a dot grid is decorative and drawn at a
 * different weight from a border, so a theme might plausibly want it fainter. If no theme ever does,
 * it goes too.
 *
 * **A default is a CSS value now, not an object.** It was `{kind, ramp, step}` in three shapes, two
 * of which named a reference tier that no longer exists; `var(--border)` says the same thing with
 * nothing between it and the browser, and the type it mirrored no longer has to be declared
 * structurally in two packages at once.
 */
export const GRAPH_SECTION: SectionManifest = {
  namespace: "graph",
  version: 1,
  tokens: {
    grid: {
      default: "var(--border)",
      doc: "The dot grid behind the canvas. Decorative, and WCAG 1.4.11 exempts a non-interactive separator by name.",
    },
    "point-ring-hover": {
      default: "var(--primary)",
      doc: "The ring drawn around a hovered point.",
    },
  },
  prefs: {
    marks: {
      kind: "choice",
      label: "Marks",
      default: "dense",
      doc: "How much ink a point spends. The legible mark is the one to pair the shape channel with — its radius floor is what keeps shape from corrupting the size ramp beside it.",
      options: [
        { value: "dense", label: "Dense" },
        { value: "legible", label: "Legible" },
      ],
    },
    "additive-links": {
      kind: "toggle",
      label: "Additive links",
      default: "false",
      doc: "Links add where they overlap instead of compositing over one another. Additive light is what makes a dense graph read as flow — and what made 4,280 links at 0.45 swallow 1,543 points on the archive.",
    },
    "bowed-links": {
      kind: "toggle",
      label: "Bowed links",
      default: "true",
      doc: "Links bow off the straight line by a hint, which is enough to tell two parallel edges apart. Every link curves the same way, so more than a hint reads as a pinwheel.",
    },
    labels: {
      kind: "range",
      label: "Labels",
      default: "26",
      doc: "How many of the highest-degree nodes carry a standing label. Zero draws none.",
      min: 0,
      max: 60,
      step: 2,
    },
    vignette: {
      kind: "toggle",
      label: "Vignette",
      default: "false",
      doc: "A darkened rim. Mood rather than a reading aid, which is why it is a preference and not a display control.",
    },
    links: {
      kind: "toggle",
      label: "Show links",
      default: "true",
      doc: "Draw the edge layer at all. Past a few hundred thousand links it is fog that costs a draw call a frame, and `adaptive` says where that is.",
    },
    grid: {
      kind: "toggle",
      label: "Dot grid",
      default: "true",
      doc: "The dot grid behind the graph. It pans and subdivides with the camera, which is what makes a pan read as motion rather than as a redraw.",
    },

    /**
     * The force coefficients, which are preferences and were a second vocabulary.
     *
     * **They are not appearance, and this manifest holds them anyway.** A section's `tokens` are the
     * colours a document may move; its `prefs` are *what the person on the screen decides*, and a
     * reader tuning a layout until it settles is deciding something. They lived in a TS interface
     * with a `DEFAULT_SIM` beside it and six hand-rolled sliders in one showcase's dock — the fourth
     * declaration style in a census of four, for a quarter of the knobs.
     *
     * The bounds are cosmos.gl's useful range rather than its legal one, and a stored value outside
     * them is declined: a slider that used to run to 5 and now stops at 3 must not paint 5 because
     * storage remembers it.
     *
     * **`adaptive(nodes)` still exists and still knows better.** What a corpus of this size wants is
     * computed, not chosen, and these defaults are tuned for a few hundred nodes. A host with a
     * large corpus should start its users at `adaptive`'s answer through the tenant policy — which
     * is the mechanism's own way of saying "start somewhere else" — rather than by writing values
     * into storage nobody can then reset.
     */
    gravity: {
      kind: "range",
      label: "Gravity",
      default: "0.14",
      doc: "Pull toward the centre. It is what stops a disconnected component drifting off the canvas.",
      min: 0,
      max: 0.5,
      step: 0.01,
    },
    repulsion: {
      kind: "range",
      label: "Repulsion",
      default: "1.1",
      doc: "How hard every point pushes every other. Bigger graphs need less of it, or they never settle.",
      min: 0,
      max: 2,
      step: 0.05,
    },
    "link-spring": {
      kind: "range",
      label: "Link spring",
      default: "0.6",
      doc: "How hard a link pulls its two ends together.",
      min: 0,
      max: 2,
      step: 0.05,
    },
    "link-distance": {
      kind: "range",
      label: "Link distance",
      default: "18",
      doc: "The length a link is happy at, in simulation units.",
      min: 2,
      max: 60,
      step: 1,
    },
    friction: {
      kind: "range",
      label: "Friction",
      default: "0.86",
      doc: "How fast motion decays. Under about 0.7 the layout twitches; near 1 it never stops.",
      min: 0.5,
      max: 0.99,
      step: 0.01,
    },
    cluster: {
      kind: "range",
      label: "Cluster pull",
      default: "0.1",
      doc: "Pull toward the node's group position on the cluster ring. Zero lets the links decide alone.",
      min: 0,
      max: 1,
      step: 0.05,
    },
  },
};
