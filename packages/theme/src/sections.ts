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

/** What every declaration carries, whatever its kind. */
interface PrefCommon {
  /** The value when nothing else answers. Always a string — see {@link SectionPrefDecl}. */
  default: string;
  /** What the preference does, in one line. Shown by a surface beside the control. */
  doc: string;
  /**
   * The stored value is a map keyed by the resolved appearance, not a plain string.
   *
   * One field on the declaration rather than a second table beside it. It is only expressible
   * because appearance resolves *first* — the pre-hydration script has to resolve it to write
   * `.dark` — so by the time anything reads this, the side to index by is known.
   */
  byAppearance?: true;
  /**
   * The attribute to write on `<html>` — **only where CSS has to react.**
   *
   * Most contributed preferences have none. The graph's look is read by JS and pushed into a
   * renderer's config; an editor's font size would want one. Leaving it out is what keeps the
   * pre-hydration script from growing by a line for every optional package a host installs, which is
   * the cost the four core axes pay for having attributes at all.
   */
  attr?: string;
}

/** One thing a `choice` may offer. `value` is what is stored; `label` is what a person reads. */
export interface PrefOption {
  value: string;
  label: string;
}

/**
 * Where a choice's options come from, when an author cannot list them.
 *
 * The two things a TENANT publishes and nobody else can know at authoring time: the palette
 * documents they compiled, and the brands inside the applied one. Closed on purpose — a source is
 * something the provider already receives and can hand to a resolver, not a hook for a package to
 * fetch from.
 */
export type PrefSource = "palettes" | "identities";

/**
 * A list, or the name of the list's owner.
 *
 * This is the same move {@link SectionTokenDecl} already makes for colour — a **binding** instead of
 * a value — so the vocabulary stays one. It is what `identity` and `palette` need: their options are
 * a client's brands, and an author who typed them would be authoring the client's product.
 */
export type PrefOptions = readonly PrefOption[] | { from: PrefSource };

/** What the host publishes, for the declarations that name a source. */
export type PrefSources = Partial<Record<PrefSource, readonly PrefOption[]>>;

/**
 * The options a declaration offers — `null` when it names a source nobody has answered yet.
 *
 * `null` rather than `[]`, and the distinction is load-bearing: "this tenant published nothing",
 * "the host has not wired the prop" and "the document is still being fetched" are indistinguishable
 * from here, and every one of them must leave a stored value alone. An empty list would read as
 * *nothing is legal* and quietly reset a user's brand on the first render before the fetch lands —
 * which is the failure `useRetirement` guards with `options.length > 0` one layer up.
 */
export function prefOptions(
  decl: SectionPrefDecl,
  sources?: PrefSources,
): readonly PrefOption[] | null {
  if (decl.kind !== "choice") return null;
  if (Array.isArray(decl.options)) return decl.options;
  const list = sources?.[(decl.options as { from: PrefSource }).from];
  return list && list.length > 0 ? list : null;
}

/**
 * One preference a section offers its user — the half of a manifest the person on the screen decides.
 *
 * **Three kinds, and the set is closed.** A section may offer a value it has measured; it may not
 * offer a text field, and there is deliberately no `custom` escape. That is the same line the colour
 * layer holds one level up — choose among what somebody validated, never author — and it is what
 * lets any surface render any section without knowing which package wrote it.
 *
 * The three arrived together with their call sites rather than ahead of them. `choice` shipped
 * alone and covered the graph's look; the eleven controls it could not express are what asked for
 * the other two — three toggles and two scalars in the graph's Display, six coefficients in its
 * simulation dock, every one of them hand-rolled with its own wiring.
 *
 * **"Follow the system" is an option and not a fourth kind.** It is the option whose value is `""`,
 * and the convention is already load-bearing here: `identity` and `palette` default to `""`, and the
 * write rule removes the attribute at the default — which is exactly what *the OS decides* means in
 * CSS, where there is no third keyword either. Declared as `{ value: "", label: "System" }` it is a
 * thing a control can offer, so getting back to it stops being the panel's `Reset` button's private
 * power.
 *
 * **A value is a string in all three**, and that is a decision rather than an oversight. One storage
 * shape means an unrecognised namespace rides through a write untouched without the core parsing
 * it; and a value that can be written to a `data-*` attribute needs no second spelling on its way
 * out. A renderer parses what its own kind means — `"true"`, `"0.42"` — and the parsing is one
 * place, {@link prefNumber} and {@link prefBoolean}.
 */
