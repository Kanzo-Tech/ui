import { createFromSource } from "fumadocs-core/search/server";
import { source } from "@/lib/source";

/**
 * `staticGET`, not `GET` — the index is a FILE, not a server.
 *
 * The dynamic handler answers a query per keystroke, which needs something running. GitHub Pages
 * runs nothing, so the whole index is emitted once at build time and the client searches it in the
 * browser; `RootProvider` is told `type: "static"` so it fetches this once instead of per query.
 *
 * What it costs, stated rather than discovered: the index ships to every visitor who opens search,
 * so it is bytes over the wire rather than work on a server. That is the trade a static host makes
 * everywhere, and it is the same one `output: "export"` already made for every page here.
 */
export const revalidate = false;
export const { staticGET: GET } = createFromSource(source);
