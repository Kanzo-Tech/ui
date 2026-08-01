import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  useCombobox as useArkCombobox,
  useComboboxContext,
} from "@ark-ui/react/combobox";
import { useTagsInputContext } from "@ark-ui/react/tags-input";
import { useTourContext as useArkTourContext } from "@ark-ui/react/tour";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import * as UI from "./index";
import {
  ADDED,
  BEYOND_THE_SURFACE,
  MODULE_MAP,
  OURS_ALONE,
  RENAMED,
  UNADOPTED,
  WITHHELD,
} from "./shark-parity.divergences";

/**
 * "We follow Shark UI" as a checkable fact.
 *
 * `CONVENTIONS.md` says the reference governs the surface, and until now nothing checked it. What
 * that cost, twice, in opposite directions: an export audit deleted 31 one-line `useX` context
 * aliases on the house rule that renaming somebody else's export is not an API — Shark ships 38 of
 * the 43 names involved, and nobody noticed for two days
 * (`decisions/a-name-shark-ships-is-ours.md`). The same blind spot the other way: Shark exports
 * `ScrollAreaScrollbar` and we do not, found in passing, never decided.
 *
 * So: every difference between the two export surfaces must be declared, with a reason, in
 * `shark-parity.divergences.ts`. An undeclared difference fails. A declaration that has stopped
 * describing a difference fails too — that is what stops the file becoming an allowlist that only
 * grows, and it is the half that makes the guard bidirectional in practice as well as in wording.
 *
 * ## Why there is a snapshot and not a fetch
 *
 * `pnpm test` never touches the network. A test that fetches 95 files from GitHub on every run is
 * slow, fails offline, fails behind a rate limit, and gets skipped the first week it goes red for a
 * reason nobody caused — and this repository already carries flaky palette tests timing out at 30s,
 * so a second source of noise would discredit both. The reference surface is therefore checked in,
 * at `shark-surface.json`, refreshed deliberately:
 *
 *     node packages/ui/scripts/refresh-shark-surface.mjs
 *
 * The honest cost of that choice is a snapshot that can go stale in silence, and it is paid rather
 * than ignored: the snapshot carries the date and the commit it was taken at, this file asserts
 * both, and the assertion turns red once the snapshot is older than SNAPSHOT_MAX_AGE_DAYS. That is
 * a test that can fail with no code change, on purpose. The alternative is a guard whose corpus
 * quietly stops being the reference, which is the failure mode this whole file exists to remove.
 *
 * ## What this cannot prove
 *
 * - **Nothing about appearance.** It compares names, never class strings. A recipe that diverges
 *   from Shark's in every utility passes here, and should: appearance divergence is what the
 *   recipes and the token layer are for, and diffing class lists would be noise at a volume that
 *   buries the signal.
 * - **Nothing about props.** `Button` matching `Button` says nothing about their signatures. The
 *   `slot` prop divergence — the one that is genuinely surface — is invisible to this file and is
 *   recorded in BEYOND_THE_SURFACE instead, held by `data-slot.test.tsx`.
 * - **Nothing about bindings.** Two `useTagsInput` exports match by name and return different
 *   things; the one case known today is asserted below by hand, and a second one would not be
 *   found here.
 * - **Nothing about behaviour**, which comes from Ark. Ark parity is not checked anywhere.
 * - **Only the root barrel.** `@kanzo-tech/ui/editor`, `/table` and `/analytics` are outside the
 *   corpus, so Shark's `chart.tsx` is compared as unadopted rather than against our Mosaic charts.
 * - **Only `simples/`, plus whatever `MODULE_MAP` names — which is one file.** "Our side" is
 *   `readdirSync(SRC/simples)` and that map, so everything in `composites/` and `layouts/` except
 *   `composites/sidebar.tsx` is outside the corpus: **35 value exports across 6 modules** today
 *   (counted 2026-07-30) — `composites/AppearanceToggle.tsx` (1), `composites/CodeEditor.tsx` (2),
 *   `composites/Preferences.tsx` (10), `composites/SidebarIdentity.tsx` (6), `layouts/section.tsx`
 *   (10), `layouts/shell.tsx` (6). Every one of them is the OURS_ALONE category — Shark has no file
 *   for any of them — so this costs nothing in the direction that iterates Shark's list, which is
 *   complete: a component Shark ships and we build in `composites/` still fails
 *   `has one of our modules behind every component` until `MODULE_MAP` or UNADOPTED gains a line.
 *   What it costs is the other direction. Those 35 names are never asked to declare themselves,
 *   and `puts every adopted module's exports on the public barrel` never reaches them, so one can
 *   leave the barrel here without a red test anywhere.
 * - **Only type-free value exports.** `export type` on either side is dropped: a shape is not a
 *   name a consumer calls.
 * - **Only Shark's `registry/react/components/`.** Its 95 example directories are not fetched, so
 *   the claim in `decisions/a-name-shark-ships-is-ours.md` that the aliases have no call site
 *   inside Shark is, as measured here, a claim about the component files only.
 * - **It cannot tell a good reason from a bad one.** It checks that a reason exists, that anything
 *   it cites by path exists, and that the undecided ones are named. Whether the reason is right is
 *   review's job.
 *
 * ## Mutation-tested
 *
 * Run once with `"scroll-area:ScrollAreaScrollbar"` deleted from WITHHELD: the second test fails
 * with `Shark ships names we neither ship nor declare` and that exact key in the list. Run once
 * with a bogus `"scroll-area:ScrollAreaThumb"` added: the obsolete-declaration test fails and names
 * it. Run once with `fetchedAt` set two years back: the snapshot test fails naming the refresh
 * command. A guard nobody has seen fail is a guard nobody has tested.
 */

