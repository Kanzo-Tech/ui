// Drives `/fixtures/navigation-guard` in every Playwright engine installed and prints what each
// navigation did with the form dirty. It is the only check that runs `@kanzo-tech/navigation`
// against a real `next/link`, a real router and a real Navigation API — the unit tests stand in
// for all three.
//
//   node docs/scripts/navigation-guard.e2e.mjs [--url http://localhost:3100] [--base /ui]
//                                              [--engines chromium,firefox,webkit]
//
// Requires `next start` (or the dev server) to be up. Headless is fine.
//
// Each row is one row of the coverage table on `/docs/navigation-guard`. A row marked `expect`
// fails the run when the browser disagrees; a row marked `observe` is the platform's decision, not
// ours — browser-UI Back and reload — and is printed rather than asserted, because what it pins is
// the table's "not covered" column. A `known` entry names an engine where the row is measured to
// fail and why; it prints as `known` rather than failing, and it is the same sentence the coverage
// table carries. The day one of them prints `pass`, delete the entry and the table's caveat.
//
// What it pins about Next, and would be the first thing to fail on an upgrade that changed it:
// `Link` calls `onNavigate` before it dispatches; Next's own history write is a same-document push
// the guard ignores; back and forward reach Next only after `navigate` has let them through.

import { chromium, firefox, webkit } from "playwright";

const args = process.argv.slice(2);
const flag = (n, d) => (args.indexOf(`--${n}`) >= 0 ? args[args.indexOf(`--${n}`) + 1] : d);
const origin = flag("url", "http://localhost:3100");
const base = flag("base", "");
const FORM = `${base}/fixtures/navigation-guard`;
const ELSEWHERE = `${FORM}/elsewhere`;

const pathOf = (page) => new URL(page.url()).pathname.replace(/\/$/, "");

/** Lands on the form through a client navigation, so there is an entry behind it, then dirties it. */
async function dirtyForm(page) {
  await page.goto(origin + ELSEWHERE);
  await page.getByRole("link", { name: "To the form" }).click();
  await page.waitForURL((u) => u.pathname.replace(/\/$/, "") === FORM);
  await page.getByLabel("Name").fill("Fenn");
  await page.getByTestId("dirty").filter({ hasText: "true" }).waitFor();
}

const dialog = (page) => page.getByRole("alertdialog");

/**
 * Polled rather than `locator.waitFor`: in WebKit a cancelled cross-document navigation leaves
 * Playwright believing one is still in flight, and every auto-waiting call then hangs until its
 * timeout with the dialog already on screen.
 */
async function until(page, check, timeout = 3000) {
  for (const start = Date.now(); Date.now() - start < timeout; await page.waitForTimeout(100)) {
    if (await check().catch(() => false)) return true;
  }
  return false;
}

/**
 * A DOM `click()` for the same reason: Playwright's own click waits on that phantom navigation too.
 * It carries no user activation, so it is used only where none is needed — the dialog's buttons and
 * the anchors, whose `navigate` events are cancelable when script-initiated.
 */
const press = (page, name) =>
  page.evaluate((text) => {
    const found = [...document.querySelectorAll("a, button")].find((e) => e.textContent.trim() === text);
    if (!found) throw new Error(`nothing labelled ${text}`);
    found.click();
  }, name);

const asked = (page) => until(page, () => dialog(page).isVisible());
const dismissed = (page) => until(page, async () => !(await dialog(page).isVisible()));

/** Blocked, stays on Stay, leaves on Leave — the whole contract for one trigger. */
async function blockedThenLeft(page, trigger, action, landsOn = ELSEWHERE) {
  await trigger();
  if (!(await asked(page))) return `not asked; at ${pathOf(page)}`;
  const seen = await page.getByTestId("action").textContent();
  if (seen !== action) return `asked with action ${seen}, expected ${action}`;
  await press(page, "Stay");
  if (!(await dismissed(page))) return "Stay did not close the dialog";
  if (pathOf(page) !== FORM) return `Stay left the page for ${pathOf(page)}`;

  await trigger();
  if (!(await asked(page))) return "not asked the second time";
  await press(page, "Leave");
  try {
    await page.waitForURL((u) => u.pathname.replace(/\/$/, "") === landsOn, { timeout: 5000 });
  } catch {
    return `Leave did not arrive; at ${pathOf(page)}`;
  }
  await page.getByRole("heading", { name: landsOn === ELSEWHERE ? "Elsewhere" : "The form" }).waitFor();
  if (await dialog(page).isVisible()) return "asked again after Leave";
  return "ok";
}

