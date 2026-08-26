import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ShellBody, ShellMain, ShellRoot } from "../layouts/shell.js";
import { SkipNavContent, SkipNavLink } from "./skip-nav.js";

/**
 * A bespoke part — one Ark ships no machine for — owes a documented ARIA contract and a test that
 * covers it. The contract is in `skip-nav.tsx`; this is the cover.
 *
 * ## What these assertions cannot prove
 *
 * - **That activating the link moves focus.** jsdom implements neither fragment navigation nor the
 *   sequential-focus-navigation-starting-point it sets, so clicking the anchor does nothing here.
 *   What is checked instead is the pair of preconditions the browser needs: the `href` fragment and
 *   the target's id are the same string, and the target is programmatically focusable. A real
 *   browser is the only place the third link in that chain is observable.
 * - **That the link is invisible.** jsdom applies no stylesheet, and `sr-only` /
 *   `focus:not-sr-only` are Tailwind classes, so "hidden until focused" is asserted as the class
 *   contract rather than as a computed style. The assertion that matters and *is* real is the other
 *   half: the element is in the accessibility tree at rest, which `getByRole` proves.
 * - **That the ring is 3px.** Same reason — and its colour is not owned either: the guard that held
 *   that rule went with the tokens it named, so no test in this repository measures a rendered ring
 *   or the colour it is drawn in.
 */

describe("the skip link", () => {
  it("is in the accessibility tree before anything focuses it", () => {
    render(<SkipNavLink />);

    // The whole point of `sr-only` over `hidden`: removed from the visual tree, kept in the
    // accessibility one. If someone "tidies" this to `hidden`, `getByRole` stops finding it and a
    // keyboard user has nothing to tab to.
    const link = screen.getByRole("link", { name: "Skip to content" });
    expect(link.getAttribute("aria-hidden")).toBeNull();
    expect(link.hasAttribute("hidden")).toBe(false);
  });

  it("is visually hidden until it is focused, and no further", () => {
    render(<SkipNavLink />);

    // Two classes, and they only work as a pair — `sr-only` alone is a link nobody can see even
    // when they have tabbed to it.
    const cls = screen.getByRole("link").className;
    expect(cls).toContain("sr-only");
    expect(cls).toContain("focus:not-sr-only");
  });

  it("targets the id the content part answers to, with neither call site writing a string", () => {
    render(
      <>
        <SkipNavLink />
        <SkipNavContent>page</SkipNavContent>
      </>,
    );

    const target = screen.getByText("page");
    expect(screen.getByRole("link").getAttribute("href")).toBe(`#${target.id}`);
    expect(target.id).toBe("skip-nav-content");
  });

  it("keeps the two halves agreeing when a page names its own id", () => {
    render(
      <>
        <SkipNavLink id="report" />
        <SkipNavContent id="report">page</SkipNavContent>
      </>,
    );

    expect(screen.getByRole("link").getAttribute("href")).toBe("#report");
    expect(screen.getByText("page").id).toBe("report");
  });

  it("makes the target focusable by script and not by Tab", () => {
    render(<SkipNavContent>page</SkipNavContent>);

    // `tabIndex={-1}` is what turns a fragment jump into a focus move. Drop it and the browser
    // scrolls, focus stays on the link, and the next Tab re-enters the navigation just skipped.
    const target = screen.getByText("page");
    expect(target.tabIndex).toBe(-1);

    target.focus();
    expect(document.activeElement).toBe(target);
  });
});

describe("the skip target in a shell", () => {
  /** The composition `/docs/layout/skip-nav` records. */
  function Page() {
    return (
      <ShellRoot>
        <SkipNavLink />
        <ShellBody>
          <SkipNavContent asChild>
            <ShellMain>page</ShellMain>
          </SkipNavContent>
        </ShellBody>
      </ShellRoot>
    );
  }

  it("puts the id and the focus on the <main> itself, not on a div inside it", () => {
    render(<Page />);

    const main = screen.getByRole("main");
    expect(main.id).toBe("skip-nav-content");
    expect(main.tabIndex).toBe(-1);

    main.focus();
    expect(document.activeElement).toBe(main);

    // One element, not two: nothing between <main> and the page's own content. A nested target
    // would also become a flex child of ShellMain's column and swallow its `overflow-auto`.
    expect(main.textContent).toBe("page");
    expect(main.querySelector("[data-slot=skip-nav-content]")).toBeNull();
  });

  it("still renders exactly one <main>, and it is still ShellMain's slot", () => {
    render(<Page />);

    // `asChild` hands the parent's attributes down and the child writes its own `data-slot` after
    // its own spread, so `shell-main` survives — every recipe selecting it keeps working.
    // The slot rule is at `/docs/design/naming`, and the count at `/docs/layout/shell`.
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getByRole("main").getAttribute("data-slot")).toBe("shell-main");
  });

  it("puts the link ahead of everything else in the document", () => {
    const { container } = render(<Page />);

    // "First focusable element" is the entire specification. Rendered second, the link is a link to
    // content the user has already tabbed past.
    const focusable = container.querySelectorAll("a[href], button, [tabindex]");
    expect(focusable[0]).toBe(screen.getByRole("link"));
  });
});