const SRC = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SRC, "../../..");

/**
 * The reference's address, pinned here as well as in the snapshot and in the refresh script.
 *
 * It is pinned because of how the last move was found — which was by accident, two owners late.
 * `raw.githubusercontent.com` serves the previous owner, `vinihvc/shark-ui`, with HTTP 200 and no
 * redirect at all, so a stale URL is indistinguishable from a live one by status code, by final
 * URL, or by content. The refresh script asks the repository API for the canonical `full_name` and
 * refuses to write a snapshot that disagrees; this line is the second half of that, so a snapshot
 * regenerated against a moved repository cannot land without an edit here.
 */
const REPO = "sharkui-inc/shark-ui";
const SOURCE = `https://raw.githubusercontent.com/${REPO}/main/registry/react/components`;

/**
 * Six months. Long enough that nobody meets it in the course of ordinary work, short enough that a
 * reference nobody has looked at in half a year stops being called a reference. The fix is one
 * command and the failure message is that command.
 */
const SNAPSHOT_MAX_AGE_DAYS = 180;

/** Floors, counted from today's tree. A guard whose corpus can silently empty reports the same green as a real pass. */
const FLOOR = { sharkComponents: 85, sharkNames: 560, ourModules: 60 };

type Snapshot = {
  repo: string;
  ref: string;
  commit: string;
  source: string;
  fetchedAt: string;
  counts: { components: number; exampleDirs: number; names: number };
  components: Record<string, string[]>;
};

const snapshot = JSON.parse(readFileSync(join(SRC, "shark-surface.json"), "utf8")) as Snapshot;

/**
 * The value exports of one of our modules, parsed rather than grepped.
 *
 * `charts/chart-inputs.tsx` once held a raw NUL byte, which made every `grep -I` in the repository
 * treat the largest file in that layer as binary and skip it silently — so the house rule is to
 * parse. The refresh script carries the same walk for Shark's files; the two are not shared because
 * `packages/ui/tsconfig.json` includes `src` only, and importing the script would drag an untyped
 * `.mjs` into the typecheck program.
 */
function valueExports(file: string): string[] {
  const source = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const values = new Set<string>();
  const isExported = (n: ts.Node) =>
    ts.canHaveModifiers(n) && (ts.getModifiers(n)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false);
  for (const st of sf.statements) {
    if (ts.isExportDeclaration(st)) {
      if (st.exportClause && ts.isNamedExports(st.exportClause)) {
        for (const el of st.exportClause.elements) {
          if (!st.isTypeOnly && !el.isTypeOnly) values.add(el.name.text);
        }
      }
      continue;
    }
    if (!isExported(st)) continue;
    if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) values.add(d.name.text);
    } else if (
      (ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st) || ts.isEnumDeclaration(st)) &&
      st.name
    ) {
      values.add(st.name.text);
    }
  }
  return [...values].sort();
}

