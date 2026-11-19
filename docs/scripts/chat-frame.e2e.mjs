// Measures `/fixtures/chat-frame` in Chromium: `ChatSkeleton` and the `Chat` that replaces it must
// each fill their panel, and put their empty state and composer in the same place, in a parent that
// is a flex column and in one that is only a block with a height. jsdom has no layout, so this is the
// only check of the height half of `Chat`'s frame.
//
//   node docs/scripts/chat-frame.e2e.mjs [--url http://localhost:3100] [--base /ui]
//
// Requires `next start` (or the dev server) to be up.

import { launch, site } from "./browser.mjs";

/** Each box the reader would see move, relative to its panel. */
async function boxes(page, testid) {
  return page.getByTestId(testid).evaluate((panel) => {
    const at = panel.getBoundingClientRect();
    const style = panel.ownerDocument.defaultView.getComputedStyle(panel);
    const inner = at.height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    const border = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    const box = (selector) => {
      const r = panel.querySelector(selector)?.getBoundingClientRect();
      return r && { top: Math.round(r.top - at.top), height: Math.round(r.height) };
    };
    const frame = box(":scope > [data-slot]");
    return {
      fills: frame && Math.round(inner - border) === frame.height,
      frame,
      empty: box("p"),
      strip: box("[data-slot=suggestions]"),
      composer: box("[data-slot=prompt-input]"),
    };
  });
}

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
await page.goto(`${site}/fixtures/chat-frame`);
await page.getByTestId("block-chat").locator("[data-slot=prompt-input]").waitFor();

let failed = false;
for (const parent of ["column", "block"]) {
  const skeleton = await boxes(page, `${parent}-skeleton`);
  const chat = await boxes(page, `${parent}-chat`);
  for (const part of Object.keys(skeleton)) {
    const same =
      part === "fills" ? skeleton.fills && chat.fills : JSON.stringify(skeleton[part]) === JSON.stringify(chat[part]);
    failed ||= !same;
    console.log(`${same ? "pass" : "FAIL"}  ${parent.padEnd(6)} ${part.padEnd(8)} skeleton ${JSON.stringify(skeleton[part])}  chat ${JSON.stringify(chat[part])}`);
  }
}
await browser.close();
process.exit(failed ? 1 : 0);
