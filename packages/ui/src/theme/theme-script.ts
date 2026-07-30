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
// It carries NO colour. The tenant is known at request time, so the server inlines the compiled
// palette document as a static <style> in <head> — the colour maths is done before a byte is sent,
// and there is no pairing table, no base tint and no primary override left to resolve here.
//
// MANDATORY under SSR, not an optimisation. Skipping it costs more than a flash: any control
// whose markup depends on the resolved theme (`AppearanceToggle`) renders one value on the
// server and another on hydration, which React reports as a mismatch and does not patch.
//
// This script must reach the SAME `class` + `data-*` as the provider from the same inputs —
// theme-script.test.ts runs both under one set of stubs and diffs `<html>`, because a divergence
// here IS the FOUC and the hydration mismatch the script exists to prevent.
//
// Hosting a theme manager already? Point `appearanceKey` at ITS storage key — but note that the
// provider reads the legacy key from `APPEARANCE_KEY` only, so a different key here means the two
// disagree about a migrating user's preference. Prefer disabling the host's class writer instead.

import { APPEARANCE_KEY, AXES, STORAGE_KEY } from "@kanzo-tech/theme";

export interface ThemeScriptOptions {
  /** Must match the provider's `storageKey` / the cookie adapter's key. */
  storageKey?: string;
  /** The LEGACY standalone appearance key, read only when the prefs blob has no `appearance`. */
  appearanceKey?: string;
}

/** Returns the IIFE source (a string) to inline before hydration. Safe to embed in HTML. */
export function themeScript({ storageKey = STORAGE_KEY, appearanceKey = APPEARANCE_KEY }: ThemeScriptOptions = {}): string {
  // Only the serialisable axis map is needed at runtime.
  const axes = JSON.stringify(AXES.map((a) => [a.key, a.attr, a.def]));
  const sk = JSON.stringify(storageKey);
  const ak = JSON.stringify(appearanceKey);
  return (
    "(function(){try{" +
    "var d=document.documentElement,P={};" +
    // cookie first (server-readable), then localStorage
    "try{var c=document.cookie.match(new RegExp('(?:^|; )'+" + sk + "+'=([^;]*)'));if(c&&c[1])P=JSON.parse(decodeURIComponent(c[1]));}catch(e){}" +
    "if(!P||!Object.keys(P).length){try{var s=localStorage.getItem(" + sk + ");if(s)P=JSON.parse(s);}catch(e){}}" +
    // appearance PREFERENCE: the prefs blob, then the legacy standalone key (localStorage, then
    // cookie). Reading only the blob resets every pre-migration user to `system`.
    "var ap=P.appearance;" +
    "if(ap==null){try{ap=localStorage.getItem(" + ak + ");}catch(e){}}" +
    "if(ap==null){try{var ca=document.cookie.match(new RegExp('(?:^|; )'+" + ak + "+'=([^;]*)'));if(ca&&ca[1])ap=decodeURIComponent(ca[1]);}catch(e){}}" +
    // anything that is not an explicit side means "ask the OS".
    "var W=(ap==='light'||ap==='dark')?ap:((window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light');" +
    // the four non-colour axes
    "var A=" + axes + ";for(var i=0;i<A.length;i++){var k=A[i][0],at=A[i][1],df=A[i][2],v=P[k];if(v==null||v===df){d.removeAttribute(at);}else{d.setAttribute(at,String(v));}}" +
    // `style.colorScheme` is never written: an inline declaration outranks every rule permanently,
    // and each block of the compiled palette document carries its own `color-scheme`.
    "d.classList.toggle('dark',W==='dark');" +
    "}catch(e){}})();"
  );
}