const ROWS = [
  {
    name: "clean form, Link",
    kind: "expect",
    run: async (page) => {
      await page.goto(origin + FORM);
      await page.getByRole("link", { name: "Link", exact: true }).click();
      await page.waitForURL((u) => u.pathname.replace(/\/$/, "") === ELSEWHERE, { timeout: 5000 });
      return "ok";
    },
  },
  {
    name: "Link",
    kind: "expect",
    run: async (page) => {
      await dirtyForm(page);
      return blockedThenLeft(page, () => page.getByRole("link", { name: "Link", exact: true }).click(), "PUSH");
    },
  },
  {
    name: "router.push",
    kind: "expect",
    run: async (page) => {
      await dirtyForm(page);
      return blockedThenLeft(page, () => page.getByRole("button", { name: "router.push" }).click(), "PUSH");
    },
  },
  {
    name: "router.back (history.back)",
    kind: "expect",
    known: {
      webkit:
        "WebKit moves its own session-history index on a traversal that `navigate` cancelled: " +
        "the next Back skips an entry, and `traverseTo` on the cancelled key reloads instead",
    },
    run: async (page) => {
      await dirtyForm(page);
      return blockedThenLeft(page, () => page.getByRole("button", { name: "router.back" }).click(), "BACK");
    },
  },
  {
    name: "plain <a>, same origin",
    kind: "expect",
    run: async (page) => {
      await dirtyForm(page);
      return blockedThenLeft(page, () => press(page, "plain anchor"), "PUSH");
    },
  },
  {
    name: "plain <a>, external (asked; Stay only)",
    kind: "expect",
    known: { webkit: "WebKit fires no `navigate` event for a cross-origin destination" },
    run: async (page) => {
      await dirtyForm(page);
      let native = "none";
      page.once("dialog", async (d) => {
        native = d.type();
        await d.dismiss();
      });
      await press(page, "external anchor");
      if (!(await asked(page))) return `not asked (native dialog: ${native}); at ${page.url()}`;
      const next = await page.getByTestId("next").textContent();
      await press(page, "Stay");
      await dismissed(page);
      return pathOf(page) === FORM && next === "/" ? "ok" : `next ${next}, at ${pathOf(page)}`;
    },
  },
  {
    name: "browser Back (page.goBack)",
    kind: "observe",
    run: async (page) => {
      await dirtyForm(page);
      await page.goBack({ timeout: 3000 }).catch(() => {});
      if (await asked(page)) return "asked (cancelled before commit)";
      return `not asked; at ${pathOf(page)}`;
    },
  },
  {
    name: "reload (location.reload)",
    kind: "observe",
    run: async (page) => {
      await dirtyForm(page);
      let native = "none";
      page.once("dialog", async (d) => {
        native = d.type();
        await d.dismiss();
      });
      await page.evaluate(() => window.location.reload()).catch(() => {});
      await page.waitForTimeout(1000);
      return `native dialog: ${native}; custom dialog: ${await dialog(page).isVisible()}; at ${pathOf(page)}`;
    },
  },
];

const only = flag("engines", "chromium,firefox,webkit").split(",");
const ENGINES = Object.fromEntries(
  Object.entries({ chromium, firefox, webkit }).filter(([name]) => only.includes(name)),
);
let failed = 0;

for (const [name, engine] of Object.entries(ENGINES)) {
  let browser;
  try {
    browser = await engine.launch();
  } catch {
    console.log(`\n${name}: not installed, skipped`);
    continue;
  }
  const version = browser.version();
  console.log(`\n${name} ${version}`);
  const probe = await browser.newPage();
  await probe.goto(origin + FORM);
  console.log(`  Navigation API: ${await probe.evaluate(() => "navigation" in window)}`);
  await probe.close();

  for (const row of ROWS) {
    const context = await browser.newContext();
    const page = await context.newPage();
    let result;
    try {
      result = await row.run(page);
    } catch (error) {
      result = `threw: ${String(error.message ?? error).split("\n")[0]}`;
    }
    const known = row.known?.[name];
    const bad = row.kind === "expect" && result !== "ok" && !known;
    if (bad) failed += 1;
    const mark = bad ? "FAIL" : row.kind !== "expect" ? "seen" : result === "ok" ? "pass" : "known";
    console.log(`  ${mark}  ${row.name}: ${result}${known && result !== "ok" ? ` — ${known}` : ""}`);
    await context.close();
  }
  await browser.close();
}

process.exit(failed ? 1 : 0);
