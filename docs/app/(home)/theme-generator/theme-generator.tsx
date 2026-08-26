"use client";

import {
  Button,
  Clipboard,
  ClipboardIndicator,
  ClipboardTrigger,
  ColorPicker,
  ColorPickerArea,
  ColorPickerAreaThumb,
  ColorPickerContent,
  ColorPickerControl,
  ColorPickerSlider,
  ColorPickerTrigger,
  cn,
  Input,
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
  ShellAside,
  ShellBody,
  ShellHeader,
  ShellMain,
  ShellRoot,
  Switch,
} from "@kanzo-tech/ui";
import { contrast as wcag, inkFor, pageInk, themeData, themeIndex } from "@kanzo-tech/theme";
import {
  CheckIcon,
  CopyIcon,
  Link2Icon as LinkIcon,
  Link2OffIcon as UnlinkIcon,
  PaletteIcon,
} from "lucide-react";
import * as React from "react";
import { ThemeSampler } from "./theme-sampler";
import { decode, encode } from "./link";

/**
 * A theme, authored.
 *
 * **This is the surface the refactor was for, and the one `Preferences` is not.** The panel lets a
 * USER choose among themes a tenant published; nothing in the library let anybody *write* one,
 * because writing one meant running a thirteen-stage derivation. A theme is thirty-two declarations
 * at its floor — and about fifty in the ones that ship, which also author the optional chart and
 * syntax sets — so authoring is a form, and this route is that form, in the same components a
 * consumer has.
 *
 * ## It is a page of the site, and it was a showcase in an iframe
 *
 * `/theme-generator`, under the site nav, which is where daisyUI keeps the same tool. A showcase is
 * an arrangement the documentation *exhibits*; this is an instrument the documentation *offers*,
 * and the iframe it used to sit in cost it a URL somebody could send, a title, its place in the
 * nav, and the address bar its own Copy-link button had to stand in for. Nothing about the
 * arrangement changed in the move: it is still a shell that claims what the nav leaves it.
 *
 * ## Nothing here is a preview OF a theme; it IS one
 *
 * The pane on the right carries the knobs as inline custom properties, and an inline declaration on
 * an element is exactly what a `[data-theme]` block is — same properties, same cascade, resolved on
 * the same elements. So the specimens below are not approximations painted from a state object:
 * they are real components reading real tokens, and the CSS this page hands you is the style
 * attribute reformatted. **There is no serialiser to disagree with the preview** — and that is a
 * property of the list, not of the mechanism, which is the thing to hold on to. It held for the
 * twenty-five names the form has knobs for and was false for four it did not: `--popover`,
 * `--field`, `--input` and `--faint` were neither seeded nor emitted, so the pane resolved them
 * against the docs site's own theme and the block came out incomplete. `UNPICKERED` carries them
 * now. **Anything a theme authors has to be in one of those lists, knob or no knob**, because a
 * name the pane does not set is a name it paints from somewhere else.
 *
 * That only works because of the bridge in `tokens.css`: every name in the vocabulary that is a
 * *use* of one of the twenty-one is inlined into its utility, so `bg-sidebar-primary` resolves on
 * the element rather than once on `<html>`. Set them in `:root` instead and this pane would paint
 * the page's colours no matter what the knobs said.
 *
 * ## It proposes, it does not decide
 *
 * Picking a fill proposes the ink that belongs on it, by the rule in `packages/theme/src/ink.ts` —
 * daisyUI's own, recovered from its output and measured against it. **The proposal is not a
 * lock.** An ink you have changed stops following its fill, and the form knows which is which by
 * comparing the value to the rule rather than by remembering that you touched it: there is no
 * hidden dirty flag to get out of step with what you can see.
 *
 * This is the half of the derivation that was worth keeping, and putting it here is what keeps it
 * honest. `a-theme-is-one-flat-block` cut a multi-second search that shipped beside a stylesheet;
 * what replaced it was nobody computing the boring half at all, and fifty-four hand-typed
 * declarations per theme. A form that fills in the obvious ink is not that search coming back — it
 * runs once, on one colour, in an editor, and what it writes is a literal.
 *
 * **It does check contrast, and it did not always.** The ratio beside each pair is a hint and not a
 * guard: what checks the *artefact* is `status.test.ts`, over the themes that actually ship. But a
 * rule that proposes an ink owes you the number for what it proposed.
 *
 * **It writes nothing.** No file, no `<html>` attribute, no storage. You copy a block and put it in
 * `packages/theme/themes/`, which is the whole of what shipping a theme is.
 */

/**
 * The twenty-one, and **each one has exactly one picker**.
 *
 * That rule is not decoration, it is the bug the first draft had: pairing every surface with an ink
 * put `--foreground` under `background`, under `card` AND under `border`, so one token had three
 * controls and two of them were lying about what they belonged to. The reference does not do that —
 * its `base` row is three fills and *one* content — and the reason is the same one the token layer
 * collapsed for: a value with two spellings is a value that drifts.
 *
 * So a group is one of two shapes:
 *
 * · **`pairs`** — a fill and the ink meant to sit ON it, where the ink belongs to that fill and to
 *   nothing else. Drawn as two squares with an `A` painted on the second, which is the reference's
 *   move and the best thing in its generator: you see whether the pair *reads* before any number.
 * · **`row`** — tokens with no such partner. The surfaces share their two inks between them; a
 *   border and a ring are lines and nothing sits on them.
 */
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
      { token: "--ring", label: "ring" },
    ],
  },
] as const;

