/**
 * The force coefficients, and the one function that builds them from the axes a person chose.
 *
 * `graph-looks.ts`'s sibling, and deliberately its twin: a type the renderer consumes, one builder
 * that reads declared string values, and a default that is the builder called with nothing. What was
 * here before is what was there before — an interface, a `DEFAULT_SIM` table beside it, and a dock
 * that held six of them in React state and drew six sliders by hand.
 *
 * **A coefficient is not appearance, and it is still a preference.** `section.ts` says why it shares
 * the manifest: `tokens` are the colours a document may move, `prefs` are what the person on the
 * screen decides, and somebody tuning a layout until it settles is deciding.
 */

/** Force coefficients, handed straight to the GPU simulation. */
export interface Sim {
  gravity: number;
  repulsion: number;
  linkSpring: number;
  linkDistance: number;
  friction: number;
  /** Pull toward the node's group position on the cluster ring. Zero lets the links decide alone. */
  cluster: number;
}

/**
 * Coefficients that settle a few-hundred-node graph into something readable.
 *
 * Chosen against a corpus of that size, and they are a starting point rather than a law: a graph
 * two orders of magnitude larger wants less repulsion and more friction, and the measurements in
 * `BENCHMARKS.md` say a live simulation is finished by around 200,000 points regardless. What a
 * corpus of a given size wants is computed rather than chosen — see `adaptive` — and a host that
 * knows its corpus should start its users at that answer through the tenant policy.
 *
 * The values are strings for the reason `lookFrom`'s are: a contributed preference is a string in
 * all three kinds, so an unrecognised namespace rides through a write untouched. A key that is
 * missing, or that carries a value the section never offered, takes the default below — which is
 * what a graph simulated before any of this existed.
 */
export function simFrom(values: Readonly<Record<string, string | undefined>> = {}): Sim {
  const num = (key: string, fallback: number) => {
    const value = Number.parseFloat(values[key] ?? "");
    return Number.isFinite(value) ? value : fallback;
  };
  return {
    gravity: num("gravity", 0.14),
    repulsion: num("repulsion", 1.1),
    linkSpring: num("link-spring", 0.6),
    linkDistance: num("link-distance", 18),
    friction: num("friction", 0.86),
    cluster: num("cluster", 0.1),
  };
}

/** What a canvas simulates with when nobody has chosen anything. */
export const DEFAULT_SIM: Sim = simFrom();
