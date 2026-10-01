"use client";

import {
  Button,
  Clipboard,
  ClipboardIndicator,
  ClipboardTrigger,
  cn,
  Input,
  NativeSelect,
  NativeSelectOption,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ShellAside,
  ShellBody,
  ShellHeader,
  ShellMain,
  ShellRoot,
  Slider,
  SliderLabel,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  ThemePreview,
} from "@kanzo-tech/ui";
import {
  auditContrast,
  contrast as wcag,
  hex,
  inkFor,
  oklch,
  pageInk,
  themeData,
  themeFamilies,
  themeIndex,
  type ContrastFinding,
} from "@kanzo-tech/theme";
import {
  CheckIcon,
  CopyIcon,
  Link2Icon as LinkIcon,
  Link2OffIcon as UnlinkIcon,
  MoonIcon,
  PaletteIcon,
  SunIcon,
  TriangleAlertIcon,
} from "lucide-react";
import * as React from "react";
import { decode, encode } from "./link";
import { ThemeSampler } from "./theme-sampler";

/**
 * A theme family, authored: a light theme and a dark one, edited side by side in one form.
 *
 * daisyUI's generator is the reference: a rail of colour controls grouped by role, a preview that
 * wears the values, and the CSS. Ours edits a PAIR because a user wears a day theme and a night
 * theme (GitHub's model, and `ThemePicker`'s), so a family that is only half written is not one a
 * tenant can ship.
 *
 * **Nothing in the pane is a preview OF a theme; it IS one.** Each side's values are inline custom
 * properties on its own element, which is exactly what a `[data-theme]` block is, so the specimens —
 * `ThemePreview` for both sides and the real components for the side being edited — read the same
 * tokens a shipped theme would publish. The CSS this page hands you is those values, reformatted.
 *
 * **It proposes, it does not decide.** Picking a fill proposes its ink by `inkFor` (and a page ink
 * by `pageInk`); an ink still equal to the proposal follows its fill, any other was chosen. And it
 * warns live, from `auditContrast` — the same `CONTRAST_PAIRS` the build holds every shipped theme
 * to — so the form cannot pass what the guard rejects. It never refuses.
 *
 * **It writes nothing.** No file, no `<html>` attribute, no storage: copy the CSS into
 * `packages/theme/themes/`, or paste the config snippet into an instance's branding.
 */

type Side = "light" | "dark";
type Tokens = Record<string, string>;
const SIDES: Side[] = ["light", "dark"];

/** The twenty-one, and each has exactly one picker. A pair is a fill and the ink that sits on it. */
const GROUPS = [
  {
    title: "Surfaces",
    doc: "three grounds and the two weights of ink they share",
    row: [
      { token: "--background", label: "background" },
      { token: "--card", label: "card" },
      { token: "--muted", label: "muted" },
    ],
    inks: [
      { token: "--foreground", label: "foreground", on: "--background" },
      { token: "--muted-foreground", label: "muted-fg", on: "--muted" },
    ],
  },
  {
    title: "Brand",
    doc: "each fill with the ink that belongs to it",
    pairs: [
      { fill: "--primary", ink: "--primary-foreground", label: "primary" },
      { fill: "--secondary", ink: "--secondary-foreground", label: "secondary" },
      { fill: "--accent", ink: "--accent-foreground", label: "accent" },
    ],
  },
  {
    title: "Status",
    doc: "`-content` sits ON the fill; `-foreground` is the same family read on the page",
    pairs: [
      { fill: "--destructive", ink: "--destructive-content", page: "--destructive-foreground", label: "destructive" },
      { fill: "--info", ink: "--info-content", page: "--info-foreground", label: "info" },
      { fill: "--success", ink: "--success-content", page: "--success-foreground", label: "success" },
      { fill: "--warning", ink: "--warning-content", page: "--warning-foreground", label: "warning" },
    ],
  },
  {
    title: "Lines",
    doc: "nothing sits on these, so they are drawn as themselves",
    row: [
      { token: "--border", label: "border" },
      { token: "--input", label: "input" },
      { token: "--ring", label: "ring" },
    ],
  },
] as const;

/** The eight syntax inks, read on the editor's paper — what fossil's editor paints a program in. */
const SYNTAX = ["keyword", "string", "number", "function", "variable", "property", "type", "annotation"].map(
  (role) => `--syntax-${role}`,
);

