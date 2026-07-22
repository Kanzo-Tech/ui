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

import { CUSTOM_BASE_KEEP, CUSTOM_BASE_SHADES } from "../lib/color.js";
import { APPEARANCE_KEY, AXES, STORAGE_KEY } from "./prefs-config.js";

export interface ThemeScriptOptions {
  /** Must match the provider's `storageKey` / the cookie adapter's key. */
  storageKey?: string;
  /** Must match the appearance persistence key (default `kanzo_appearance`). */
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
    "var A=" + axes + ";for(var i=0;i<A.length;i++){var k=A[i][0],at=A[i][1],df=A[i][2],v=P[k];if(v==null||v===df){d.removeAttribute(at);}else{d.setAttribute(at,String(v));}}" +
    // custom base tint → generate the tinted neutral ramp + force data-base="custom"
    "if(P.baseTint){var bt=String(P.baseTint),BS=" + JSON.stringify([...CUSTOM_BASE_SHADES]) + ";for(var j=0;j<BS.length;j++){d.style.setProperty('--color-custom-'+BS[j],'color-mix(in srgb, var(--color-neutral-'+BS[j]+') " + CUSTOM_BASE_KEEP + "%, '+bt+')');}d.setAttribute('data-base','custom');}" +
    // custom primary override (foreground derived by relative luminance, matching the provider)
    "if(P.primary){var p=String(P.primary);function C(x){return x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4);}var h=p.replace('#','');if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];var L=/^([0-9a-f]{6})$/i.test(h)?0.2126*C(parseInt(h.slice(0,2),16)/255)+0.7152*C(parseInt(h.slice(2,4),16)/255)+0.0722*C(parseInt(h.slice(4,6),16)/255):0;var fg=L>0.5?'#0a0a0a':'#ffffff';['--primary','--ring','--sidebar-primary','--sidebar-ring'].forEach(function(x){d.style.setProperty(x,p);});['--primary-foreground','--sidebar-primary-foreground'].forEach(function(x){d.style.setProperty(x,fg);});}" +
    // appearance (.dark): localStorage then cookie
    "var ap;try{ap=localStorage.getItem(" + ak + ");}catch(e){}if(!ap){try{var ca=document.cookie.match(new RegExp('(?:^|; )'+" + ak + "+'=([^;]*)'));if(ca&&ca[1])ap=decodeURIComponent(ca[1]);}catch(e){}}" +
    "if(ap==='dark')d.classList.add('dark');else if(ap==='light')d.classList.remove('dark');" +
    "}catch(e){}})();"
  );
}