/** A picker mid-drag can hand back something that is not yet a colour. */
const HEX = /^#[0-9a-f]{6}$/i;

/**
 * WCAG contrast, for the pair you are looking at.
 *
 * **This is a hint, not the guard, and the difference matters.** What the refactor gave up was a
 * contrast measurement made at DERIVATION time — one that could refuse to publish. A grader under a
 * picker does not restore that; it only tells whoever is dragging. What actually catches a mistake
 * is `packages/ui/src/simples/status.test.ts`, which reads every theme file that ships and fails the
 * build.
 *
 * It earns its place on a narrower claim: the pair is already drawn — an `A` on its own fill — and a
 * number beside a picture you can already read removes the guesswork from *is that dark enough?*.
 * Not shown for the surfaces row, where the ink is shared and no single pair is the answer.
 *
 * The maths is `@kanzo-tech/theme`'s, not a third copy of it — `inkFor` has to agree with the number
 * shown beside the swatch it proposes, and two implementations of WCAG is exactly how it would not.
 */
function contrast(a: string, b: string): number | null {
  return HEX.test(a.trim()) && HEX.test(b.trim()) ? wcag(a.trim(), b.trim()) : null;
}

/**
 * The ink the rule proposes for a fill, or `null` if there is nothing to propose from.
 *
 * See `packages/theme/src/ink.ts` for where the rule comes from and what it was measured against.
 * Here it is only ever a *suggestion*: the value that ships is whatever hex ends up in the block.
 */
function proposed(fill: string): string | null {
  return HEX.test(fill.trim()) ? inkFor(fill.trim()) : null;
}

/** The page ink the rule proposes for a fill read on `ground`. A different job — see `pageInk`. */
function proposedPage(fill: string, ground: string): string | null {
  return HEX.test(fill.trim()) && HEX.test(ground.trim()) ? pageInk(fill.trim(), ground.trim()) : null;
}

/**
 * The contrast of a pair, written on the pair itself.
 *
 * It was a chip — a rounded pill in `bg-success/15` or `bg-destructive/15` — and that was wrong once
 * the row became a filled block: a tinted pill on a brand fill is a second surface fighting the one
 * being judged, and on eleven of the twenty-nine themes it was a saturated colour on a saturated
 * colour. The number now wears the row's own ink, which is also the honest thing: it is a *reading*
 * of that pair, so it should be legible exactly when the pair is.
 *
 * A number and not a verdict. The mark for a failure is a `!`, because red is unavailable here (it
 * would be a third colour on the fill) and because this page does not refuse — the guard over the
 * shipped files does.
 */
function ratioOf(fill: string, ink: string): string {
  const value = contrast(fill, ink);
  if (value === null) return "";
  return value >= 4.5 ? value.toFixed(1) : `${value.toFixed(1)} !`;
}

/** Discrete steps, drawn rather than named — the reference's move, and it is the better one. */
const RADII = [
  { name: "--radius-box", label: "Boxes", doc: "card, dialog, alert", steps: ["0rem", "0.25rem", "0.5rem", "0.75rem", "1.25rem"] },
  { name: "--radius-field", label: "Fields", doc: "button, input, select, tab", steps: ["0rem", "0.25rem", "0.5rem", "0.75rem", "1rem"] },
  { name: "--radius-selector", label: "Selectors", doc: "checkbox, badge", steps: ["0rem", "0.125rem", "0.25rem", "0.5rem", "9999px"] },
] as const;

/**
 * The five size steps, drawn AND named.
 *
 * Named because the reference names them — its `Sizes` section offers `xs` through `xl` — and
 * because these five differ by hundredths of a rem: the drawn bars are two pixels apart, which
 * shows you the direction and not the step you are on. The radius and stroke rows stay unnamed,
 * where the drawing carries the whole difference.
 */
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

/**
 * Two, not a slider.
 *
 * `--noise` multiplies the grain layer's *size*, so at 0 it is not painted and at 1 it tiles.
 * Anything between is a texture drawn larger than its tile, which is a smear rather than a
 * quantity of grain — the knob reads as on or off because that is what it does.
 */
const NOISES = [
  { value: "0", label: "Smooth" },
  { value: "1", label: "Grain" },
] as const;

const FONTS = [
  { value: "ui-sans-serif, system-ui, sans-serif", label: "System" },
  { value: "Georgia, ui-serif, serif", label: "Serif" },
  { value: "ui-monospace, SFMono-Regular, Menlo, monospace", label: "Mono" },
];