const COLOURS = [
  ...new Set(
    GROUPS.flatMap((g) =>
      "row" in g
        ? [...g.row.map((r) => r.token), ...("inks" in g ? g.inks.map((i) => i.token) : [])]
        : g.pairs.flatMap((p) => ("page" in p ? [p.fill, p.ink, p.page] : [p.fill, p.ink])),
    ),
  ),
  ...SYNTAX,
];

/** Authored by every shipped theme, offered by no picker here, and carried anyway: a block missing
 *  them is not a whole theme, and the pane would paint them from the docs site's own theme. */
const UNPICKERED = [
  "--popover",
  "--field",
  "--faint",
  "--chart-capacity",
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `--chart-${n}`),
];

const RADII = [
  { name: "--radius-box", label: "Boxes", doc: "card, dialog, alert", steps: ["0rem", "0.25rem", "0.5rem", "0.75rem", "1.25rem"] },
  { name: "--radius-field", label: "Fields", doc: "button, input, select, tab", steps: ["0rem", "0.25rem", "0.375rem", "0.5rem", "0.75rem"] },
  { name: "--radius-selector", label: "Selectors", doc: "checkbox, badge", steps: ["0rem", "0.125rem", "0.25rem", "0.375rem", "2rem"] },
] as const;
const SIZE_NAMES = ["xs", "sm", "md", "lg", "xl"] as const;
const SIZES = [
  { name: "--size-field", label: "Fields", doc: "control height unit", steps: ["0.2rem", "0.225rem", "0.25rem", "0.3rem", "0.34rem"] },
  { name: "--size-selector", label: "Selectors", doc: "checkbox, toggle", steps: ["0.2rem", "0.225rem", "0.25rem", "0.3rem", "0.34rem"] },
] as const;
const STROKES = ["0px", "1px", "1.5px", "2px", "3px"] as const;
const DEPTHS = [
  { value: "0", label: "Flat" },
  { value: "0.5", label: "Soft" },
  { value: "1", label: "Raised" },
] as const;

/** Decisions about the product rather than a side: one value, written to both blocks. */
const SHARED = [...RADII.map((r) => r.name), ...SIZES.map((r) => r.name), "--stroke", "--relief"];

const HEX = /^#[0-9a-f]{6}$/i;
const valid = (v: string | undefined): v is string => !!v && HEX.test(v.trim());
const proposed = (fill: string) => (valid(fill) ? inkFor(fill.trim()) : null);
const proposedPage = (fill: string, ground: string) =>
  valid(fill) && valid(ground) ? pageInk(fill.trim(), ground.trim()) : null;
const ratioOf = (a: string, b: string) => {
  if (!valid(a) || !valid(b)) return "";
  const r = wcag(a.trim(), b.trim());
  return r >= 4.5 ? r.toFixed(1) : `${r.toFixed(1)} !`;
};

/** Follow `--x`, then whatever `tokens.css` says `--x` defers to, until something has a value. */
function resolveIn(read: (token: string) => string, token: string, seen = new Set<string>()): string {
  if (seen.has(token)) return "";
  seen.add(token);
  const own = read(token).trim();
  if (own) return own;
  for (const next of (themeData.fallbacks as Record<string, string[]>)[token] ?? []) {
    const value = resolveIn(read, next, seen);
    if (value) return value;
  }
  return "";
}

/**
 * Every value one shipped theme resolves to, read off the cascade — there is no seed in this file.
 * The attribute goes on `<html>` and straight back off; `getComputedStyle` resolves synchronously,
 * so nothing paints in between.
 */
function readTheme(name: string): Tokens {
  const root = document.documentElement;
  const previous = root.getAttribute("data-theme");
  root.setAttribute("data-theme", name);
  const style = getComputedStyle(root);
  const out: Tokens = {};
  for (const token of [...COLOURS, ...UNPICKERED, ...SHARED]) {
    out[token] = resolveIn((t) => style.getPropertyValue(t), token);
  }
  if (previous === null) root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", previous);
  return out;
}

const FAMILIES = themeFamilies(themeIndex);
const familyOf = (name: string) =>
  FAMILIES.find((f) => f.family === name || f.light?.value === name || f.dark?.value === name);

