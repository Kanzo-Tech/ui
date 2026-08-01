import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { render } from "@testing-library/react";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { Button } from "./simples/button";
import { Card } from "./simples/card";
import { DialogHeader } from "./simples/dialog";

/**
 * A part owns its `data-slot`, and `slot` is the only way to rename one.
 *
 * `data-slot` is not decoration: our own recipes select on it — `alert-dialog.tsx` carries
 * `in-[[data-slot=alert-dialog-content]:has([data-slot=alert-dialog-header])]:pt-0` — and it is the
 * escape hatch consumers get instead of guessing class names. Written *before* `{...rest}` it is
 * also a default a caller can silently delete, taking the recipe with it and leaving nothing to
 * grep for. `charts/chart-inputs.tsx` did exactly that to `Field`, `FacetFilter` and `Combobox`.
 *
 * So the attribute goes after the spread everywhere, and the affordance it removes — renaming a
 * part so it answers to a different recipe — comes back as an explicit `slot?: string`. No type
 * declares it: React's `HTMLAttributes` already carries `slot`, so every
 * `React.ComponentProps<typeof ark.x>` has it and `asChild` polymorphism is untouched.
 *
 * Three rules, all of them mistakes this repository has already made:
 *
 * 1. **After the spread.** 428 elements were the other way round when this test was written.
 * 2. **Never `data-slot` into another Kanzo component.** Say what *this* element is, on this
 *    element; to rename a part you render, pass it `slot`. Ark's `asChild` merge is the same case
 *    wearing a disguise — it hands the parent's `data-slot` to the child as an ordinary prop, and
 *    the child now writes its own last, so the parent cannot name an element it does not render.
 * 3. **No slot on a provider.** Ten components resolved to an Ark root that renders `children` and
 *    no element of its own, so their `data-slot` was never in the document. TypeScript does not
 *    typecheck a hyphenated JSX attribute, which is why it went unnoticed for the life of the file;
 *    asking for `slot` instead is what surfaced it.
 *
 * ## What this guard cannot prove
 *
 * - **Rule 2 has a blind spot, and there are five live instances of it.** The check fires on a
 *   `data-slot` written onto one of *our* components. It does not fire when the tag is Ark's and
 *   Ark's `asChild` hands the attribute down to one of ours — the offending element is foreign, so
 *   the parse walks past it, and the attribute is discarded exactly as rule 2 describes. Proven by
 *   rendering, not inferred: a `data-slot` written on `ArkFileUpload.Trigger asChild` around our
 *   `Button` reads back as `"button"`. Live and dead today at `simples/file-upload.tsx:93` and
 *   `:` its item-delete sibling, and at `simples/pagination.tsx:64` plus the prev/next triggers.
 *   Each is a slot a recipe or a consumer's query can select and never match. Catching it means
 *   knowing which foreign tags wrap one of ours, which the parse can be taught — nobody has.
 * - **`PROVIDER_ONLY` is a reading of Ark's dist, not a measurement of it.** Nothing here renders
 *   those components to check they still emit no element; if Ark starts rendering a `<div>` from
 *   `Popover.Root`, this file will keep insisting the slot is dead. The entries are checked for
 *   being *live* — the file exists, the component is still declared — which catches the stale
 *   half of that risk and not the upstream half.
 * - **It parses `.tsx` only.** A `data-slot` written through `createElement`, spread in from an
 *   object, or assembled as a string is invisible; so is anything in a `.ts` file. Every current
 *   site is a literal JSX attribute, which is what the corpus floor below is defending.
 * - **"After the spread" is a source-order claim, not a runtime one.** Two spreads with the
 *   attribute between them, or a spread whose object is built conditionally, are read by position.
 *   The render tests at the bottom of this file are what check the behaviour rather than the shape,
 *   and they cover three components, not ninety-nine.
 * - **It does not know which slots are selected on.** A slot no recipe uses and a slot three
 *   recipes depend on read identically here.
 */

const SRC = resolve(dirname(fileURLToPath(import.meta.url)));

/**
 * Components whose whole render is an Ark provider — `Dialog.Root`, `Menu.Root`, `Popover.Root`,
 * `Tooltip.Root`, `HoverCard.Root`, `Tour.Root`, `TreeView.NodeProvider`, `DatePicker.Context` —
 * or a thin wrapper of one. Read Ark's own dist if you doubt it: each returns providers around
 * `children`, and `TreeViewNodeProvider` and `DatePickerContext` drop every prop but their own.
 * A `data-slot` here renders nothing at all. Nothing selects on any of the ten values that were
 * removed: `alert-dialog-root`, `calendar-context`, `hover-card`, `menu`, `menu-sub`, `popover`,
 * `sheet`, `tooltip`, `tour`, `tree-view-node`.
 */
