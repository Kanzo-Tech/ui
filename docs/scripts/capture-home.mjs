#!/usr/bin/env node
// The home's pictures of keasy, taken from a running build: `pnpm start`, then
// `node scripts/capture-home.mjs [--url http://localhost:3100]`. Rerun it when a screen changes.
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const at = process.argv.indexOf("--url");
const base = at === -1 ? "http://localhost:3100" : process.argv[at + 1];
const out = new URL("../app/(home)/shots/", import.meta.url);

const SCREENS = [
  ["dashboard", "/view/showcases/keasy#/"],
  ["discover", "/view/showcases/keasy#/graphs/archive/discover"],
];

await mkdir(out, { recursive: true });
const browser = await chromium.launch();
for (const [name, path] of SCREENS) {
  for (const scheme of ["light", "dark"]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await page.goto(base + path, { waitUntil: "networkidle" });
    // Discover lays its graph out after the corpus loads, and says so until it is done.
    await page.getByText("Laying out").waitFor({ state: "detached", timeout: 120_000 });
    await page.waitForTimeout(1_000);
    await page.screenshot({ path: new URL(`keasy-${name}-${scheme}.jpg`, out).pathname, quality: 82, type: "jpeg" });
    await page.close();
  }
}
await browser.close();