export type SectionPrefDecl =
  /** Pick one of a closed list — or of a list only the tenant can write. */
  | (PrefCommon & {
      kind: "choice";
      /** Everything a control may offer, in order. Order is the section's, and a surface keeps it. */
      options: PrefOptions;
    })
  /** On or off. Stored as `"true"` / `"false"`. */
  | (PrefCommon & { kind: "toggle" })
  /**
   * A number within declared bounds.
   *
   * The bounds are the section's own claim about what it will honour, so a stored value outside them
   * is declined the same way a retired option is: a slider that used to run to 5 and now stops at 3
   * must not paint 5 because storage remembers it.
   */
  | (PrefCommon & { kind: "range"; min: number; max: number; step: number });

/** Read a `toggle`'s value. Anything that is not exactly `"true"` is off. */
export const prefBoolean = (value: string): boolean => value === "true";

/** Read a `range`'s value. `NaN` never escapes: a corrupt string answers the declared minimum. */
export function prefNumber(value: string, decl: { min: number }): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : decl.min;
}

/**
 * What a tenant may say about a section's choice — **selection, never authorship.**
 *
 * A document may fix a choice or withhold it; it may not invent a value for it. The options are the
 * ones the owning package declared and measured, and a policy picks among them or removes the
 * control. That is the same line the colour half holds — a user chooses among colours somebody
 * validated and never authors one — and it is what stops this field becoming the runtime palette
 * authoring the retired axes exist to prevent.
 */
export interface SectionPrefPolicy {
  /** Fixed to this value. No control is offered and a stored preference does not apply. */
  pinned?: string;
  /** Not offered. The default applies, and a stored preference is kept but does not apply. */
  hidden?: boolean;
  /** Offered, but starting somewhere other than the manifest says. */
  default?: string;
}

/**
 * What a package publishes to contribute a section. Reached by subpath, never imported here.
 *
 * **One manifest carries both halves**, and they are both optional. A package may contribute tokens
 * without preferences (a vocabulary a document decides), preferences without tokens (a choice that
 * paints nothing of its own), or both. Two exports would let a namespace and a version drift apart
 * while describing the same section, and the namespace is the whole of the contract.
 */
export interface SectionManifest {
  /** The namespace segment. `"graph"` produces `--graph-*`. */
  namespace: string;
  version: number;
  /** Keys are token names **without** the namespace: `"marquee"`, `"point-size-min"`. */
  tokens?: Readonly<Record<string, SectionTokenDecl>>;
  /** Keys are preference names, unqualified: `"look"`. */
  prefs?: Readonly<Record<string, SectionPrefDecl>>;
}

/** A tenant's policy for one section, keyed by preference name. */
export type SectionPolicy = Readonly<Record<string, SectionPrefPolicy>>;

/** Where a resolved preference came from — a panel says so, and a test asserts on it. */
export type PrefOrigin = "pinned" | "stored" | "policy" | "default";

export interface ResolvedPref {
  value: string;
  via: PrefOrigin;
  /** Whether a control should be drawn at all. `false` for pinned and for withheld. */
  offered: boolean;
}

