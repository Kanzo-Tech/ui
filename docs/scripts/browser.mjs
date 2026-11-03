// What the browser checks in this directory share: their flags, where the docs are served, and a
// browser that only opens once something answers there.
//
//   --url http://localhost:3100   the server's origin
//   --base /ui                    the basePath it was built with, empty by default

import { chromium } from "playwright";

const argv = process.argv.slice(2);

export const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
export const present = (name) => argv.includes(`--${name}`);

export const origin = flag("url", "http://localhost:3100");
export const base = flag("base", "");
/** Every route a check visits is appended to this. */
export const site = origin + base;

let answered;

/**
 * Exits 2 before opening a browser when nothing answers at `site`: a dead server otherwise produces
 * a run that looks like a result — every route "did not settle" — and is not one.
 */
export async function launch(engine = chromium) {
  answered ??= fetch(`${site}/`).then((r) => r.ok).catch(() => false);
  if (!(await answered)) {
    console.error(`Nothing answering at ${site}/. Start the docs server first (\`next start\`).`);
    process.exit(2);
  }
  return engine.launch();
}