/**
 * A starting point, read off the stylesheet the page is already wearing.
 *
 * **There is no seed in this file, and that is the point.** There used to be: thirty-odd hex
 * literals typed here as "the same ones `themes/kanzo.css` ships". They were not. Five had drifted
 * — `--card`, `--muted`, `--muted-foreground`, `--accent` and `--ring` — and nothing could have
 * caught it, because a copy is only wrong compared to the thing it copies and nobody was comparing.
 *
 * So the values come from the cascade instead: stamp `data-theme` on the document, read the
 * computed custom properties, put the attribute back. Same stylesheet, same selectors, same
 * resolution the page uses — the seed cannot disagree with the theme because it *is* the theme.
 *
 * A theme authors about thirty of the fifty-four names and defers the rest, so reading a token
 * plainly would come back empty for the ones it left alone. `themeData.fallbacks` is what
 * `tokens.css` says those defer to, generated from it rather than restated here, and
 * {@link readTheme} walks it. That is the one piece of the bridge this file needs and it does not
 * own a copy of it either.
 */
const AUTHORED = [
  ...new Set(
    GROUPS.flatMap((g) =>
      "row" in g
        ? [...g.row.map((r) => r.token), ...("inks" in g ? g.inks.map((i) => i.token) : [])]
        : g.pairs.flatMap((p) => ["page" in p ? [p.fill, p.ink, p.page] : [p.fill, p.ink]]).flat(),
    ),
  ),
] as const;

/**
 * Authored by every shipped theme, offered by no picker here — and **carried anyway**.
 *
 * `GROUPS` is the form, and `AUTHORED` is derived from it, so for a while "has a control" and "is
 * in the theme" were the same list. They are not the same thing. These four are authored by all
 * sixteen files in `packages/theme/themes/` and the form has no mando for them, for a reason that
 * is recorded: their formulas disperse too far across the catalogue to propose a value from a fill.
 *
 * Leaving them out of the list cost two things, both of them real:
 *
 * · The block the page hands you was not a complete theme. A theme written here shipped with its
 *   field borders at the weight of `--border` and its placeholders at `--muted-foreground`,
 *   because that is what `tokens.css` defers to when a theme is silent about them.
 * · The preview pane sets the theme as inline custom properties and carries no `data-theme`, so a
 *   name it does not set resolves against the *docs site's* ambient theme instead of the one being
 *   edited. Four tokens in the pane were painting somebody else's colours.
 *
 * That second one is why the file docblock's "there is no serialiser to disagree with the preview"
 * needed the qualifier it now carries: the claim held for the twenty-five with knobs and failed
 * for exactly these.
 */
const UNPICKERED = ["--popover", "--field", "--input", "--faint"] as const;

const SHAPE = [
  ...RADII.map((r) => r.name),
  ...SIZES.map((r) => r.name),
  "--stroke",
  "--depth",
  "--noise",
] as const;
const TYPE = ["--font-sans", "--font-heading"] as const;

/** Follow `--x`, then whatever `tokens.css` says `--x` defers to, until something has a value. */
function resolve(style: CSSStyleDeclaration, token: string, seen = new Set<string>()): string {
  if (seen.has(token)) return "";
  seen.add(token);
  const own = style.getPropertyValue(token).trim();
  if (own) return own;
  for (const next of (themeData.fallbacks as Record<string, string[]>)[token] ?? []) {
    const value = resolve(style, next, seen);
    if (value) return value;
  }
  return "";
}

/**
 * Every value one shipped theme resolves to.
 *
 * The attribute goes on `<html>` and comes straight back off: `getComputedStyle` resolves
 * synchronously, so nothing paints in between and the page never flickers through the theme being
 * read. It has to be `<html>` rather than a hidden probe because a probe inherits every token its
 * ancestors declare, which would quietly blend the theme being read with the one already on.
 */
function readTheme(name: string): Record<string, string> {
  const root = document.documentElement;
  const previous = root.getAttribute("data-theme");
  root.setAttribute("data-theme", name);
  const style = getComputedStyle(root);
  const out: Record<string, string> = {};
  for (const token of [...AUTHORED, ...UNPICKERED, ...SHAPE, ...TYPE])
    out[token] = resolve(style, token);
  if (previous === null) root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", previous);
  return out;
}

/** `nord` ⇄ `nord-dark`, when the catalogue ships both. A theme is a mode; its other side is another theme. */
function counterpart(name: string): string | null {
  const other = name.endsWith("-dark") ? name.slice(0, -"-dark".length) : `${name}-dark`;
  return themeIndex.some((t) => t.name === other) ? other : null;
}

/** The style attribute, reformatted. There is no other serialiser — see the file docblock. */
function toCss(theme: Record<string, string>, name: string, dark: boolean) {
  const line = (k: string) => `  ${k}: ${theme[k]};`;
  const block = (title: string, keys: string[]) =>
    [`\n  /* ${title} */`, ...keys.filter((k) => theme[k]).map(line)].join("\n");
  return [
    `[data-theme="${name}"] {`,
    `  color-scheme: ${dark ? "dark" : "light"};`,
    block("The twenty-one", [...AUTHORED]),
    // The shipped files keep these in their own block under the same heading, and the block a
    // reader pastes should look like the ones beside it.
    block("Authored pending a measured color-mix default", [...UNPICKERED]),
    block("Shape", [...SHAPE]),
    block("Type", [...TYPE]),
    "}",
  ].join("\n");
}

