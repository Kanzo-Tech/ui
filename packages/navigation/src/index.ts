/**
 * `@kanzo-tech/navigation` — keeping somebody on a page they have not finished with.
 *
 * One hook, `useBlocker`, in TanStack Router's shape. This door is the browser half and knows no
 * router: back, forward and `history.go` are cancelled through the Navigation API's `navigate`
 * event before they commit, a plain `<a>` or `location.assign` the same way, and reload, close and
 * the URL bar through `beforeunload`. A router's own client navigations are its adapter's —
 * `@kanzo-tech/navigation/next` for the App Router.
 *
 * There is no dialog here and no copy. `status`, `proceed` and `reset` drive the product's own
 * `AlertDialog`, in the product's words.
 *
 * Nothing in this package patches `history`, reads a router's internals, or listens for clicks on
 * the document. `/docs/design/navigation` has each of those and why.
 */

export { useBlocker } from "./use-blocker";
export type {
  BlockerResolver,
  HistoryAction,
  ShouldBlockFn,
  ShouldBlockFnArgs,
  ShouldBlockFnLocation,
  UseBlockerOpts,
} from "./types";
