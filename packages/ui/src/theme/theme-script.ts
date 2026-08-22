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
// theme catalogue in the stylesheet — there is no colour maths, and no document to choose between
// is sent, and there is no pairing table, no base tint and no primary override left to resolve
// here. `data-theme` is the colour one it writes, and it writes it as a string
// off the axis table like any other: choosing among the blocks that document already contains.
//
// MANDATORY under SSR, not an optimisation. Skipping it costs more than a flash: any control
// whose markup depends on the resolved theme (`PreferencesColor`'s side cards) renders one value on the
// server and another on hydration, which React reports as a mismatch and does not patch.
//
// This script must reach the SAME `class` + `data-*` as the provider from the same inputs —
// theme-script.test.ts runs both under one set of stubs and diffs `<html>`, because a divergence
// here IS the FOUC and the hydration mismatch the script exists to prevent.
//
// Hosting a theme manager already? Disable its class writer rather than pointing this at its
// storage: two owners of `.dark` fight over the same class, and the loser wins at random.

import {
  AXES,
  CORE_NAMESPACE,
  CORE_PREFS,
  prefOptions,
  STORAGE_KEY,
  type SectionPolicy,
} from "@kanzo-tech/theme";

export interface ThemeScriptOptions {
  /** Must match the provider's `storageKey` / the cookie adapter's key. */
  storageKey?: string;
  /**
   * The TENANT's policy — the same object the provider takes, keyed by namespace.
   *
   * **Pass it if you pass it to the provider.** A pinned axis this script does not know about is a
   * flash of the user's own value followed by the client's, which is the exact defect the script
   * exists to prevent, arriving through the feature that was supposed to give a client control.
   * Only the core's namespace is read here: a section's attribute is written after hydration.
   */
  policy?: Record<string, SectionPolicy>;
}

/** Returns the IIFE source (a string) to inline before hydration. Safe to embed in HTML. */
export function themeScript({
  storageKey = STORAGE_KEY,
  policy = {},
}: ThemeScriptOptions = {}): string {
  // Only the serialisable part of each declaration is needed at runtime: key, attribute, default,
  // whether it is keyed by appearance, and the options to gate a stored value against.
  //
  // `prefOptions(decl)` with no sources answers `null` for the two axes whose options a TENANT
  // publishes, which becomes `0` here and means *do not gate*. That is not a shortcut around a
  // limitation of this script — the provider passes no sources for those two either, deliberately,
  // so that the value this writes before the first paint and the value React writes after
  // hydration cannot differ. See the theme block in `KanzoThemeProvider`.
  const row = (key: string) => {
    const decl = CORE_PREFS[key as keyof typeof CORE_PREFS];
    return [key, decl.attr ?? 0, decl.default, decl.byAppearance ?? 0, prefOptions(decl)?.map((o) => o.value) ?? 0];
  };
  const axes = JSON.stringify(AXES.map((a) => row(a.key)));
  // Appearance is resolved before the loop because the loop needs the side it resolves to: a keyed
  // axis is indexed by it. Same order the provider runs in, for the same reason.
  const appearance = JSON.stringify(row("appearance"));
  const pol = JSON.stringify(policy[CORE_NAMESPACE] ?? {});
  const sk = JSON.stringify(storageKey);
  return (
    "(function(){try{" +
    "var d=document.documentElement,P={};" +
    // cookie first (server-readable), then localStorage
    "try{var c=document.cookie.match(new RegExp('(?:^|; )'+" + sk + "+'=([^;]*)'));if(c&&c[1])P=JSON.parse(decodeURIComponent(c[1]));}catch(e){}" +
    "if(!P||!Object.keys(P).length){try{var s=localStorage.getItem(" + sk + ");if(s)P=JSON.parse(s);}catch(e){}}" +
    // ONE chain, four links, and it is `resolvePref`'s: pinned, stored, the tenant's starting
    // point, the declaration's default. Written out here rather than imported because this is a
    // string of JavaScript in a `<script>` tag — but it is the same order, gated the same way, and
    // `theme-script.test.ts` runs both sides under one set of stubs and diffs `<html>`.
    "var PO=" + pol + ";" +
    "function ok(v,o){return typeof v==='string'&&(!o||o.indexOf(v)>=0);}" +
    "function pick(p,s,df,o){return ok(p.pinned,o)?p.pinned:((!p.hidden&&ok(s,o))?s:(ok(p['default'],o)?p['default']:df));}" +
    // Appearance first: it decides `.dark`, and it decides which side a keyed axis is indexed by.
    // Anything that is not an explicit side means "ask the OS" — which is why the last line here
    // never changed when `"system"` left the model. It was always the whole resolution.
    "var AP=" + appearance + ",av=pick(PO[AP[0]]||{},P[AP[0]],AP[2],AP[4]);" +
    "var W=(av==='light'||av==='dark')?av:((window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light');" +
    // every axis, from the table itself. `data-theme` carries no option list and
    // so are written VERBATIM, never checked against what the tenant published: an attribute
    // selector with no matching rule is inert and the cascade falls through to `:root`, which is the
    // default. Validating here would mean knowing the document, and the two sides would stop
    // agreeing the moment they disagreed about it.
    "var A=" + axes + ";for(var i=0;i<A.length;i++){var r=A[i],k=r[0],s=r[3]?((P[k]||{})[W]):P[k],v=pick(PO[k]||{},s,r[2],r[4]);if(v===r[2]){d.removeAttribute(r[1]);}else{d.setAttribute(r[1],v);}}" +
    // `style.colorScheme` is never written: an inline declaration outranks every rule permanently,
    // and each theme file carries its own `color-scheme`.
    "d.classList.toggle('dark',W==='dark');" +
    "}catch(e){}})();"
  );
}
