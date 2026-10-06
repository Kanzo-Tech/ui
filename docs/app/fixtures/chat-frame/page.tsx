import { Frames } from "./frames";

/**
 * The end-to-end fixture for `Chat`'s frame, not a page anybody reads.
 *
 * `docs/scripts/chat-frame.e2e.mjs` measures it: `ChatSkeleton` and `Chat` side by side, in a
 * parent that is a flex column and in one that is only a block with a height, and fails when the
 * two differ in height or where their empty state and composer sit — the jump #53 was.
 */
export default function Page() {
  return <Frames />;
}

export const metadata = { title: "Chat frame fixture", robots: { index: false } };
