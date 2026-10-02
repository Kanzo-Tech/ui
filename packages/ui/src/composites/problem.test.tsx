import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DiagnosticList } from "../simples/diagnostic.js";
import { Problem, type ProblemProps } from "./problem.js";

/** A library's coded error, in the shape every one of them shares. */
class Coded extends Error {
  constructor(
    readonly code: string,
    readonly title: string,
    message: string,
    readonly data?: unknown,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

const show = (props: ProblemProps) =>
  render(
    <DiagnosticList>
      <Problem {...props} />
    </DiagnosticList>,
  );

const row = (code: string) => document.querySelector(`[data-code="${code}"]`);

describe("a thrown value, read for the shared shape", () => {
  it("draws a coded error's title and code, with its message as the detail", () => {
    show({ error: new Coded("session/silent", "The session did not answer", "after 5000 ms") });
    expect(screen.getByText("The session did not answer")).toBeTruthy();
    expect(screen.getByText("session/silent")).toBeTruthy();
    expect(screen.getByText("after 5000 ms")).toBeTruthy();
    expect(row("session/silent")?.getAttribute("data-variant")).toBe("destructive");
  });

  it("draws an uncoded error as its message, and a value that is no object as its own String", () => {
    show({ error: new TypeError("Failed to fetch") });
    expect(screen.getByText("Failed to fetch")).toBeTruthy();
    expect(document.querySelector("[data-code]")).toBeNull();
    render(
      <DiagnosticList>
        <Problem error={404} />
      </DiagnosticList>,
    );
    expect(screen.getByText("404")).toBeTruthy();
  });

  it("walks cause as a tree, coded causes open and named by their own code", () => {
    const root = new Coded("run/failed", "The run failed", "it stopped", undefined, {
      cause: new Coded("store/refused", "The store refused", "403", undefined, { cause: new Error("socket hang up") }),
    });
    show({ error: root });
    const store = row("store/refused");
    expect(store?.closest('[data-code="run/failed"]')).toBeTruthy();
    expect(store?.getAttribute("data-state")).toBe("open");
    expect(screen.getByText("socket hang up")).toBeTruthy();
  });

  it("reads severity, help and related where an error carries them", () => {
    const error = Object.assign(new Coded("run/does-not-compile", "Does not compile", "2 problems"), {
      help: "Fix the program and run it again.",
      related: [{ code: "type/mismatch", title: "Expected a number", detail: "found text", severity: "warning" }],
    });
    show({ error });
    expect(screen.getByText("Fix the program and run it again.")).toBeTruthy();
    expect(row("type/mismatch")?.getAttribute("data-variant")).toBe("warning");
    expect(screen.getByText("Warning")).toBeTruthy();
  });

  it("stops at a cause that points back at an error already drawn", () => {
    const a = new Coded("a/one", "One", "first");
    const b = new Coded("b/two", "Two", "second", undefined, { cause: a });
    (a as { cause?: unknown }).cause = b;
    show({ error: a });
    expect(document.querySelectorAll('[data-code="a/one"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-code="b/two"]')).toHaveLength(1);
  });
});

describe("the host's words", () => {
  it("takes the title, detail and link from copy, given the code and its data, and keeps the author's row below", () => {
    show({
      error: new Coded("run/over-budget", "Over budget", "needed 3 GiB", { budget: 2 }),
      copy: (code, data) =>
        code === "run/over-budget"
          ? {
              title: "Too large for the browser",
              detail: `The browser gives ${(data as { budget: number }).budget} GiB.`,
              link: { label: "Read about limits", href: "/limits" },
              page: "https://example.com/codes/run/over-budget",
            }
          : undefined,
    });
    expect(screen.getByText("Too large for the browser")).toBeTruthy();
    expect(screen.getByText("The browser gives 2 GiB.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Read about limits" }).getAttribute("href")).toBe("/limits");
    expect(screen.getAllByRole("link", { name: "run/over-budget" })[0]?.getAttribute("href")).toBe(
      "https://example.com/codes/run/over-budget",
    );
    expect(screen.getByText("needed 3 GiB")).toBeTruthy();
  });

  it("puts children beside the details trigger, as the problem's own actions", () => {
    show({ error: new Coded("a/b", "A", "b"), children: <button type="button">Try again</button> });
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });
});

describe("each row's details trigger", () => {
  it("is named by its row, so six problems are not six buttons called Details", () => {
    show({
      error: new Coded("run/failed", "The run failed", "it stopped", undefined, {
        cause: new Coded("store/refused", "The store refused", "403"),
      }),
    });
    expect(screen.getByRole("button", { name: "Details: The run failed" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Details: The store refused" })).toBeTruthy();
  });

  it("speaks the host's language when given translations", () => {
    show({
      error: new Coded("a/b", "Falló", "porque sí"),
      translations: { destructive: "Fallo", details: (title) => `Detalles: ${title}` },
    });
    expect(screen.getByText("Fallo")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Detalles: Falló" })).toBeTruthy();
  });
});
