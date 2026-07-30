import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**"] },
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
    // Node build scripts (e.g. the theme generator) run under Node, not the browser.
    files: ["**/scripts/*.mjs"],
    languageOptions: {
      globals: { console: "readonly", process: "readonly", URL: "readonly", Buffer: "readonly" },
    },
  },
  {
    // The simples are adopted from Shark UI, with declared divergences — the focus ring
    // is solid where Shark dilutes it, on a measured contrast finding (CONVENTIONS.md).
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
