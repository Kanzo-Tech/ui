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
interface SectionManifest {
  namespace: string;
  version: number;
  tokens: Readonly<Record<string, { default: string | SectionBinding_; doc: string }>>;
}

/**
 * The graph's contribution to the appearance document.
 *
 * Reached by subpath — `@kanzo-tech/graph/look-section` — and never imported by
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
export const LOOK_SECTION: SectionManifest = {
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
};