function readFamily(name: string): Record<Side, Tokens> | null {
  const f = familyOf(name);
  if (!f?.light || !f.dark) return null;
  return { light: readTheme(f.light.value), dark: readTheme(f.dark.value) };
}

const title = (family: string) =>
  family.replace(/(^|-)([a-z])/g, (_, sep: string, c: string) => (sep ? " " : "") + c.toUpperCase());
const themeName = (family: string, side: Side) => (side === "light" ? family : `${family}-dark`);
const themeLabel = (family: string, side: Side) => (side === "light" ? title(family) : `${title(family)} Dark`);

/** The style attributes, reformatted — one block per side. There is no other serialiser. */
function toCss(pair: Record<Side, Tokens>, family: string): string {
  return SIDES.map((side) => {
    const theme = pair[side];
    const line = (k: string) => `  ${k}: ${theme[k]};`;
    const block = (heading: string, keys: string[]) =>
      [`\n  /* ${heading} */`, ...keys.filter((k) => theme[k]).map(line)].join("\n");
    return [
      `/* @family ${family}`,
      `   @label ${themeLabel(family, side)} */`,
      `[data-theme="${themeName(family, side)}"] {`,
      `  color-scheme: ${side};`,
      block("Colours", COLOURS.filter((t) => !SYNTAX.includes(t))),
      block("Carried without a picker", UNPICKERED),
      block("Shape", SHARED),
      block("Syntax", SYNTAX),
      "}",
    ].join("\n");
  }).join("\n\n");
}

/** The instance config keasy reads declaratively: the CSS, the families offered, the default, the lock. */
function toConfig(css: string, family: string): string {
  return [
    "branding:",
    "  theme_css: |",
    ...css.split("\n").map((l) => (l ? `    ${l}` : "")),
    "  families:",
    `    - family: ${family}`,
    `      light: { value: ${themeName(family, "light")}, label: ${themeLabel(family, "light")} }`,
    `      dark: { value: ${themeName(family, "dark")}, label: ${themeLabel(family, "dark")} }`,
    `  default: ${family}`,
    "  lock: false",
  ].join("\n");
}

const audit = (tokens: Tokens): ContrastFinding[] =>
  auditContrast((token) => resolveIn((t) => tokens[t] ?? "", token));

