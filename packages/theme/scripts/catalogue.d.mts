export interface CatalogueTheme {
  /** `kanzo.css` */
  file: string;
  /** `kanzo` — the `data-theme` value. */
  value: string;
  family: string;
  label: string;
  /** The theme's own `color-scheme`. */
  dark: boolean;
  /** Binds the unattributed document on its side (`:root:not([data-theme])`, or `.dark` between). */
  bare: boolean;
  /** The file as written, comments and all. */
  source: string;
  /** `--name` → value, as written, comments out. */
  declarations: ReadonlyMap<string, string>;
}

export interface Catalogue {
  /** Picker order: the default family first, then by family, light before dark. */
  themes: readonly CatalogueTheme[];
  /** `tokens.css` as written. */
  tokens: string;
  /** What `tokens.css` declares in `:root` and `@theme static`. */
  root: ReadonlyMap<string, string>;
  /** The `@theme inline` bridge: `--color-popover` → `var(--popover, var(--card))`. */
  bridge: ReadonlyMap<string, string>;
  /** `--popover` → `["--card"]`: what a token defers to when a theme stays quiet. */
  fallbacks: Readonly<Record<string, readonly string[]>>;
}

export function parseTheme(file: string, css: string): CatalogueTheme;
export function orderThemes(themes: readonly CatalogueTheme[]): CatalogueTheme[];
export const catalogue: Catalogue;