/**
 * Our side, keyed the way Shark keys its registry: one file per component, kebab-case.
 *
 * `simples/`, and then whatever `MODULE_MAP` names for a Shark component that lives somewhere else
 * — which today is one entry, `sidebar`, a composite here because it owns provider state. It is the
 * seam, not a second layer: `composites/` and `layouts/` are otherwise outside this corpus
 * altogether, 35 exports' worth, which is the blind spot listed above rather than a gap this map is
 * closing.
 */
const ourModules = new Map<string, { path: string; values: string[] }>();
for (const file of readdirSync(join(SRC, "simples"))) {
  if (!/\.tsx?$/.test(file) || file.includes(".test.")) continue;
  const path = join(SRC, "simples", file);
  ourModules.set(file.replace(/\.tsx?$/, ""), { path, values: valueExports(path) });
}
for (const [name, relative] of Object.entries(MODULE_MAP)) {
  const path = join(SRC, relative);
  if (existsSync(path)) ourModules.set(name, { path, values: valueExports(path) });
}

/** A component is adopted when we have a module for it and have not declared otherwise. */
const adopted = Object.keys(snapshot.components).filter(
  (name) => ourModules.has(name) && !(name in UNADOPTED),
);

const key = (component: string, name: string) => `${component}:${name}`;
const renamedFromShark = new Set(Object.keys(RENAMED));
const renamedToOurs = new Set(Object.values(RENAMED).map((r) => r.ours));

const missing: string[] = [];
const added: string[] = [];
for (const component of adopted) {
  const theirs = new Set(snapshot.components[component]);
  const ours = new Set(ourModules.get(component)?.values);
  for (const name of theirs) {
    if (!ours.has(name) && !renamedFromShark.has(key(component, name))) missing.push(key(component, name));
  }
  for (const name of ours) {
    if (!theirs.has(name) && !renamedToOurs.has(name)) added.push(key(component, name));
  }
}

/** Every reason string in the file, so a citation inside one can be checked like a `held` entry. */
const reasons = [
  ...Object.values(UNADOPTED),
  ...Object.values(OURS_ALONE),
  ...Object.values(RENAMED).map((r) => r.reason),
  ...Object.values(WITHHELD),
  ...Object.values(ADDED),
  ...BEYOND_THE_SURFACE.map((d) => d.why),
];

/** A declaration whose reason opens with this is one the owner has not taken yet, by design. */
const isUndecided = (reason: string) => reason.startsWith("Undecided");

