"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useKanzoTheme } from "@kanzo-tech/ui";

/**
 * Repaints the page when the user picks another palette, without waiting for a navigation.
 *
 * The server already chose a document for the first paint, from the cookie, and inlined it as
 * `<style id="kanzo-palette">`. That is what makes a reload flash-free — and it is *only* about the
 * first paint. Switching has to be immediate, so this owns the same element afterwards: fetch the
 * chosen document, swap the text, done. Selecting Dracula and then reloading gives the same page
 * twice, by two different routes.
 *
 * **It replaces the SSR element rather than adding a second one.** Two sheets for one decision would
 * both apply — same specificity, source order deciding — and the loser would be whichever the
 * browser saw first. There is exactly one palette element on the page at any moment, or none.
 *
 * Ordering does not matter beyond that: every non-default document is compiled with `elevate`, so
 * its `:root:root` blocks outrank `tokens.css` wherever this lands in `<head>`.
 *
 * Not in the library, and that is a boundary rather than an omission. `KanzoThemeProvider` owns the
 * preference; a provider that injects stylesheets is a themer drawing its own surface, which is what
 * `KanzoTheme` was deleted for. How a host gets a document's bytes is the host's — here a route, for
 * a real tenant whatever serves their data.
 */
const ELEMENT_ID = "kanzo-palette";

export function PaletteStyle({ defaultPalette }: { defaultPalette: string }) {
  const { resolvedPalette } = useKanzoTheme();
  const router = useRouter();

  useEffect(() => {
    // The default document IS `tokens.css`, already imported. Selecting it means removing the
    // override, not fetching an empty one.
    if (resolvedPalette === defaultPalette) {
      document.getElementById(ELEMENT_ID)?.remove();
      return;
    }

    // Abandon a fetch whose answer is no longer wanted: clicking through the list faster than the
    // network answers would otherwise let an earlier reply land last and paint a palette nobody
    // selected.
    const abort = new AbortController();
    fetch(`/palette/${encodeURIComponent(resolvedPalette)}`, { signal: abort.signal })
      .then((response) => (response.ok ? response.text() : null))
      .then((css) => {
        if (css == null) return;
        const existing = document.getElementById(ELEMENT_ID);
        if (existing) {
          existing.textContent = css;
          return;
        }
        const style = document.createElement("style");
        style.id = ELEMENT_ID;
        style.textContent = css;
        document.head.append(style);
      })
      .catch(() => {
        // An aborted or failed fetch leaves the page on the palette it is already painted with,
        // which is the only safe answer: the alternative is a half-applied document.
      });

    return () => abort.abort();
  }, [resolvedPalette, defaultPalette]);

  // The identities belong to the SELECTED document and are read on the server, so a palette swapped
  // in the browser leaves that list describing the palette the user just left — a section offering
  // brands that no longer exist. The stylesheet swap keeps the repaint instant; this brings the
  // server-computed half back into step without a full reload.
  //
  // After the CSS, not before: `refresh` re-renders on the server and can take a moment, and a
  // palette that arrived late would be visible as a second repaint.
  useEffect(() => {
    router.refresh();
  }, [resolvedPalette, router]);

  return null;
}