const PROVIDER_ONLY: Record<string, string[]> = {
  "simples/alert-dialog.tsx": ["AlertDialog"],
  "simples/calendar.tsx": ["CalendarContext"],
  "simples/hover-card.tsx": ["HoverCard"],
  "simples/menu.tsx": ["Menu", "MenuSub"],
  "simples/popover.tsx": ["Popover"],
  "simples/sheet.tsx": ["Sheet"],
  "simples/tooltip.tsx": ["Tooltip"],
  "simples/tour.tsx": ["Tour"],
  "simples/tree-view.tsx": ["TreeViewNode"],
};

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sources(path, out);
    else if (/\.tsx$/.test(name) && !/\.test\.tsx$/.test(name)) out.push(path);
  }
  return out;
}

/** Names bound by a bare module specifier — Ark's parts, lucide's icons. Not ours to slot. */
function foreignNames(file: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  for (const statement of file.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text.startsWith(".")
    ) {
      continue;
    }
    const clause = statement.importClause;
    if (!clause) continue;
    if (clause.name) names.add(clause.name.text);
    if (clause.namedBindings) {
      if (ts.isNamespaceImport(clause.namedBindings)) {
        names.add(clause.namedBindings.name.text);
      } else {
        for (const element of clause.namedBindings.elements) {
          names.add(element.name.text);
        }
      }
    }
  }
  return names;
}

/** The declaration a JSX element sits inside, so a failure names a component and not a line. */
function ownerOf(node: ts.Node, file: ts.SourceFile): string {
  for (let n: ts.Node | undefined = node; n; n = n.parent) {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) return n.name.text;
    if (ts.isFunctionDeclaration(n) && n.name) return n.name.text;
  }
  return file.fileName;
}

interface Site {
  key: string;
  owner: string;
  tag: string;
  value: string;
  beforeSpread: boolean;
  foreignTag: boolean;
}

const FILES = sources(SRC).sort();

/** Every directory under `src/` that holds a `.tsx`, named so the walk cannot stop descending. */
const LAYERS = ["charts", "composites", "layouts", "simples", "table", "theme"];

