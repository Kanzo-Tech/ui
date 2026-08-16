// SSR anti-FOUC: a tiny inline script that applies the persisted theme to <html> BEFORE the
// first paint, so the server-rendered markup never flashes the default theme then re-skins on
// hydration. It reads the SAME source as the provider (cookie first — server-readable — then
// localStorage), and mirrors the provider's "remove attribute when default" rule exactly.
//
// Usage:
//   • TanStack Start:  <ScriptOnce>{themeScript()}</ScriptOnce>  (in the root document)
//   • Next.js / RSC:   inject via useServerInsertedHTML, or a <script dangerouslySetInnerHTML>
//                      in the root layout <head>. (React 19 warns about <script> in the tree;
//                      useServerInsertedHTML / dangerouslySetInnerHTML avoid that.)
//   • Plain HTML:      <script>{themeScript()}</script> as the first thing in <head>.
//
// Pair with `cookieStorageAdapter(storageKey)` on the provider so client writes land where the
// script (and the server) read from.
//
// It carries no colour VALUE. The tenant is known at request time, so the server inlines the
// compiled palette document as a static <style> in <head> — the colour maths is done before a byte
// is sent, and there is no pairing table, no base tint and no primary override left to resolve
// here. `data-identity` is the one colour-adjacent thing it writes, and it writes it as a string
// off the axis table like any other: choosing among the blocks that document already contains.
//
// MANDATORY under SSR, not an optimisation. Skipping it costs more than a flash: any control
// whose markup depends on the resolved theme (`AppearanceToggle`) renders one value on the
// server and another on hydration, which React reports as a mismatch and does not patch.
//
// This script must reach the SAME `class` + `data-*` as the provider from the same inputs —
// theme-script.test.ts runs both under one set of stubs and diffs `<html>`, because a divergence
// here IS the FOUC and the hydration mismatch the script exists to prevent.
//
// Hosting a theme manager already? Disable its class writer rather than pointing this at its
// storage: two owners of `.dark` fight over the same class, and the loser wins at random.

import { AXES, STORAGE_KEY } from "@kanzo-tech/theme";

export interface ThemeScriptOptions {
  /** Must match the provider's `storageKey` / the cookie adapter's key. */
  storageKey?: string;
}

/** Returns the IIFE source (a string) to inline before hydration. Safe to embed in HTML. */
export function themeScript({ storageKey = STORAGE_KEY }: ThemeScriptOptions = {}): string {
  // Only the serialisable axis map is needed at runtime.
  // The fourth element says "index this by the resolved appearance". It rides on the same row the
  // provider reads, so the two cannot disagree about which axes are keyed and which are plain.
  const axes = JSON.stringify(AXES.map((a) => [a.key, a.attr, a.def, a.byAppearance ?? false]));
  const sk = JSON.stringify(storageKey);
  return (
    "(function(){try{" +
    "var d=document.documentElement,P={};" +
    // cookie first (server-readable), then localStorage
    "try{var c=document.cookie.match(new RegExp('(?:^|; )'+" + sk + "+'=([^;]*)'));if(c&&c[1])P=JSON.parse(decodeURIComponent(c[1]));}catch(e){}" +
    "if(!P||!Object.keys(P).length){try{var s=localStorage.getItem(" + sk + ");if(s)P=JSON.parse(s);}catch(e){}}" +
    // The appearance PREFERENCE is one field of the blob and has no second home. Anything that is
    // not an explicit side means "ask the OS" — which is why this line never changed when `"system"`
    // was removed from the model. It was always the whole resolution; the third value only ever
    // existed in the React half, and `null` needs no case of its own because it is not `'light'` and
    // not `'dark'`.
    "var ap=P.appearance;" +
    "var W=(ap==='light'||ap==='dark')?ap:((window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light');" +
    // every axis, from the table itself. `data-identity` needs no case of its own and gets none:
    // the stored id is written VERBATIM and never checked against what the tenant published,
    // because an attribute selector with no matching rule is inert and the cascade falls through
    // to `:root` — which is the default identity. Validating here would mean knowing the document,
    // and the two sides would stop agreeing the moment they disagreed about it.
    "var A=" + axes + ";for(var i=0;i<A.length;i++){var k=A[i][0],at=A[i][1],df=A[i][2],v=A[i][3]?((P[k]||{})[W]):P[k];if(typeof v!=='string'||v===df){d.removeAttribute(at);}else{d.setAttribute(at,v);}}" +
    // `style.colorScheme` is never written: an inline declaration outranks every rule permanently,
    // and each block of the compiled palette document carries its own `color-scheme`.
    "d.classList.toggle('dark',W==='dark');" +
    "}catch(e){}})();"
  );
}