describe("the Shark UI surface", () => {
  it("is snapshotted from the reference, whole, and recent enough to be one", () => {
    // The corpus guard first: an empty or partial snapshot must fail, not pass. A guard that can
    // silently not see part of its corpus reports the same green as a real pass.
    const components = Object.entries(snapshot.components);
    expect(components.length).toBeGreaterThanOrEqual(FLOOR.sharkComponents);
    expect(components.length, "counts.components disagrees with the components it holds").toBe(
      snapshot.counts.components,
    );
    const names = components.reduce((n, [, v]) => n + v.length, 0);
    expect(names).toBeGreaterThanOrEqual(FLOOR.sharkNames);
    expect(names, "counts.names disagrees with the names it holds").toBe(snapshot.counts.names);
    for (const [component, exports] of components) {
      expect(exports.length, `${component} parsed as exporting nothing, which is never true here`).toBeGreaterThan(0);
    }

    // And the address, which is the part that went stale unnoticed for as long as it did.
    expect(snapshot.repo, "the snapshot was taken from a repository this file does not pin").toBe(REPO);
    expect(snapshot.source).toBe(SOURCE);
    expect(snapshot.commit).toMatch(/^[0-9a-f]{40}$/);

    const age = (Date.now() - Date.parse(`${snapshot.fetchedAt}T00:00:00Z`)) / 86_400_000;
    expect(Number.isFinite(age), `fetchedAt is not a date: ${snapshot.fetchedAt}`).toBe(true);
    expect(
      Math.floor(age),
      `the Shark snapshot is ${Math.floor(age)} days old — run \`node packages/ui/scripts/refresh-shark-surface.mjs\``,
    ).toBeLessThanOrEqual(SNAPSHOT_MAX_AGE_DAYS);
  });

  it("has one of our modules behind every component, or a declared reason it has none", () => {
    // Both directions off one list, which is the arrangement that makes it a rule rather than a
    // preference: a component Shark adds and a module we add each fail until somebody writes a line.
    expect(adopted.length).toBeGreaterThanOrEqual(FLOOR.ourModules);
    const undeclared = Object.keys(snapshot.components).filter(
      (name) => !ourModules.has(name) && !(name in UNADOPTED),
    );
    expect(undeclared, "Shark ships components we neither ship nor declare").toEqual([]);

    const ourUndeclared = [...ourModules.keys()].filter(
      (name) => !(name in snapshot.components) || name in UNADOPTED,
    ).filter((name) => !(name in OURS_ALONE));
    expect(ourUndeclared, "we ship modules Shark has no file for, undeclared").toEqual([]);

    for (const [name, relative] of Object.entries(MODULE_MAP)) {
      expect(existsSync(join(SRC, relative)), `MODULE_MAP: ${name} → ${relative}`).toBe(true);
    }
  });

  it("ships every name Shark ships, or declares why not", () => {
    // The failure this exists for. Deleting 31 aliases Shark exports would land here, named, on the
    // same run — not two days later, and not because somebody happened to ask about something else.
    const undeclared = missing.filter((k) => !(k in WITHHELD));
    expect(undeclared, "Shark ships names we neither ship nor declare").toEqual([]);
  });

  it("declares every name it ships that Shark's own file does not", () => {
    // The half `decisions/a-name-shark-ships-is-ours.md` is worded to cover and nothing enforced:
    // *a part Shark's registry does not export, we do not*. Thirteen Ark parts sit under it today,
    // each declared with the structural reason it exists.
    const undeclared = added.filter((k) => !(k in ADDED));
    expect(undeclared, "we ship names Shark does not, undeclared").toEqual([]);
  });

  it("keeps no declaration that has stopped describing a difference", () => {
    // Without this the file is an allowlist, and an allowlist that only grows is how a divergence
    // outlives its reason. If Shark adds a name we already ship, or we add one it ships, the entry
    // has to go — and the test says which.
    const missingSet = new Set(missing);
    const addedSet = new Set(added);
    expect(
      Object.keys(WITHHELD).filter((k) => !missingSet.has(k)),
      "declared as withheld, but no longer absent (or no longer Shark's)",
    ).toEqual([]);
    expect(
      Object.keys(ADDED).filter((k) => !addedSet.has(k)),
      "declared as ours alone, but Shark ships it now (or we stopped)",
    ).toEqual([]);
    expect(
      Object.keys(UNADOPTED).filter((k) => !(k in snapshot.components)),
      "declared unadopted, but Shark has no such component",
    ).toEqual([]);
    expect(
      Object.keys(OURS_ALONE).filter((k) => !ourModules.has(k)),
      "declared ours alone, but no such module",
    ).toEqual([]);
    expect(
      Object.entries(RENAMED).filter(
        ([k, r]) =>
          !snapshot.components[k.split(":")[0] as string]?.includes(k.split(":")[1] as string) ||
          !ourModules.get(k.split(":")[0] as string)?.values.includes(r.ours),
      ).map(([k]) => k),
      "declared as a rename, but one of the two names is gone",
    ).toEqual([]);
  });

  it("puts every adopted module's exports on the public barrel", () => {
    // The attribution above reads our source files; the surface a consumer meets is the barrel. Two
    // `export *` modules exporting one name silently export neither, which is the way a name can be
    // in a file, be counted as parity here, and not exist. This is what closes that gap.
    const surface = UI as Record<string, unknown>;
    const unreachable: string[] = [];
    for (const component of adopted) {
      for (const name of ourModules.get(component)?.values ?? []) {
        if (!(name in surface)) unreachable.push(key(component, name));
      }
    }
    expect(unreachable, "exported from its module and absent from the barrel").toEqual([]);
  });

  it("holds `useTagsInput` to the binding it actually has, not the name it shares", () => {
    // The one place a name matches and the binding does not. Ours aliases Ark's
    // `useTagsInputContext`; Shark's aliases Ark's `useTagsInput`, the machine hook. The comparison
    // above cannot see this — both files export the name — so it is asserted here, in the direction
    // that is true today, and closing the gap means changing this line on purpose.
    expect(UI.useTagsInput).toBe(useTagsInputContext);
    expect(snapshot.components["tags-input"]).toContain("useTagsInput");
    expect(snapshot.components["tags-input"]).toContain("useTagsInputContext");
    expect((UI as Record<string, unknown>).useTagsInputContext).toBeUndefined();
  });

  it("holds the two hooks restored with the parts to bindings that are not Ark's", () => {
    // `decisions/a-house-principle-withholds-no-name.md` restored `useCombobox` and
    // `useTourContext` with the parts, and both are the `useTagsInput` shape a second and a third
    // time — a name that matches the reference exactly and clashes with **Ark's** export of the
    // same name. Shark binds each the way we do, so parity is genuinely satisfied and the
    // comparison above cannot see any of it; what a consumer meets is two `useCombobox` with
    // incompatible signatures in one dependency tree.
    expect(UI.useCombobox).toBe(useComboboxContext);
    expect(UI.useCombobox).not.toBe(useArkCombobox);
    expect(snapshot.components.combobox).toContain("useCombobox");
    expect(snapshot.components.combobox).not.toContain("useComboboxContext");
    // Ark's `useTourContext` returns its machine API; ours returns the `{ tour, handleStart }` of
    // `tour.tsx`'s own React context, which is what `TourTrigger` reads. Same name, and neither
    // the same object nor the same shape.
    expect(UI.useTourContext).not.toBe(useArkTourContext);
    expect(snapshot.components.tour).toContain("useTourContext");
  });
});

