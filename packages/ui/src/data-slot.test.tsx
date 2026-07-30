import { readdirSync, readFileSync, statSync } from "node:fs";
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

function slotSites(): Site[] {
  const sites: Site[] = [];
  for (const path of sources(SRC)) {
    const key = relative(SRC, path);
    const file = ts.createSourceFile(
      path,
      readFileSync(path, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );
    const foreign = foreignNames(file);
    const visit = (node: ts.Node) => {
      if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
        const props = node.attributes.properties;
        const index = props.findIndex(
          (p) => ts.isJsxAttribute(p) && p.name.getText(file) === "data-slot"
        );
        if (index >= 0) {
          const spreads = props
            .map((p, i) => (ts.isJsxSpreadAttribute(p) ? i : -1))
            .filter((i) => i >= 0);
          const tag = node.tagName.getText(file);
          const initializer = (props[index] as ts.JsxAttribute).initializer;
          sites.push({
            key,
            owner: ownerOf(node, file),
            tag,
            value:
              initializer && ts.isStringLiteral(initializer)
                ? initializer.text
                : initializer?.getText(file) ?? "",
            beforeSpread: spreads.length > 0 && index < spreads[spreads.length - 1],
            foreignTag: /^[a-z]/.test(tag) || foreign.has(tag.split(".")[0]),
          });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
    // A file with a NUL byte reads as binary to most tooling and would be skipped by a grep-based
    // guard without saying so. `readFileSync(…, "utf8")` reads it anyway; this keeps it honest.
    expect(readFileSync(path).includes(0)).toBe(false);
  }
  return sites;
}

describe("a part owns its data-slot", () => {
  it("writes data-slot after the spread, so a caller's cannot erase it", () => {
    const early = slotSites()
      .filter((site) => site.beforeSpread)
      .map((site) => `${site.key} ${site.owner}: <${site.tag} data-slot="${site.value}">`);

    // Failing? Move the attribute below `{...rest}` and give the component `slot?: string`:
    // `data-slot={slot ?? "the-slot"}`. React already types `slot`, so nothing else changes.
    expect(early.sort()).toEqual([]);
  });

  it("never passes data-slot into another Kanzo component", () => {
    const handed = slotSites()
      .filter((site) => !site.foreignTag)
      .map((site) => `${site.key} ${site.owner}: <${site.tag} data-slot="${site.value}">`);

    // Failing? Use `slot="…"` instead. `data-slot` says what *this* element is; the element it
    // would land on is one the callee owns, and the callee writes its own last regardless.
    expect(handed.sort()).toEqual([]);
  });

  it("writes no data-slot on a component that renders only an Ark provider", () => {
    const sites = slotSites();
    const dead = Object.entries(PROVIDER_ONLY).flatMap(([key, owners]) =>
      sites
        .filter((site) => site.key === key && owners.includes(site.owner))
        .map((site) => `${key} ${site.owner}: "${site.value}"`)
    );

    // Failing? The component renders no element, so the slot would not reach the document. Put it
    // on the part that renders — the content, the trigger, the positioner.
    expect(dead.sort()).toEqual([]);
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
