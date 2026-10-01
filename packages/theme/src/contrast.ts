import { AA, contrast } from "./ink.js";

/**
 * A ground, the ink or mark read on it, and the WCAG floor between them.
 *
 * `4.5` is body text (1.4.3); `3` is a UI component's boundary or a graphical object (1.4.11) — a
 * focus ring, a field's border, a chart mark, and a brand fill that has to stand out from the page.
 */
export interface ContrastPair {
  ground: string;
  ink: string;
  min: number;
}

const text = (ground: string, ink: string): ContrastPair => ({ ground, ink, min: AA });
const mark = (ground: string, ink: string): ContrastPair => ({ ground, ink, min: 3 });

const SYNTAX = ["keyword", "string", "number", "function", "variable", "property", "type", "annotation"];

/**
 * Every pair a theme owes, by the names the vocabulary gives them.
 *
 * One list for the guard over the shipped files (`themes.test.ts`) and for the generator's live
 * warnings, so the page that authors a theme cannot pass what the build rejects.
 *
 * `--accent` is measured against both inks because it is a SURFACE here — the ground a hovered or
 * selected row wears — not a third brand fill as in daisyUI. A status family's `-content` sits on
 * the fill; its `-foreground` is the same family read on the page. Syntax is read on the editor's
 * paper (`--background`) and on its active line (`--muted`).
 */
export const CONTRAST_PAIRS: readonly ContrastPair[] = [
  text("--background", "--foreground"),
  text("--card", "--foreground"),
  text("--popover", "--foreground"),
  text("--muted", "--muted-foreground"),
  text("--background", "--muted-foreground"),
  text("--primary", "--primary-foreground"),
  text("--secondary", "--secondary-foreground"),
  text("--accent", "--accent-foreground"),
  text("--accent", "--muted-foreground"),
  text("--destructive", "--destructive-content"),
  text("--info", "--info-content"),
  text("--success", "--success-content"),
  text("--warning", "--warning-content"),
  text("--sidebar", "--sidebar-foreground"),
  text("--background", "--destructive-foreground"),
  text("--background", "--info-foreground"),
  text("--background", "--success-foreground"),
  text("--background", "--warning-foreground"),
  ...SYNTAX.flatMap((role) => [
    text("--background", `--syntax-${role}`),
    text("--muted", `--syntax-${role}`),
  ]),
  mark("--background", "--primary"),
  mark("--background", "--ring"),
  mark("--background", "--input"),
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => mark("--background", `--chart-${n}`)),
];

export interface ContrastFinding extends ContrastPair {
  ratio: number;
}

const OPAQUE = /^#[0-9a-f]{6}$/i;

/**
 * The pairs a theme fails, given a way to resolve a token to its value.
 *
 * A pair whose either side does not resolve to an opaque hex is skipped, not failed: an alpha or a
 * missing token is a different defect, and the guard that resolves the bridge is what reports it.
 */
export function auditContrast(
  resolve: (token: string) => string | null | undefined,
  pairs: readonly ContrastPair[] = CONTRAST_PAIRS,
): ContrastFinding[] {
  const out: ContrastFinding[] = [];
  for (const pair of pairs) {
    const [a, b] = [resolve(pair.ground)?.trim(), resolve(pair.ink)?.trim()];
    if (!a || !b || !OPAQUE.test(a) || !OPAQUE.test(b)) continue;
    const ratio = contrast(a, b);
    if (ratio < pair.min) out.push({ ...pair, ratio });
  }
  return out;
}