describe("the declared divergences", () => {
  it("gives every one of them a reason", () => {
    const empty = [
      ...Object.entries({ ...UNADOPTED, ...OURS_ALONE, ...WITHHELD, ...ADDED }),
      ...Object.entries(RENAMED).map(([k, r]) => [k, r.reason] as const),
      ...BEYOND_THE_SURFACE.map((d) => [d.what, d.why] as const),
    ].filter(([, reason]) => (reason ?? "").trim().length < 40);
    expect(empty.map(([k]) => k), "a divergence with no recorded reason is the thing this file exists to refuse").toEqual([]);
    expect(BEYOND_THE_SURFACE.length).toBeGreaterThan(0);
  });

  it("cites nothing that does not exist", () => {
    // A reason pointing at a deleted file is not a reason. Paths are matched wherever they appear —
    // in a `held` list or inside the prose — because the citation is the checkable part.
    const cited = new Set<string>();
    const PATH = /(?:decisions|packages|docs|simples|composites|layouts|lib|scripts)\/[\w./-]+\.\w+|\b(?:CONVENTIONS|DESIGN)\.md\b/g;
    for (const text of [...reasons, ...BEYOND_THE_SURFACE.flatMap((d) => d.held)]) {
      for (const match of text.matchAll(PATH)) cited.add(match[0]);
    }
    expect(cited.size, "no citations found — the matcher has stopped seeing them").toBeGreaterThan(10);
    const dangling = [...cited].filter(
      (path) => !existsSync(join(ROOT, path)) && !existsSync(join(SRC, path)),
    );
    expect(dangling, "cited and not on disk").toEqual([]);
  });

  it("names the divergences nobody has decided yet", () => {
    // `decisions/a-measurement-overrules-the-reference.md`: where neither the reference, a
    // measurement nor a house rule decides, the owner does, and the case is recorded as undecided
    // rather than argued into one of the branches. Pinned so that one cannot appear, or quietly
    // stop being open, without an edit somebody reviews. The list is the agenda.
    const open = [
      ...Object.entries({ ...UNADOPTED, ...OURS_ALONE, ...WITHHELD, ...ADDED }),
      ...Object.entries(RENAMED).map(([k, r]) => [k, r.reason] as const),
    ]
      .filter(([, reason]) => isUndecided(reason))
      .map(([k]) => k)
      .sort();
    expect(open).toEqual([
      "clipboard:ClipboardValue",
      "command:CommandDialogTrigger",
      "command:CommandGroupLabel",
      "file-upload:FileUploadClearTrigger",
      "file-upload:FileUploadDescription",
      "file-upload:FileUploadDropzoneIcon",
      "file-upload:FileUploadHelper",
      "file-upload:FileUploadItemPreviewImage",
      "file-upload:FileUploadList",
      "file-upload:FileUploadRootProvider",
      "file-upload:FileUploadTitle",
      "highlight:useHighlight",
      "menu:MenuArrow",
      "pagination:PaginationItemLink",
      "pagination:PaginationItems",
      "skeleton:SkeletonCircle",
      "skeleton:SkeletonText",
      "tags-input:TagsInputRootProvider",
      "tags-input:useTagsInputContext",
      "tour:TourBody",
      "tour:TourFooter",
    ]);
  });
});
