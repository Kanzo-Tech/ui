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
interface SectionBinding_ {
  kind: "step" | "alpha" | "role";
  ramp?: string;
  step?: number;
  token?: string;
}
type PrefCommon_ = { default: string; doc: string; label?: string };
type SectionPrefDecl_ =
  | (PrefCommon_ & { kind: "choice"; options: readonly { value: string; label: string }[] })
  | (PrefCommon_ & { kind: "toggle" })
  | (PrefCommon_ & { kind: "range"; min: number; max: number; step: number });

interface SectionManifest {
  namespace: string;
  version: number;
  tokens?: Readonly<Record<string, { default: string | SectionBinding_; doc: string }>>;
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
 * **Every colour default here is a binding, not a hex.** That is what makes a white-label palette
 * reach the canvas: a bank changes its document and the marquee moves with it, because the default
 * says *(brand, alpha 5)* rather than a value someone copied out of a render.
 *
 * It is also the difference from minting a role. `--graph-marquee` lives in the graph's namespace
 * and is declared by the graph; `--selection` lived in the core's vocabulary and served one
 * consumer, which is how seventeen level-names accumulated before they were deleted.
 *
 * Today `docs/showcases/workspace/graph-canvas.tsx` writes `var(--brand-a5)` at the call site. That
 * is correct layer-three practice and it is also **nailed down**: a tenant cannot move it. Declared
 * here it has the same value and gains the capacity — a document may redirect it, and one that says
 * nothing gets `(brand, a5)` exactly as before.
 */
export const GRAPH_SECTION: SectionManifest = {
  namespace: "graph",
  version: 1,
  tokens: {
    marquee: {
      default: { kind: "alpha", ramp: "brand", step: 5 },
      doc: "The wash over a rubber-band selection. The same level a text selection uses, on purpose: selecting nodes and selecting words are one decision.",
    },
    "marquee-edge": {
      default: { kind: "role", token: "--primary" },
      doc: "The marquee's outline. Solid, because a diluted boundary measured 1.29:1 in light — see alpha-steps.test.ts.",
    },
    vignette: {
      default: { kind: "role", token: "--background" },
      doc: "The colour the rim fades toward. The page, so a vignette darkens in dark and lightens in light without a second value.",
    },
    grid: {
      default: { kind: "role", token: "--border" },
      doc: "The dot grid behind the canvas. Decorative, and WCAG 1.4.11 exempts a non-interactive separator by name.",
    },
    "point-ring-hover": {
      default: { kind: "role", token: "--primary" },
      doc: "The ring drawn around a hovered point.",
    },
    "point-ring-focus": {
      default: { kind: "role", token: "--primary" },
      doc: "The ring drawn around the focused point. Shares the hover value today; separate names because focus and hover are separate states.",
    },
  },

  /**
   * **Axes, not a list of names.** This offered one `choice` of three — Nebula, Atlas, Ink — and the
   * measurement that ended it is in `decisions/a-look-declares-what-it-changes.md`: six of the ten
   * fields separating Nebula from Atlas moved by 7–17%, under this package's own threshold for a
   * difference meaning anything. Two pictures nobody can tell apart were about to become two names
   * a person had to choose between.
   *
   * What is left is what a reader can name, and every one of these is a sentence: the marks are
   * dense or legible, links add where they cross, links bow, this many labels, the rim darkens. The
   * three old names are four points in that space and stay expressible — `lookFrom` builds a `Look`
   * from these values, and the defaults below are Atlas, which is what a graph drew before this
   * existed.
   *
   * `attr` is absent from all five on purpose: nothing here is read by CSS. A look reaches the GPU
   * through `buffers` and `setConfigPartial`, so an attribute on `<html>` would be a line in the
   * pre-hydration script bought for nobody.
   */
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