/**
 * One chain, most specific first — the sibling of {@link resolveSectionToken}.
 *
 * Writing it as a chain is not decoration: the token half already answers *the first member that
 * answers, and says which one it used*, and a preference resolved by some other order would be a
 * second mechanism wearing the first one's vocabulary.
 *
 * A stored value that is not in `options` is ignored rather than applied. A section's options are
 * the values it has measured; a stale one from a version the package no longer ships is exactly the
 * case where falling back beats honouring what storage happens to hold.
 */
export function resolvePref(
  decl: SectionPrefDecl,
  stored: string | undefined,
  policy?: SectionPrefPolicy,
  /** What the tenant published, for a choice whose options name a source rather than listing them. */
  sources?: PrefSources,
): ResolvedPref {
  const legal = (v: string | undefined): v is string => {
    if (v === undefined) return false;
    // One gate per kind, and every kind has one. A preference with no notion of an illegal value
    // would let storage outlive the declaration that gave it meaning — which is the version-skew
    // case this whole chain exists to survive.
    if (decl.kind === "choice") {
      const options = prefOptions(decl, sources);
      // A source nobody has answered yet cannot judge anything, so it judges nothing: the stored
      // value stands and the retirement notice — which is the surface that knows how to *tell* a
      // user their brand is gone — decides later. See {@link prefOptions}.
      return options === null || options.some((o) => o.value === v);
    }
    if (decl.kind === "toggle") return v === "true" || v === "false";
    const n = Number.parseFloat(v);
    return Number.isFinite(n) && n >= decl.min && n <= decl.max;
  };

  if (legal(policy?.pinned)) return { value: policy.pinned, via: "pinned", offered: false };
  const offered = !policy?.hidden;
  if (offered && legal(stored)) return { value: stored, via: "stored", offered };
  if (legal(policy?.default)) return { value: policy.default, via: "policy", offered };
  return { value: decl.default, via: "default", offered };
}

/**
 * Check a section's stored preferences against the manifest that owns it.
 *
 * The preference sibling of {@link validateSection}, and the same argument: a name the manifest
 * never declared is reported rather than resolving to something plausible. What differs is that a
 * preference also has a closed set of legal *values*, so a stored value outside `options` is
 * reported too — `resolvePref` already refuses to apply it, and this is what says so out loud.
 */
export function validatePrefs(
  manifest: SectionManifest,
  stored: Readonly<Record<string, string>>,
  /** As {@link resolvePref}'s. A choice whose source is unanswered is not judged, and not reported. */
  sources?: PrefSources,
): Problem[] {
  const problems: Problem[] = [];
  const prefs = manifest.prefs ?? {};
  for (const [key, value] of Object.entries(stored)) {
    const decl = prefs[key];
    if (!decl) {
      problems.push({
        token: key,
        kind: "unknown",
        detail: `"${manifest.namespace}" declares no preference "${key}"`,
      });
      continue;
    }
    // A switch rather than a ternary chain: the range arm needs `decl` narrowed to reach `min`, and
    // `kind === "choice" ? … : kind === "toggle" ? … : …` does not narrow the last branch.
    let ok: boolean;
    let expected: string;
    switch (decl.kind) {
      case "choice": {
        const options = prefOptions(decl, sources);
        if (options === null) continue;
        const values = options.map((o) => o.value);
        ok = values.includes(value);
        expected = values.join(", ");
        break;
      }
      case "toggle": {
        ok = value === "true" || value === "false";
        expected = "true, false";
        break;
      }
      default: {
        const n = Number.parseFloat(value);
        ok = Number.isFinite(n) && n >= decl.min && n <= decl.max;
        expected = `${decl.min}–${decl.max}`;
      }
    }
    if (!ok) {
      problems.push({
        token: key,
        kind: "shadowed",
        detail:
          `"${value}" is not a legal ${manifest.namespace}.${key} (${expected}). ` +
          "It resolves to the default instead.",
      });
    }
  }
  return problems;
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
  const decl = (manifest.tokens ?? {})[bare];
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
    if (!(bare in (manifest.tokens ?? {}))) {
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
