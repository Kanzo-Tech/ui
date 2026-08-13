/**
 * Sections: appearance vocabulary contributed by the package that owns it.
 *
 * The core never learns that a section exists. It stores sections **opaquely**, resolves a token by
 * hierarchical fallback, and validates against a manifest the owning package hands it. Contributing
 * is *using* a name, not registering a type here — which is what keeps the one-way door shut
 * structurally rather than by discipline: `@kanzo-tech/theme` gains no reference to
 * `@kanzo-tech/graph`, and `boundary.test.ts` keeps passing because there is nothing to import.
 *
 * ## Resolution is Neovim's, validation is not
 *
 * A dotted name falls back to its parent: `--graph-point-size-min` → `--point-size-min` → the
 * default the manifest declared. Neovim's highlight groups work exactly this way
 * (`@foo.bar.lang → @foo.bar → @foo`) and it is why a section costs the core nothing.
 *
 * **Neovim pays a price we do not: there, a typo degrades silently to the parent.** Here the
 * manifest *declares* its tokens, so resolution goes by fallback and validation goes against the
 * declaration. That combination — contribute *and* validate — is the part no surveyed system does:
 * VS Code's `contributes.colors` and Emacs contribute without validating the namespace, Vanilla
 * Extract validates completely and therefore cannot have optional sections at all, and StyleX
 * retracted that shape. This is unmapped ground, and `sections.test.ts` says what it cannot prove.
 *
 * ## A default may be derived, and that is what makes white-label flow
 *
 * VS Code spells derived defaults as imperative transforms (`darken`, `transparent`, `oneOf`). We
 * already have the better form: a **binding**, declarative against the tenant's ramps, the same
 * shape the role table uses. `--graph-marquee` defaults to `(brand, alpha 5)`, so a bank changing
 * its palette moves the marquee with it — **without the core knowing what a graph is**, and without
 * anyone copying a hex.
 *
 * That is why this is not the thing that was refused earlier. Minting a *role* in the core's
 * vocabulary for one consumer is how seventeen level-names happened. A section token lives in the
 * owner's namespace, is declared by the owner, and costs nothing to whoever never installs it.
 */

/** How a section token's default is expressed. A literal, or something the palette can resolve. */
export type SectionBinding =
  | { kind: "step"; ramp: string; step: number }
  | { kind: "alpha"; ramp: string; step: number }
  /** Point at a role the document already publishes — the cheapest derived default. */
  | { kind: "role"; token: string };

export interface SectionTokenDecl {
  /**
   * A literal, or a binding resolved against the tenant's ramps at compile time.
   *
   * The binding shape is declared structurally here rather than imported from
   * `@kanzo-tech/palette`, which is authoring-time and must not enter this package's dependencies —
   * `boundary.test.ts` fails if it does. The palette reads these; it does not export them.
   */
  default: string | SectionBinding;
  /** What the token is for, in one line. Shown by a panel that lists a section's vocabulary. */
  doc: string;
}

/** What a package publishes to contribute a section. Reached by subpath, never imported here. */
export interface SectionManifest {
  /** The namespace segment. `"graph"` produces `--graph-*`. */
  namespace: string;
  version: number;
  /** Keys are token names **without** the namespace: `"marquee"`, `"point-size-min"`. */
  tokens: Readonly<Record<string, SectionTokenDecl>>;
}

/** A stored appearance document. `sections` is opaque: the core never parses a section's payload. */
export interface LookDocument {
  id: string;
  label: string;
  version: number;
  /**
   * Keyed by namespace. **Unknown sections are legal and are preserved**, which is a product
   * requirement rather than politeness: a client signs their document before they buy the graph,
   * and the section a later package adds must survive every load and save in between.
   */
  sections: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

/**
 * The fallback chain for a dotted token, most specific first.
 *
 * `--graph-point-size-min` → `--point-size-min`. One segment is dropped at a time from the left,
 * because the namespace is the qualifier: a section asks for its own value and inherits the shared
 * one when it has none of its own.
 */
export function fallbackChain(token: string): string[] {
  const bare = token.replace(/^--/, "");
  const parts = bare.split("-");
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) out.push(`--${parts.slice(i).join("-")}`);
  return out;
}

/**
 * Resolve a section token against a document, then against the manifest's default.
 *
 * `declared` is what the cascade or the document already provides, keyed by full token name. The
 * first member of the chain it answers wins; if none does, the manifest's default is returned —
 * and a *binding* default is returned unresolved, because resolving it needs the tenant's ramps and
 * those live in the palette. The caller compiles it.
 */
export function resolveSectionToken(
  token: string,
  declared: Readonly<Record<string, string>>,
  manifest: SectionManifest,
): { value: string | SectionBinding; via: string } | null {
  for (const candidate of fallbackChain(token)) {
    const hit = declared[candidate];
    if (hit !== undefined) return { value: hit, via: candidate };
  }
  const bare = token.replace(new RegExp(`^--${manifest.namespace}-`), "");
  const decl = manifest.tokens[bare];
  return decl ? { value: decl.default, via: `${manifest.namespace}:default` } : null;
}

export interface Problem {
  token: string;
  /** `unknown` — not declared by the manifest. `shadowed` — would silently fall back to a parent. */
  kind: "unknown" | "shadowed";
  detail: string;
}

/**
 * Check a section's stored payload against the manifest that owns it.
 *
 * This is the half Neovim does not have, and it is why a typo cannot degrade in silence: a name the
 * manifest never declared is reported rather than quietly resolving to whatever parent happens to
 * exist. Validation is **per section**, so a document carrying a section for an absent package is
 * simply not validated — it is not an error, and `sections.test.ts` pins that.
 */
export function validateSection(
  manifest: SectionManifest,
  stored: Readonly<Record<string, string>>,
): Problem[] {
  const problems: Problem[] = [];
  for (const token of Object.keys(stored)) {
    const prefix = `--${manifest.namespace}-`;
    if (!token.startsWith(prefix)) {
      problems.push({
        token,
        kind: "unknown",
        detail: `not in the "${manifest.namespace}" namespace — a section may only declare its own`,
      });
      continue;
    }
    const bare = token.slice(prefix.length);
    if (!(bare in manifest.tokens)) {
      const parent = fallbackChain(token)[1];
      problems.push({
        token,
        kind: "shadowed",
        detail:
          `"${manifest.namespace}" declares no "${bare}". Unvalidated, this would fall back to ` +
          `${parent ?? "nothing"} and paint something plausible — which is the silent-typo failure ` +
          `this check exists to prevent.`,
      });
    }
  }
  return problems;
}

/** Read a section's payload. Absent, or a package you do not have, answers an empty record. */
export function sectionOf(doc: LookDocument, namespace: string): Readonly<Record<string, string>> {
  return doc.sections[namespace] ?? {};
}

/**
 * Write a section back, preserving every other section byte for byte.
 *
 * The preservation is the point: a host that never installed `@kanzo-tech/graph` still round-trips
 * a document containing a graph section, because the core treats the payload as opaque data rather
 * than as something to parse into a type it knows.
 */
export function withSection(
  doc: LookDocument,
  namespace: string,
  tokens: Readonly<Record<string, string>>,
): LookDocument {
  return { ...doc, sections: { ...doc.sections, [namespace]: tokens } };
}