export function ThemeGenerator() {
  const [from, setFrom] = React.useState("kanzo");
  const [theme, setTheme] = React.useState<Record<string, string>>({});
  const [name, setName] = React.useState("acme");
  const [dark, setDark] = React.useState(false);

  const [shareable, setShareable] = React.useState(false);
  const [href, setHref] = React.useState("");

  // Read after mount, not during: `readTheme` touches `document` and the route renders on the
  // server first. An empty first paint is the honest shape of "the values live in the stylesheet".
  React.useEffect(() => {
    // `""` means the values came from a fragment, so there is no shipped theme to re-read.
    if (!from) return;
    setTheme(readTheme(from));
    setDark(themeIndex.find((t) => t.name === from)?.dark ?? false);
  }, [from]);

  /**
   * A fragment wins over the catalogue, and it wins by landing later.
   *
   * No flag arbitrates between the two: the seed above is synchronous and this is a promise, so a
   * shared link always overwrites the theme that was seeded a tick earlier. `shareable` then opens
   * the write-back below — without it the first write would race the read and put the seeded theme
   * in the URL, which is the shape of bug where opening somebody's link silently replaces it.
   */
  /**
   * `?from=<theme>` names a starting point; the [catalogue](/docs/themes) links here with one.
   *
   * A name rather than an encoded document, deliberately. The catalogue already knows every value of
   * every theme — it is wearing them — and could hand them over, but then the link would carry a
   * copy of the stylesheet and this page would open on whatever the catalogue believed at the time
   * it rendered. A name makes it go and read the theme itself.
   */
  React.useEffect(() => {
    const asked = new URLSearchParams(window.location.search).get("from");
    if (asked && themeIndex.some((t) => t.name === asked)) setFrom(asked);
  }, []);

  React.useEffect(() => {
    let live = true;
    void decode(window.location.hash).then((shared) => {
      if (!live) return;
      if (shared) {
        setTheme(shared.tokens);
        setName(shared.name);
        setDark(shared.dark);
        // The control would otherwise read "Start from: kanzo" for a theme that did not come from
        // kanzo. It is a control rather than a readout, so pressing it still re-seeds — but it may
        // not claim, while sitting there, to describe where these values are from.
        setFrom("");
      }
      setShareable(true);
    });
    return () => {
      live = false;
    };
  }, []);

  // `replaceState`, never `pushState`: dragging a picker is not twenty entries of browser history.
  React.useEffect(() => {
    if (!shareable || Object.keys(theme).length === 0) return;
    const timer = window.setTimeout(() => {
      void encode({ name: name || "untitled", dark, tokens: theme }).then((fragment) => {
        window.history.replaceState(null, "", `#${fragment}`);
        setHref(window.location.href);
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [dark, name, shareable, theme]);

  const set = (key: string, value: string) =>
    setTheme((prev) => ({ ...prev, [key]: value }));

  /**
   * Move a fill, and bring its ink with it **if the ink is still the one the rule proposed**.
   *
   * The linkage is computed, never stored: an ink equal to `inkFor(fill)` is following, anything
   * else was chosen. That is the whole mechanism, and it is worth the sentence because the obvious
   * alternative — a `touched` flag per token — is a second copy of a fact the values already carry,
   * and it goes stale the moment a reset, a side switch or a paste writes a value around it.
   */
  const setFill =
    (fillToken: string, inkToken: string, pageToken?: string) =>
    (value: string) =>
      setTheme((prev) => {
        const ground = prev["--foreground"] ?? "";
        const next: Record<string, string> = { ...prev, [fillToken]: value };
        const was = prev[fillToken] ?? "";
        if (prev[inkToken] === proposed(was)) {
          const ink = proposed(value);
          if (ink) next[inkToken] = ink;
        }
        if (pageToken && prev[pageToken] === proposedPage(was, ground)) {
          const ink = proposedPage(value, ground);
          if (ink) next[pageToken] = ink;
        }
        return next;
      });

  /**
   * Move the page's own colours, and bring every following page ink with them.
   *
   * A page ink is the fill mixed toward `--foreground`, so it has two parents rather than one and
   * moving the page's ink has to move it too. (It is *measured* against `--background`, which is a
   * different token and not this function's business — confusing the two is what made the first
   * version propose pale salmon on a pale page.) Same predicate as everywhere else — following means *equal to
   * what the rule proposes* — which is why this can be a plain function over the previous state
   * instead of a subscription: there is nothing to keep in sync because nothing is stored.
   */
  const setGround = (token: string) => (value: string) =>
    setTheme((prev) => {
      const next: Record<string, string> = { ...prev, [token]: value };
      if (token !== "--foreground") return next;
      for (const group of GROUPS) {
        if (!("pairs" in group)) continue;
        for (const pair of group.pairs) {
          if (!("page" in pair)) continue;
          const fill = prev[pair.fill] ?? "";
          if (prev[pair.page] !== proposedPage(fill, prev[token] ?? "")) continue;
          const ink = proposedPage(fill, value);
          if (ink) next[pair.page] = ink;
        }
      }
      return next;
    });

  const css = toCss(theme, name || "untitled", dark);

  return (
    // The viewport minus the site nav, because this page sits under one. `flex-1` was the first
    // answer and it was wrong: `body` is `min-h-screen`, so a flex child grows past the fold
    // instead of being clipped by it — the shell's two panes stopped scrolling, the whole document
    // scrolled, and the header went off the top on the way down. `--fd-nav-height` is declared in
    // `global.css` beside the rest of the chrome's parameters, so the number is written once.
    <ShellRoot className="h-[calc(100dvh-var(--fd-nav-height))]">
      {/* The strip goes INSIDE the region, which is what `ShellHeader` is for: it is a `flex-col`
          that bars stack in, so a row written onto the region itself is a row fighting the axis its
          own recipe declares. That is what put the title in the middle of the bar — it looked
          centred because it *was*, by `items-center` on a column — and the controls on a second
          line under it. Everything else here follows from the row: the title does not take
          `flex-1`, the description truncates and steps aside below `xl`, and the controls hold
          their size on the end. */}
      <ShellHeader>
        <div className="flex items-center gap-4 px-5 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <PaletteIcon className="size-4 shrink-0 text-muted-foreground" />
          <h1 className="shrink-0 font-semibold text-sm">Theme generator</h1>
          <span aria-hidden className="hidden h-4 w-px shrink-0 bg-border xl:block" />
          <p className="hidden truncate text-muted-foreground text-xs xl:block">
            The pane on the right wears these values; the block at its foot is the same values,
            reformatted.
          </p>
        </div>

        <div className="ms-auto flex shrink-0 items-center gap-2">
          {/* The catalogue, not a list typed here — `themeIndex` is read off disk by the generator
              precisely so no second list can drift from what ships. Twenty-nine to start from,
              which is the reference's move: nobody authors a theme from a blank page, they open the
              nearest one and disagree with it. Grouped by side because that is the one fact the
              catalogue carries besides the name, and because a flat list of twenty-nine is a
              scroll. It was a bare `<select>` with a hand-written class string until the studio
              stopped being a showcase; `NativeSelect` is the same element with the recipe on it. */}
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
              {(["light", "dark"] as const).map((side) => (
                <NativeSelectOptGroup key={side} label={side}>
                  {themeIndex
                    .filter((t) => t.dark === (side === "dark"))
                    .map((t) => (
                      <NativeSelectOption key={t.name} value={t.name}>
                        {t.name}
                      </NativeSelectOption>
                    ))}
                </NativeSelectOptGroup>
              ))}
            </NativeSelect>
          </label>

          <label className="flex items-center gap-2 text-xs" htmlFor="theme-name">
            <span className="hidden text-muted-foreground lg:block">Name</span>
            <Input
              className="w-36 font-mono"
              id="theme-name"
              onChange={(e) => setName(e.target.value)}
              size="sm"
              value={name}
            />
          </label>

          {/* Not an appearance toggle: a theme IS a mode, so this decides what `color-scheme` the
              block says — which side you are authoring FOR, not which side you are looking at. */}
          <label className="flex items-center gap-2 ps-1 text-xs" htmlFor="theme-dark">
            <span className="text-muted-foreground">Dark</span>
            <Switch
              checked={dark}
              id="theme-dark"
              onCheckedChange={(d) => {
                const next = d.checked === true;
                setDark(next);
                // Only the twenty-one move. The radius, the stroke and the typefaces you chose are
                // decisions about the PRODUCT, not about a side, so switching sides must not undo
                // them. Where the catalogue ships the other side of what you started from, that is
                // where the colours come from — starting the other theme rather than translating
                // this one, because one side is not a function of the other. Where it does not,
                // only `color-scheme` moves and the colours stay yours to fix.
                const other = counterpart(from);
                if (!other) return;
                const source = readTheme(other);
                setTheme((prev) => ({
                  ...prev,
                  ...Object.fromEntries(
                    [...AUTHORED, ...UNPICKERED].map((t) => [t, source[t] ?? prev[t] ?? ""]),
                  ),
                }));
              }}
            />
          </label>

          <Button
            disabled={from === ""}
            onClick={() => setTheme(readTheme(from))}
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
            {GROUPS.map((group) => (
              <section className="flex flex-col gap-2" key={group.title}>
                <SectionHead doc={group.doc} title={group.title} />

                {/* One filled tile per token, the name written INSIDE it in the ink that belongs
                    to it. That is the reference's control and it replaced a grid of small squares
                    with the name underneath: a square tells you what you picked, a filled row with
                    its own name on it tells you whether the pair *reads*, which is the only
                    question either of them is for. It also ends the ragged half-rows — every token
                    is one row of the same height, whether it has an ink, two inks or none. */}
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
                    {/* An ink row is named for the INK and filled with the surface it is read on,
                        so the row is the pair. Editing the row edits that surface — which is the
                        same token the row above it edits, deliberately: they are one value, and a
                        second control for it would be a second place for it to drift. */}
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
                  group.pairs.map((pair) => (
                    <ColorRow
                      fill={theme[pair.fill] ?? ""}
                      ink={theme[pair.ink] ?? ""}
                      inkSuggestion={proposed(theme[pair.fill] ?? "")}
                      key={pair.label}
                      label={pair.label}
                      onFill={setFill(pair.fill, pair.ink, "page" in pair ? pair.page : undefined)}
                      onInk={(hex) => set(pair.ink, hex)}
                      onPage={"page" in pair ? (hex) => set(pair.page, hex) : undefined}
                      page={"page" in pair ? (theme[pair.page] ?? "") : undefined}
                      pageGround={"page" in pair ? (theme["--background"] ?? "") : undefined}
                      pageSuggestion={
                        "page" in pair
                          ? proposedPage(theme[pair.fill] ?? "", theme["--foreground"] ?? "")
                          : undefined
                      }
                    />
                  ))
                )}
              </section>
            ))}

            <section className="flex flex-col gap-3">
              <SectionHead doc="a shape, not a number" title="Radius" />
              {RADII.map((row) => (
                <StepRow
                  key={row.name}
                  {...row}
                  onPick={(v) => set(row.name, v)}
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
                  onPick={(v) => set(row.name, v)}
                  render={(v, on) => <BarMark on={on} unit={v} />}
                  value={theme[row.name] ?? ""}
                />
              ))}
            </section>

            {/* Two sections where there was one. The reference keeps `Border Width` apart from its
                `Effects`, and it is right to: a line weight is a measurement of the frame and
                relief and grain are treatments of a surface. Under one heading called "Stroke,
                depth and noise" the rail was reading as a bin for whatever was left. */}
            <section className="flex flex-col gap-3">
              <SectionHead doc="the weight of every line in the theme" title="Border width" />
              <StepRow
                doc="hairline"
                label="Stroke"
                name="--stroke"
                onPick={(v) => set("--stroke", v)}
                render={(v, on) => <StrokeMark on={on} width={v} />}
                steps={STROKES}
                value={theme["--stroke"] ?? ""}
              />
            </section>

            <section className="flex flex-col gap-3">
              <SectionHead doc="relief and grain, over every fill" title="Effects" />
              {/* Three named steps rather than a slider: `--depth` reads as a *material*, and a
                  number between Soft and Raised is not a decision anybody is making. The reference
                  offers two — a checkbox, on or off — and the middle step is our one divergence
                  here, because `--depth` multiplies into a `calc()` and 0.5 is a real value. */}
              <div className="flex flex-col gap-1.5">
                <Legend doc="relief — a number, not a switch" label="Depth" />
                <div className="flex gap-1.5">
                  {DEPTHS.map((step) => (
                    <button
                      aria-pressed={theme["--depth"] === step.value}
                      className={cn(
                        "flex-1 rounded-field border px-2 py-1.5 text-xs transition-colors",
                        "outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
                        theme["--depth"] === step.value
                          ? "border-primary bg-primary/10 font-medium"
                          : "border-border hover:bg-foreground/6",
                      )}
                      key={step.value}
                      onClick={() => set("--depth", step.value)}
                      type="button"
                    >
                      {step.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Legend doc="grain over every fill — off, or on" label="Noise" />
                <div className="flex gap-1.5">
                  {NOISES.map((step) => (
                    <button
                      // `|| "0"` mirrors the sheet, which writes `var(--noise, 0)`: no shipped
                      // theme declares this one, so "absent" and "smooth" are the same answer and
                      // the control must not show neither pressed.
                      aria-pressed={(theme["--noise"] || "0") === step.value}
                      className={cn(
                        "flex-1 rounded-field border px-2 py-1.5 text-xs transition-colors",
                        "outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
                        (theme["--noise"] || "0") === step.value
                          ? "border-primary bg-primary/10 font-medium"
                          : "border-border hover:bg-foreground/6",
                      )}
                      key={step.value}
                      onClick={() => set("--noise", step.value)}
                      type="button"
                    >
                      {step.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <SectionHead
                doc="where daisyUI has nothing — and the heading face is the one that carries identity"
                title="Type"
              />
              {/* **Drawn, not listed.** `Preferences` already settled this — its font control renders
                  each face as a specimen, and `packages/ui/src/composites/Preferences.test.tsx`
                  asserts it ("draws each font in its own face"). A `<select>` of names asks you to
                  remember what Georgia looks like; a specimen shows you. Same rule here. */}
              {(["--font-sans", "--font-heading"] as const).map((token) => (
                <div className="flex flex-col gap-1.5" key={token}>
                  <Legend
                    doc={token === "--font-sans" ? "body text" : "titles — the one that carries identity"}
                    label={token === "--font-sans" ? "Body" : "Headings"}
                  />
                  <div className="flex gap-1.5">
                    {FONTS.map((font) => (
                      <button
                        aria-pressed={theme[token] === font.value}
                        className={cn(
                          "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-field border px-2 py-2",
                          "transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
                          theme[token] === font.value
                            ? "border-primary bg-primary/10"
                            : "border-border hover:bg-foreground/6",
                        )}
                        key={font.label}
                        onClick={() => set(token, font.value)}
                        type="button"
                      >
                        <span
                          aria-hidden
                          className="text-xl leading-none"
                          style={{ fontFamily: font.value }}
                        >
                          Ag
                        </span>
                        <span className="truncate text-[11px] text-muted-foreground">{font.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          </div>
        </ShellAside>

        <ShellMain className="overflow-y-auto">
          {/* THE theme. An inline declaration block on an element is what a `[data-theme]` rule is,
              so everything below reads the same tokens a shipped theme would publish. */}
          <div
            className="min-h-full bg-background text-foreground"
            style={{ ...theme, colorScheme: dark ? "dark" : "light" } as React.CSSProperties}
          >
            {/* Capped and centred. Uncapped, every card stretched to the pane — a week strip with
                seven days spread over 1,200px, which is a measurement of the window rather than of
                the theme. A theme is judged at the width an interface is actually built at. */}
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-6">
              <ThemeSampler />
              <CssBlock css={css} link={href} />
            </div>
          </div>
        </ShellMain>
      </ShellBody>
    </ShellRoot>
  );
}

/** A section's name, a hairline, and one line saying what it decides. The reference's header. */
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
 * One token, as a filled row with its own name written on it.
 *
 * **This is the reference's control, and the shape it replaced is the reason to say so.** The first
 * draft drew a pair as two small squares with an `A` on the second and the name in mono underneath
 * — which reads as a swatch library. daisyUI draws one wide block per colour with the token's name
 * *inside it*, in the ink that belongs to that fill, and the difference is not decoration: a square
 * tells you what you picked, and a filled row carrying its own name tells you whether the pair
 * READS. That is the only question a colour control is for, and it is the failure this layer keeps
 * having — an ink measured against one fill and then put on another.
 *
 * It also ended the ragged rail. Pairs came in twos and threes, so a two-column grid left half-rows
 * everywhere and the names truncated to `dest…`; every token is one row of one height now, whether
 * it carries no ink, one, or one plus a page ink.
 *
 * The two small squares on the end are the inks themselves, for when the proposal is not what you
 * want: the first sits ON the fill, the second on `--background`, and each opens its own picker.
 * The `A` is gone with the pair layout — the name in the row is a better specimen of the same
 * thing, because it is text at text size rather than one letter at 18px.
 */
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
  /** What is written on the row. For a surface this is `--foreground`; for a pair, the fill's ink. */
  ink: string;
  inkSuggestion?: string | null;
  label: string;
  onFill: (hex: string) => void;
  /** Absent for a surface with no ink of its own — then the row is a specimen and not a pair. */
  onInk?: (hex: string) => void;
  onPage?: (hex: string) => void;
  /** The same family read on the page rather than on the fill — the status families' third token. */
  page?: string;
  pageGround?: string;
  pageSuggestion?: string | null;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <ColorPicker className="min-w-0 flex-1" onValueChange={(d) => onFill(d.valueAsHex)} value={fill}>
        <ColorPickerControl className="w-full min-w-0">
          <ColorPickerTrigger
            className={cn(
              "flex h-10 w-full items-center gap-2 rounded-field px-3",
              // A near-white fill on a near-white page is invisible without one, and a strong ring
              // would read as a selected state. `--foreground` at 14% is a hairline that is always
              // there — and it is the PAGE's foreground, not the row's ink, because the outline
              // belongs to the rail rather than to the colour it holds.
              "border border-foreground/14 transition-transform hover:scale-[1.01]",
              "outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
            )}
            style={{ background: fill }}
            title={label}
          >
            <span className="truncate font-medium text-xs" style={{ color: ink }}>
              {label}
            </span>
            <span className="ms-auto shrink-0 font-mono text-[10px]" style={{ color: ink }}>
              {ratioOf(fill, ink)}
            </span>
          </ColorPickerTrigger>
        </ColorPickerControl>
        <ColorPickerContent>
          <ColorPickerArea>
            <ColorPickerAreaThumb />
          </ColorPickerArea>
          <ColorPickerSlider channel="hue" />
        </ColorPickerContent>
      </ColorPicker>

      {/* `&&`, not `Show`: its children are an eager prop and these dereference values a row
          without an ink does not have. That exception is written down in `docs/CLAUDE.md`. */}
      {onInk !== undefined && (
        <InkSquare
          // ON the fill, always. Without a ground the square painted the ink as its own fill and
          // then wrote the `A` in that same ink — black on black, white on white, invisible on
          // every row that had one. An ink is never a fill; it is only ever a reading on something.
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

/**
 * An ink, as a small square that opens a picker, with the link mark under it.
 *
 * `ground` draws it as ink ON a surface rather than as a fill of its own, which is the honest
 * depiction for a page ink: that token is never a fill anywhere.
 */
function InkSquare({
  ground,
  label,
  onChange,
  suggestion,
  value,
}: {
  /** The surface this ink is read on. Required in practice — see the note at the call site. */
  ground?: string;
  label: string;
  onChange: (hex: string) => void;
  suggestion: string | null;
  value: string;
}) {
  // The link mark sits BESIDE the square, not under it. Under it, the mark added its own line to a
  // column and the row grew past the 40px every other row is, so the rail read as ragged again for
  // a reason that had nothing to do with colour.
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <ColorPicker onValueChange={(d) => onChange(d.valueAsHex)} value={value}>
        <ColorPickerControl>
          <ColorPickerTrigger
            className={cn(
              "grid size-10 place-items-center rounded-field p-0",
              "border border-foreground/14 transition-transform hover:scale-[1.03]",
              "outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
            )}
            style={{ background: ground ?? value }}
            title={label}
          >
            <span aria-hidden className="font-semibold text-base leading-none" style={{ color: value }}>
              A
            </span>
            <span className="sr-only">{label}</span>
          </ColorPickerTrigger>
        </ColorPickerControl>
        <ColorPickerContent>
          <ColorPickerArea>
            <ColorPickerAreaThumb />
          </ColorPickerArea>
          <ColorPickerSlider channel="hue" />
        </ColorPickerContent>
      </ColorPicker>
      <Link ink={value} onDerive={onChange} suggestion={suggestion} />
    </div>
  );
}

/**
 * Whether this ink is following its fill, and the way back if it is not.
 *
 * Two states and no third: the ink either *is* what the rule proposes — in which case it moves when
 * the fill moves and the mark is inert — or it is not, and the mark becomes the button that puts it
 * back. Nothing here stores which; both read off the value. A pair that has never been touched
 * therefore shows as linked without anybody having recorded that it was, and so does a pair you
 * dragged all the way back to the proposal by hand, which is the correct answer to a question about
 * what the value *is*.
 */
function Link({
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
      <span
        className="shrink-0 text-[10px] text-muted-foreground/70"
        title="This ink is the one the rule proposes, so it follows the fill. Change it and it stops."
      >
        <LinkIcon aria-hidden className="size-3" />
        <span className="sr-only">following the fill</span>
      </span>
    );
  }
  return (
    <button
      className={cn(
        "shrink-0 rounded-selector p-px text-muted-foreground transition-colors hover:text-foreground",
        "outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
      )}
      onClick={() => onDerive(suggestion)}
      title={`Chosen by hand. Take the proposed ${suggestion} and follow the fill again.`}
      type="button"
    >
      <UnlinkIcon aria-hidden className="size-3" />
      <span className="sr-only">restore the proposed ink</span>
    </button>
  );
}

/** Five discrete steps, each DRAWN. Picking a shape beats dragging a number toward one. */
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
  /** A word under each mark, where the drawing alone cannot tell two steps apart. */
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
            {names ? (
              <span className="font-mono text-[10px] text-muted-foreground">{names[i]}</span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

/** One corner, at that radius — the reference draws exactly this, and nothing reads faster. */
function CornerMark({ on, radius }: { on: boolean; radius: string }) {
  return (
    <span
      aria-hidden
      className={cn("block size-5 border-t-2 border-s-2", on ? "border-primary" : "border-muted-foreground")}
      style={{ borderStartStartRadius: radius }}
    />
  );
}

/** A control at that height unit, so the step is the thing it produces. */
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


/**
 * The block, to paste into `packages/theme/themes/`.
 *
 * **Quiet on purpose.** It was a `Card` with a title and a description, which put it at the same
 * visual weight as the specimens above it and made the pane read as two competing subjects. The
 * output is not the subject — the *theme* is; this is where you go once you have one. So: a hairline
 * panel, a mono body on the recessed surface, and the label doing the explaining in one line.
 */
function CssBlock({ css, link }: { css: string; link: string }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          {/* The reference's heading, in our words: it says what to DO with the block rather than
              naming it. `The theme` named a thing already on screen, which is the one sentence a
              heading here cannot afford — the block is the artefact, and the instruction is the
              only part a reader does not already have. */}
          <h2 className="font-medium text-sm">Add this theme to your CSS</h2>
          <p className="text-muted-foreground text-xs">
            Save it as <code className="font-mono">packages/theme/themes/&lt;name&gt;.css</code> and
            run <code className="font-mono">pnpm --filter @kanzo-tech/theme gen</code>.
          </p>
        </div>
        {/* Two things to take away, and they say which is which. `Copy` alone did not: beside a
            `Copy link` it reads as the other half of a pair rather than as the CSS. The link
            button existed because the studio lived in an iframe with no address bar, and it earns
            its place anyway — the fragment is 435 characters, and selecting a URL by hand to send
            it is worse than pressing a button that names what it copies. */}
        <Clipboard className="shrink-0" value={link}>
          <ClipboardTrigger>
            <Button size="sm" variant="ghost">
              <ClipboardIndicator copied={<CheckIcon />}>
                <LinkIcon />
              </ClipboardIndicator>
              Copy link
            </Button>
          </ClipboardTrigger>
        </Clipboard>
        <Clipboard className="shrink-0" value={css}>
          <ClipboardTrigger>
            <Button size="sm">
              <ClipboardIndicator copied={<CheckIcon />}>
                <CopyIcon />
              </ClipboardIndicator>
              Copy CSS
            </Button>
          </ClipboardTrigger>
        </Clipboard>
      </div>
      <pre className="max-h-96 overflow-auto rounded-box border border-border bg-muted p-4 font-mono text-[11px] leading-relaxed text-muted-foreground">
        {css}
      </pre>
    </section>
  );
}