/** Parsed once. Three assertions ask three questions of the same reading of the same files. */
function slotSites(): Site[] {
  const sites: Site[] = [];
  for (const path of FILES) {
    const key = relative(SRC, path);
    const file = ts.createSourceFile(
      path,
      readFileSync(path, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );
    // A file that parses to nothing yields no site, and no site is what a pass looks like.
    expect(file.statements.length, `${key} parsed to no statements at all`).toBeGreaterThan(0);
    const foreign = foreignNames(file);
    const visit = (node: ts.Node) => {
      if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
        const props = node.attributes.properties;
        const index = props.findIndex(
          (p) => ts.isJsxAttribute(p) && p.name.getText(file) === "data-slot"
        );
        if (index >= 0) {
          const lastSpread = props.reduce(
            (last, p, i) => (ts.isJsxSpreadAttribute(p) ? i : last),
            -1
          );
          const tag = node.tagName.getText(file);
          const [head = tag] = tag.split(".");
          const initializer = (props[index] as ts.JsxAttribute).initializer;
          sites.push({
            key,
            owner: ownerOf(node, file),
            tag,
            value:
              initializer && ts.isStringLiteral(initializer)
                ? initializer.text
                : initializer?.getText(file) ?? "",
            beforeSpread: index < lastSpread,
            foreignTag: /^[a-z]/.test(tag) || foreign.has(head),
          });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
  }
  return sites;
}

const SITES = slotSites();

describe("a part owns its data-slot", () => {
  it("reads every .tsx under src/, in every layer, and finds slots in them", () => {
    // All three assertions below are `toEqual([])`, which is also what an empty corpus produces.
    // The floors are floors, not counts — they only have to catch a scan that found nothing.
    expect(FILES.length, "the walk found almost nothing — it is not reaching src/").toBeGreaterThan(
      80
    );
    for (const layer of LAYERS) {
      expect(
        FILES.filter((f) => relative(SRC, f).startsWith(`${layer}/`)).length,
        `${layer}/ contributed no file to the scan`
      ).toBeGreaterThan(0);
    }
    expect(
      SITES.length,
      "the parse found no data-slot at all — the reader is broken, not the code"
    ).toBeGreaterThan(200);

    // A NUL byte reads as binary to `file(1)` and every `grep -I`, so a source carrying one is one
    // the next reader's first tool skips in silence. `charts/chart-inputs.tsx` held one, and the
    // three searches that missed it are why this assertion exists. It never said which file.
    const binary = FILES.filter((f) => readFileSync(f).includes(0)).map((f) => relative(SRC, f));
    expect(binary, "a NUL byte makes this file invisible to grep — strip it").toEqual([]);

    const empty = FILES.filter((f) => readFileSync(f, "utf8").trim() === "").map((f) =>
      relative(SRC, f)
    );
    expect(empty, "an empty source file is a scan that proves nothing").toEqual([]);
  });

  it("writes data-slot after the spread, so a caller's cannot erase it", () => {
    const early = SITES.filter((site) => site.beforeSpread)
      .map((site) => `${site.key} ${site.owner}: <${site.tag} data-slot="${site.value}">`)
      .sort();

    expect(
      early,
      `A data-slot written before {...rest} is a default the caller can delete, taking every recipe\n` +
        `that selects it. Move the attribute below the spread and give the component\n` +
        `\`slot?: string\`: \`data-slot={slot ?? "the-slot"}\`. React already types \`slot\`:\n` +
        early.join("\n")
    ).toEqual([]);
  });

  it("never passes data-slot into another Kanzo component", () => {
    const handed = SITES.filter((site) => !site.foreignTag)
      .map((site) => `${site.key} ${site.owner}: <${site.tag} data-slot="${site.value}">`)
      .sort();

    expect(
      handed,
      `data-slot says what *this* element is. On one of ours it lands on an element the callee\n` +
        `owns, and the callee writes its own last regardless. Use \`slot="…"\`:\n${handed.join("\n")}`
    ).toEqual([]);
  });

  it("writes no data-slot on a component that renders only an Ark provider", () => {
    const dead = Object.entries(PROVIDER_ONLY)
      .flatMap(([key, owners]) =>
        SITES.filter((site) => site.key === key && owners.includes(site.owner)).map(
          (site) => `${key} ${site.owner}: "${site.value}"`
        )
      )
      .sort();

    expect(
      dead,
      `The component renders no element of its own, so the slot never reaches the document. Put it\n` +
        `on the part that renders — the content, the trigger, the positioner:\n${dead.join("\n")}`
    ).toEqual([]);
  });

  it("keeps no PROVIDER_ONLY entry that has stopped naming anything", () => {
    // The list is an assertion of *absence*, which is the shape that rots invisibly: a renamed file
    // or a renamed component leaves an entry that can never match, and the test above then proves
    // nothing about it while still reporting green. So each entry has to still name something real.
    const stale: string[] = [];
    for (const [key, owners] of Object.entries(PROVIDER_ONLY)) {
      const path = join(SRC, key);
      if (!existsSync(path)) {
        stale.push(`${key}: the file is gone`);
        continue;
      }
      const source = readFileSync(path, "utf8");
      for (const owner of owners) {
        if (!new RegExp(`\\b(?:function|const)\\s+${owner}\\b`).test(source)) {
          stale.push(`${key}: ${owner} is no longer declared there`);
        }
      }
    }

    expect(
      stale.sort(),
      `A provider-only entry names a component whose data-slot would render nothing. If the\n` +
        `component moved, move the entry; if it is gone, delete it — an entry that matches nothing\n` +
        `is an exemption for a file nobody is checking:\n${stale.join("\n")}`
    ).toEqual([]);
  });
});

describe("the slot prop", () => {
  it("renames the part a recipe selects", () => {
    const { container } = render(<Button slot="sidebar-trigger">Menu</Button>);

    expect(container.querySelector("[data-slot=sidebar-trigger]")).not.toBeNull();
    expect(container.querySelector("[data-slot=button]")).toBeNull();
  });

  it("survives a wrapper renaming a part it does not own", () => {
    const { container } = render(<DialogHeader slot="alert-dialog-header" />);

    expect(container.querySelector("[data-slot=alert-dialog-header]")).not.toBeNull();
  });

  it("cannot be erased by a data-slot a caller happens to pass", () => {
    // The `chart-inputs.tsx` shape, from outside the library: a caller spreading its own props
    // onto one of ours used to delete the slot every recipe selecting `card` depends on.
    const { container } = render(
      <Card {...({ "data-slot": "whatever" } as Record<string, string>)} />
    );

    expect(container.querySelector("[data-slot=card]")).not.toBeNull();
    expect(container.querySelector("[data-slot=whatever]")).toBeNull();
  });
});