export function ThemeGenerator() {
  const [from, setFrom] = React.useState("kanzo");
  const [pair, setPair] = React.useState<Record<Side, Tokens>>({ light: {}, dark: {} });
  const [side, setSide] = React.useState<Side>("light");
  const [family, setFamily] = React.useState("acme");
  const [shareable, setShareable] = React.useState(false);
  const [href, setHref] = React.useState("");

  // After mount: `readTheme` touches `document`, and the route renders on the server first.
  React.useEffect(() => {
    if (!from) return;
    const read = readFamily(from);
    if (read) setPair(read);
  }, [from]);

  // `?from=<family or theme>` names a starting point — the catalogue links here with one. A name,
  // not values: the page goes and reads the theme itself.
  React.useEffect(() => {
    const asked = new URLSearchParams(window.location.search).get("from");
    const f = asked ? familyOf(asked) : undefined;
    if (f) setFrom(f.family);
  }, []);

  // A shared link wins by landing later; a side it did not carry keeps the default family's.
  React.useEffect(() => {
    let live = true;
    void decode(window.location.hash).then((shared) => {
      if (!live) return;
      if (shared) {
        const seed = readFamily(FAMILIES[0]?.family ?? "kanzo");
        setPair({
          light: shared.light ?? seed?.light ?? {},
          dark: shared.dark ?? seed?.dark ?? {},
        });
        setFamily(shared.family);
        setFrom("");
      }
      setShareable(true);
    });
    return () => {
      live = false;
    };
  }, []);

  // `replaceState`, never `pushState`: dragging a picker is not twenty entries of history.
  React.useEffect(() => {
    if (!shareable || Object.keys(pair.light).length === 0) return;
    const timer = window.setTimeout(() => {
      void encode({ family: family || "untitled", light: pair.light, dark: pair.dark }).then((fragment) => {
        window.history.replaceState(null, "", `#${fragment}`);
        setHref(window.location.href);
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [family, pair, shareable]);

  const theme = pair[side];
  const update = (fn: (prev: Tokens) => Tokens) => setPair((prev) => ({ ...prev, [side]: fn(prev[side]) }));
  const set = (key: string, value: string) => update((prev) => ({ ...prev, [key]: value }));
  const setShared = (key: string, value: string) =>
    setPair((prev) => ({ light: { ...prev.light, [key]: value }, dark: { ...prev.dark, [key]: value } }));

  /** Move a fill, and bring its inks with it if they are still the ones the rule proposed. */
  const setFill = (fill: string, ink: string, page?: string) => (value: string) =>
    update((prev) => {
      const was = prev[fill] ?? "";
      const ground = prev["--foreground"] ?? "";
      const next: Tokens = { ...prev, [fill]: value };
      if (prev[ink] === proposed(was)) next[ink] = proposed(value) ?? prev[ink] ?? "";
      if (page && prev[page] === proposedPage(was, ground)) next[page] = proposedPage(value, ground) ?? prev[page] ?? "";
      return next;
    });

  /** Move a surface or the page ink; a following page ink has `--foreground` as a parent too. */
  const setGround = (token: string) => (value: string) =>
    update((prev) => {
      const next: Tokens = { ...prev, [token]: value };
      if (token !== "--foreground") return next;
      for (const group of GROUPS) {
        if (!("pairs" in group)) continue;
        for (const p of group.pairs) {
          if (!("page" in p)) continue;
          const fill = prev[p.fill] ?? "";
          if (prev[p.page] === proposedPage(fill, prev[token] ?? "")) next[p.page] = proposedPage(fill, value) ?? "";
        }
      }
      return next;
    });

  const name = family || "untitled";
  const css = toCss(pair, name);
  const findings = { light: audit(pair.light), dark: audit(pair.dark) };
  const styleOf = (s: Side) => ({ ...pair[s], colorScheme: s }) as React.CSSProperties;

  return (
    <ShellRoot className="h-[calc(100dvh-var(--fd-nav-height))]">
      <ShellHeader>
        <div className="flex items-center gap-4 px-5 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <PaletteIcon className="size-4 shrink-0 text-muted-foreground" />
            <h1 className="shrink-0 font-semibold text-sm">Theme generator</h1>
            <span aria-hidden className="hidden h-4 w-px shrink-0 bg-border xl:block" />
            <p className="hidden truncate text-muted-foreground text-xs xl:block">
              A family is a light theme and a dark one. The pane wears both; the CSS is the same values.
            </p>
          </div>

          <div className="ms-auto flex shrink-0 items-center gap-2">
            <label className="flex items-center gap-2 text-xs" htmlFor="theme-from">
              <span className="hidden text-muted-foreground lg:block">Start from</span>
              <NativeSelect
                className="font-mono"
                id="theme-from"
                onChange={(e) => setFrom(e.target.value)}
                size="sm"
                value={from}
              >
                {from === "" && (
                  <NativeSelectOption disabled value="">
                    a shared link
                  </NativeSelectOption>
                )}
                {FAMILIES.map((f) => (
                  <NativeSelectOption key={f.family} value={f.family}>
                    {f.family}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
            <label className="flex items-center gap-2 text-xs" htmlFor="theme-family">
              <span className="hidden text-muted-foreground lg:block">Family</span>
              <Input
                className="w-32 font-mono"
                id="theme-family"
                onChange={(e) => setFamily(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                size="sm"
                value={family}
              />
            </label>
            <Button
              disabled={from === ""}
              onClick={() => {
                const read = readFamily(from);
                if (read) setPair(read);
              }}
              size="sm"
              variant="outline"
            >
              Reset
            </Button>
          </div>
        </div>
      </ShellHeader>

      <ShellBody>
        <ShellAside className="w-84 shrink-0 overflow-y-auto border-border border-e" side="start">
          <div className="flex flex-col gap-7 p-5">
            {/* Which side the colour pickers edit. Shape is shared, so it sits outside the switch. */}
            <div className="flex items-center gap-1 rounded-field border border-border p-0.5">
              {SIDES.map((s) => (
                <Button
                  aria-pressed={side === s}
                  className="flex-1"
                  key={s}
                  onClick={() => setSide(s)}
                  size="sm"
                  variant={side === s ? "secondary" : "ghost"}
                >
                  {s === "light" ? <SunIcon /> : <MoonIcon />}
                  {themeLabel(name, s)}
                  {findings[s].length > 0 ? (
                    <TriangleAlertIcon
                      aria-label={`${findings[s].length} contrast warnings`}
                      className="text-warning-foreground"
                    />
                  ) : null}
                </Button>
              ))}
            </div>

            {GROUPS.map((group) => (
              <section className="flex flex-col gap-2" key={group.title}>
                <SectionHead doc={group.doc} title={group.title} />
                {"row" in group ? (
                  <>
                    {group.row.map((one) => (
                      <ColorRow
                        fill={theme[one.token] ?? ""}
                        ink={theme["--foreground"] ?? ""}
                        key={one.token}
                        label={one.label}
                        onFill={setGround(one.token)}
                      />
                    ))}
                    {("inks" in group ? group.inks : []).map((ink) => (
                      <ColorRow
                        fill={theme[ink.on] ?? ""}
                        ink={theme[ink.token] ?? ""}
                        key={ink.token}
                        label={ink.label}
                        onFill={setGround(ink.on)}
                        onInk={setGround(ink.token)}
                      />
                    ))}
                  </>
                ) : (
                  group.pairs.map((p) => (
                    <ColorRow
                      fill={theme[p.fill] ?? ""}
                      ink={theme[p.ink] ?? ""}
                      inkSuggestion={proposed(theme[p.fill] ?? "")}
                      key={p.label}
                      label={p.label}
                      onFill={setFill(p.fill, p.ink, "page" in p ? p.page : undefined)}
                      onInk={(v) => set(p.ink, v)}
                      onPage={"page" in p ? (v) => set(p.page, v) : undefined}
                      page={"page" in p ? (theme[p.page] ?? "") : undefined}
                      pageGround={"page" in p ? (theme["--background"] ?? "") : undefined}
                      pageSuggestion={
                        "page" in p ? proposedPage(theme[p.fill] ?? "", theme["--foreground"] ?? "") : undefined
                      }
                    />
                  ))
                )}
              </section>
            ))}

            <section className="flex flex-col gap-2">
              <SectionHead doc="the editor's inks, read on the page and on the active line" title="Syntax" />
              {SYNTAX.map((token) => (
                <OklchPicker key={token} label={token} onChange={(v) => set(token, v)} value={theme[token] ?? ""}>
                  <span
                    className="flex h-9 w-full items-center gap-2 rounded-field border border-foreground/14 px-3"
                    style={{ background: theme["--background"] }}
                  >
                    <span className="truncate font-medium font-mono text-xs" style={{ color: theme[token] }}>
                      {token.slice("--syntax-".length)}
                    </span>
                    <span className="ms-auto font-mono text-[10px]" style={{ color: theme[token] }}>
                      {ratioOf(theme[token] ?? "", theme["--background"] ?? "")}
                    </span>
                  </span>
                </OklchPicker>
              ))}
            </section>

            <section className="flex flex-col gap-3">
              <SectionHead doc="a shape, not a number — shared by both sides" title="Radius" />
              {RADII.map((row) => (
                <StepRow
                  key={row.name}
                  {...row}
                  onPick={(v) => setShared(row.name, v)}
                  render={(v, on) => <CornerMark on={on} radius={v} />}
                  value={theme[row.name] ?? ""}
                />
              ))}
            </section>

            <section className="flex flex-col gap-3">
              <SectionHead doc="what a control's height is a multiple of" title="Size" />
              {SIZES.map((row) => (
                <StepRow
                  key={row.name}
                  {...row}
                  names={SIZE_NAMES}
                  onPick={(v) => setShared(row.name, v)}
                  render={(v, on) => <BarMark on={on} unit={v} />}
                  value={theme[row.name] ?? ""}
                />
              ))}
            </section>

            <section className="flex flex-col gap-3">
              <SectionHead doc="the weight of every line, and relief over every fill" title="Border and depth" />
              <StepRow
                doc="hairline"
                label="Stroke"
                onPick={(v) => setShared("--stroke", v)}
                render={(v, on) => <StrokeMark on={on} width={v} />}
                steps={STROKES}
                value={theme["--stroke"] ?? ""}
              />
              <div className="flex flex-col gap-1.5">
                <Legend doc="relief — a number, not a switch" label="Depth" />
                <div className="flex gap-1.5">
                  {DEPTHS.map((step) => (
                    <button
                      aria-pressed={theme["--relief"] === step.value}
                      className={cn(
                        "flex-1 rounded-field border px-2 py-1.5 text-xs transition-colors",
                        "outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
                        theme["--relief"] === step.value
                          ? "border-primary bg-primary/10 font-medium"
                          : "border-border hover:bg-foreground/6",
                      )}
                      key={step.value}
                      onClick={() => setShared("--relief", step.value)}
                      type="button"
                    >
                      {step.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </ShellAside>

        <ShellMain className="overflow-y-auto">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
            {/* Both sides at once, each wearing its own values: a pair is judged together. */}
            <div className="grid gap-4 sm:grid-cols-2">
              {SIDES.map((s) => (
                <button
                  aria-label={`Edit ${themeLabel(name, s)}`}
                  aria-pressed={side === s}
                  className={cn(
                    "rounded-box p-1 text-start outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring",
                    side === s ? "ring-2 ring-primary" : "hover:bg-foreground/6",
                  )}
                  key={s}
                  onClick={() => setSide(s)}
                  style={styleOf(s)}
                  type="button"
                >
                  <ThemePreview appearance={s} />
                </button>
              ))}
            </div>

            <ContrastReport family={name} findings={findings} />

            <div className="rounded-box bg-background text-foreground" style={styleOf(side)}>
              <div className="flex flex-col gap-4 p-4">
                <ThemeSampler />
              </div>
            </div>

            <OutputBlock config={toConfig(css, name)} css={css} link={href} />
          </div>
        </ShellMain>
      </ShellBody>
    </ShellRoot>
  );
}

/** The pairs below their WCAG floor, per side, named by token — the build's own list, live. */
function ContrastReport({ family, findings }: { family: string; findings: Record<Side, ContrastFinding[]> }) {
  const total = findings.light.length + findings.dark.length;
  return (
    <section aria-live="polite" className="flex flex-col gap-2 rounded-box border border-border p-4">
      <h2 className="flex items-center gap-2 font-medium text-sm">
        {total === 0 ? (
          <CheckIcon className="size-4 text-success-foreground" />
        ) : (
          <TriangleAlertIcon className="size-4 text-warning-foreground" />
        )}
        {total === 0 ? "Every pair clears its WCAG floor on both sides" : `${total} pairs below their WCAG floor`}
      </h2>
      {SIDES.map((s) =>
        findings[s].length > 0 ? (
          <ul className="flex flex-col gap-1 text-xs" key={s}>
            <li className="font-medium text-muted-foreground">{themeLabel(family, s)}</li>
            {findings[s].map((f) => (
              <li className="font-mono" key={`${f.ground}-${f.ink}`}>
                {f.ink} on {f.ground}: {f.ratio.toFixed(2)} — needs {f.min}
              </li>
            ))}
          </ul>
        ) : null,
      )}
    </section>
  );
}

function SectionHead({ doc, title }: { doc: string; title: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2.5">
        <h2 className="shrink-0 font-medium text-sm">{title}</h2>
        <span aria-hidden className="h-px flex-1 bg-border" />
      </div>
      <p className="text-muted-foreground text-xs leading-snug">{doc}</p>
    </div>
  );
}

function Legend({ doc, label }: { doc?: string; label: string }) {
  return (
    <span className="flex items-baseline gap-2">
      <span className="font-medium text-xs">{label}</span>
      {doc ? <span className="truncate text-[11px] text-muted-foreground italic">{doc}</span> : null}
    </span>
  );
}

/**
 * A colour, picked in OKLCH: lightness, chroma and hue as three sliders, and the hex that ships.
 * OKLCH because its lightness is perceptual — moving L is the move that changes contrast, and it
 * does so without the hue drifting the way HSL's does.
 */
function OklchPicker({
  children,
  className,
  label,
  onChange,
  value,
}: {
  children: React.ReactNode;
  className?: string;
  label: string;
  onChange: (hex: string) => void;
  value: string;
}) {
  const lch = valid(value) ? oklch(value) : { l: 0.5, c: 0, h: 0 };
  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => setDraft(value), [value]);
  const channel = (key: "l" | "c" | "h", text: string, min: number, max: number, step: number) => (
    <Slider
      aria-label={[`${label} ${text}`]}
      max={max}
      min={min}
      onValueChange={(d) => onChange(hex({ ...lch, [key]: d.value[0] ?? lch[key] }))}
      step={step}
      value={[lch[key]]}
    >
      <SliderLabel className="flex w-full gap-2 font-mono text-[11px]">
        <span>{text}</span>
        <span className="ms-auto text-muted-foreground">{lch[key].toFixed(key === "h" ? 0 : 3)}</span>
      </SliderLabel>
    </Slider>
  );
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex w-full min-w-0 rounded-field text-start outline-none transition-transform hover:scale-[1.01]",
            "focus-visible:ring-[3px] focus-visible:ring-ring",
            className,
          )}
          title={label}
          type="button"
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent className="flex w-64 flex-col gap-3 p-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="size-8 shrink-0 rounded-field border border-border"
            style={{ background: value }}
          />
          <Input
            aria-label={`${label} hex`}
            className="font-mono"
            onChange={(e) => {
              setDraft(e.target.value);
              if (valid(e.target.value)) onChange(e.target.value.trim().toLowerCase());
            }}
            size="sm"
            value={draft}
          />
        </div>
        {channel("l", "Lightness", 0, 1, 0.005)}
        {channel("c", "Chroma", 0, 0.37, 0.002)}
        {channel("h", "Hue", 0, 360, 1)}
      </PopoverContent>
    </Popover>
  );
}

/** One token, as a filled row with its name written in the ink that sits on it. */
function ColorRow({
  fill,
  ink,
  inkSuggestion,
  label,
  onFill,
  onInk,
  onPage,
  page,
  pageGround,
  pageSuggestion,
}: {
  fill: string;
  ink: string;
  inkSuggestion?: string | null;
  label: string;
  onFill: (hex: string) => void;
  onInk?: (hex: string) => void;
  onPage?: (hex: string) => void;
  page?: string;
  pageGround?: string;
  pageSuggestion?: string | null;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <OklchPicker className="flex-1" label={label} onChange={onFill} value={fill}>
        <span
          className="flex h-10 w-full items-center gap-2 rounded-field border border-foreground/14 px-3"
          style={{ background: fill }}
        >
          <span className="truncate font-medium text-xs" style={{ color: ink }}>
            {label}
          </span>
          <span className="ms-auto shrink-0 font-mono text-[10px]" style={{ color: ink }}>
            {ratioOf(fill, ink)}
          </span>
        </span>
      </OklchPicker>
      {onInk !== undefined && (
        <InkSquare
          ground={fill}
          label={`${label} ink`}
          onChange={onInk}
          suggestion={inkSuggestion ?? null}
          value={ink}
        />
      )}
      {page !== undefined && onPage !== undefined && (
        <InkSquare
          ground={pageGround}
          label={`${label} on the page`}
          onChange={onPage}
          suggestion={pageSuggestion ?? null}
          value={page}
        />
      )}
    </div>
  );
}

/** An ink, drawn ON the surface it is read on, with the mark saying whether it follows its fill. */
function InkSquare({
  ground,
  label,
  onChange,
  suggestion,
  value,
}: {
  ground?: string;
  label: string;
  onChange: (hex: string) => void;
  suggestion: string | null;
  value: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <OklchPicker className="w-auto" label={label} onChange={onChange} value={value}>
        <span
          className="grid size-10 place-items-center rounded-field border border-foreground/14"
          style={{ background: ground ?? value }}
        >
          <span aria-hidden className="font-semibold text-base leading-none" style={{ color: value }}>
            A
          </span>
          <span className="sr-only">{label}</span>
        </span>
      </OklchPicker>
      <Follow ink={value} onDerive={onChange} suggestion={suggestion} />
    </div>
  );
}

/** Following the proposal, or chosen by hand — read off the value, never stored. */
function Follow({
  ink,
  onDerive,
  suggestion,
}: {
  ink: string;
  onDerive: (hex: string) => void;
  suggestion: string | null;
}) {
  if (suggestion === null) return null;
  if (ink.toLowerCase() === suggestion.toLowerCase()) {
    return (
      <span className="shrink-0 text-muted-foreground/70" title="The proposed ink: it follows the fill.">
        <LinkIcon aria-hidden className="size-3" />
        <span className="sr-only">following the fill</span>
      </span>
    );
  }
  return (
    <button
      className="shrink-0 rounded-selector p-px text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring"
      onClick={() => onDerive(suggestion)}
      title={`Chosen by hand. Take the proposed ${suggestion} and follow the fill again.`}
      type="button"
    >
      <UnlinkIcon aria-hidden className="size-3" />
      <span className="sr-only">restore the proposed ink</span>
    </button>
  );
}

function StepRow({
  doc,
  label,
  names,
  onPick,
  render,
  steps,
  value,
}: {
  doc?: string;
  label: string;
  name?: string;
  names?: readonly string[];
  onPick: (value: string) => void;
  render: (value: string, on: boolean) => React.ReactNode;
  steps: readonly string[];
  value: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Legend doc={doc} label={label} />
      <div className="flex gap-1.5">
        {steps.map((step, i) => (
          <button
            aria-label={`${label} ${names?.[i] ?? step}`}
            aria-pressed={value === step}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 rounded-field border py-1.5 transition-colors",
              "outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
              names ? "" : "h-9",
              value === step ? "border-primary bg-primary/10" : "border-border hover:bg-foreground/6",
            )}
            key={step}
            onClick={() => onPick(step)}
            type="button"
          >
            {render(step, value === step)}
            {names ? <span className="font-mono text-[10px] text-muted-foreground">{names[i]}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function CornerMark({ on, radius }: { on: boolean; radius: string }) {
  return (
    <span
      aria-hidden
      className={cn("block size-5 border-s-2 border-t-2", on ? "border-primary" : "border-muted-foreground")}
      style={{ borderStartStartRadius: radius }}
    />
  );
}

function BarMark({ on, unit }: { on: boolean; unit: string }) {
  return (
    <span
      aria-hidden
      className={cn("block w-4 rounded-[2px]", on ? "bg-primary" : "bg-muted-foreground")}
      style={{ height: `calc(${unit} * 6)` }}
    />
  );
}

function StrokeMark({ on, width }: { on: boolean; width: string }) {
  return (
    <span
      aria-hidden
      className={cn("block w-5 rounded-full", on ? "bg-primary" : "bg-muted-foreground")}
      style={{ height: width === "0px" ? "1px" : width, opacity: width === "0px" ? 0.3 : 1 }}
    />
  );
}

/** What to take away: the theme file for the repository, or the snippet for an instance's config. */
function OutputBlock({ config, css, link }: { config: string; css: string; link: string }) {
  return (
    <Tabs defaultValue="css">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <TabsList>
          <TabsTrigger value="css">Theme CSS</TabsTrigger>
          <TabsTrigger value="config">Instance config</TabsTrigger>
        </TabsList>
        <Clipboard className="ms-auto shrink-0" value={link}>
          <ClipboardTrigger>
            <Button size="sm" variant="ghost">
              <ClipboardIndicator copied={<CheckIcon />}>
                <LinkIcon />
              </ClipboardIndicator>
              Copy link
            </Button>
          </ClipboardTrigger>
        </Clipboard>
      </div>
      <TabsContent className="flex flex-col gap-2" value="css">
        <Output
          hint={
            <>
              Two blocks, one per side. In this repository each is its own{" "}
              <code className="font-mono">packages/theme/themes/&lt;name&gt;.css</code>, then{" "}
              <code className="font-mono">pnpm --filter @kanzo-tech/theme gen</code>.
            </>
          }
          text={css}
        />
      </TabsContent>
      <TabsContent className="flex flex-col gap-2" value="config">
        <Output
          hint="For an instance: the CSS, the families its members may choose, the default, and whether the choice is locked."
          text={config}
        />
      </TabsContent>
    </Tabs>
  );
}

function Output({ hint, text }: { hint: React.ReactNode; text: string }) {
  return (
    <>
      <div className="flex items-start gap-3">
        <p className="min-w-0 flex-1 text-muted-foreground text-xs">{hint}</p>
        <Clipboard className="shrink-0" value={text}>
          <ClipboardTrigger>
            <Button size="sm">
              <ClipboardIndicator copied={<CheckIcon />}>
                <CopyIcon />
              </ClipboardIndicator>
              Copy
            </Button>
          </ClipboardTrigger>
        </Clipboard>
      </div>
      <pre className="max-h-96 overflow-auto rounded-box border border-border bg-muted p-4 font-mono text-[11px] text-muted-foreground leading-relaxed">
        {text}
      </pre>
    </>
  );
}
