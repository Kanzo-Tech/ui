import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  // `.next` and `.source` are build output the same way `dist` is — Next's compiled bundles and
  // fumadocs' generated map. Linting them is 35,000 findings about code nobody wrote, which is how
  // `docs/` came to be excluded from linting altogether; excluded properly, the real count is 75.
  // `docs/out/` joined this list when the documentation gained a static export: it is `.next/`'s
  // output under a name that does not start with a dot, so nothing was skipping it and `pnpm lint`
  // started reporting `'self' is not defined` inside minified webpack chunks.
  { ignores: ["**/dist/**", "**/node_modules/**", "**/.next/**", "**/.source/**", "docs/out/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      // Classic hook rules only. We deliberately do NOT enable the v7
      // react-compiler rules (e.g. "refs during render"): the "latest props in a
      // stable callback" pattern (`const p = useRef(x); p.current = x`) is used on
      // purpose in long-lived CodeMirror editors.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    // Node scripts — the theme generator, the Shark surface refresher, the benchmark runner, the
    // corpus builders — run under Node, not the browser. Matched by extension rather than by
    // directory: the glob was `**/scripts/*.mjs`, so the five under `docs/showcases/graph-bench/`
    // were reported as 64 undefined `console`s. A `.mjs` in this repo is a Node script; there is
    // no other kind.
    files: ["**/*.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        URL: "readonly",
        Buffer: "readonly",
        // A Node global since 18, and `package.json` requires >=20, so a script that talks to a
        // network (`packages/ui/scripts/refresh-shark-surface.mjs`) needs no import for it.
        fetch: "readonly",
        // `run-bench.mjs` drives a page: these appear inside `page.evaluate` callbacks, which are
        // serialised and run in the browser, not here.
        document: "readonly",
        window: "readonly",
      },
    },
  },
  {
    // The simples are adopted from Shark UI, with declared divergences — the focus ring
    // is solid where Shark dilutes it, on a measured contrast finding.
    // Do not "restore" a difference to match upstream without reading why it is there.
    // These three rules only ever fire on Shark's own conventions, none of which are
    // real defects:
    //  · empty extension interfaces (`interface XProps extends Y {}`),
    //  · context hooks named `_useX` and re-exported as `useX` (a rules-of-hooks
    //    false positive — the leading `_` hides the `use` prefix from the linter),
    //  · a `className` deliberately destructured out so it can't leak onto an Ark part.
    files: ["packages/ui/src/simples/*.tsx"],
    rules: {
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/rules-of-hooks": "off",
    },
  },
);
