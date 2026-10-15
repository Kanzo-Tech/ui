import { describe, expect, it } from "vitest";
import { Problem, isCode, isProblem } from "./index.js";
import { PROBLEMS } from "./problems.gen.js";

/** What fossil's `FossilError` is to the kernel: a different class with the same discriminant. */
class FossilError extends Error {
  constructor(readonly code: string, message: string, readonly stack2 = "at secret.rs:1") {
    super(message);
  }
}

describe("isCode", () => {
  it("accepts area/kind and nothing else", () => {
    for (const ok of ["engine/lost", "callback/state-mismatch", "a1/b2"]) expect(isCode(ok)).toBe(true);
    for (const bad of ["engine", "Engine/lost", "engine/", "/lost", "engine/lost/x", "engine/Lost", "", 3, null, undefined]) {
      expect(isCode(bad)).toBe(false);
    }
  });
});

describe("isProblem", () => {
  it("is structural: a FossilError-like object, a rebuilt body and a plain object all pass", () => {
    expect(isProblem(new FossilError("engine/failed", "boom"))).toBe(true);
    expect(isProblem(Problem.from(new Problem("engine/lost", "gone").toJSON()))).toBe(true);
    expect(isProblem({ code: "llm/silent", message: "x" })).toBe(true);
  });

  it("narrows by code when given one", () => {
    const error = new FossilError("engine/failed", "boom");
    expect(isProblem(error, "engine/failed")).toBe(true);
    expect(isProblem(error, "engine/lost")).toBe(false);
  });

  it("refuses what is not one: no message, a code outside the grammar, an AbortError, a primitive", () => {
    expect(isProblem({ code: "engine/lost" })).toBe(false);
    expect(isProblem({ code: "ENOENT", message: "x" })).toBe(false);
    expect(isProblem(new DOMException("stopped", "AbortError"))).toBe(false);
    expect(isProblem("engine/lost")).toBe(false);
    expect(isProblem(null)).toBe(false);
  });
});

describe("Problem", () => {
  it("is an Error with the registry's status and title", () => {
    const p = new Problem("session/absent", "nobody is signed in");
    expect(p).toBeInstanceOf(Error);
    expect(p.name).toBe("Problem");
    expect(p.status).toBe(401);
    expect(p.title).toBe(PROBLEMS["session/absent"].title);
    expect(p.severity).toBe("error");
  });

  it("serialises to RFC 9457 with the status phrase as title, and omits what is absent", () => {
    const p = new Problem("session/silent", "no answer within 30000 ms", { after: 30_000 });
    expect(JSON.parse(JSON.stringify(p))).toEqual({
      status: 504,
      title: "Gateway Timeout",
      detail: "no answer within 30000 ms",
      code: "session/silent",
      data: { after: 30_000 },
      severity: "error",
    });
  });

  it("keeps the registry's title on the wire when there is no status", () => {
    expect(new Problem("engine/lost", "gone").toJSON().title).toBe(PROBLEMS["engine/lost"].title);
  });

  it("serialises a Problem cause, and never a foreign one, its message or a stack", () => {
    const inner = new Problem("idp/unreachable", "no route");
    expect(new Problem("session/unavailable", "x", {}, { cause: inner }).toJSON().cause?.code).toBe("idp/unreachable");

    const foreign = new Error("select * from t where token = 'abc'");
    const wire = JSON.stringify(new Problem("engine/failed", "refused", {}, { cause: foreign }));
    expect(wire).not.toContain("select");
    expect(wire).not.toContain("stack");
    expect(wire).not.toContain("cause");
    expect(new Problem("engine/failed", "refused", {}, { cause: foreign }).cause).toBe(foreign);
  });

  it("drops a foreign Problem-shaped cause's stack and any other member it carries", () => {
    const cause = new FossilError("engine/failed", "refused", "at /home/me/.ssh");
    const wire = JSON.stringify(new Problem("engine/lost", "gone", {}, { cause }));
    expect(wire).toContain("engine/failed");
    expect(wire).not.toContain("ssh");
    expect(wire).not.toContain("stack");
  });

  it("serialises related problems", () => {
    const p = new Problem("relations/invalid", "x", {}, { related: [new Problem("relations/no-step", "y")] });
    expect(p.toJSON().related?.[0]?.code).toBe("relations/no-step");
  });

  it("owns a host's code as free JSON data and an explicit status and title", () => {
    const p = new Problem("rbac/forbidden", "no", { role: "admin" }, { status: 403, title: "Not allowed" });
    expect(p.toJSON()).toMatchObject({ status: 403, title: "Forbidden", data: { role: "admin" } });
    expect(Problem.from(p.toJSON()).title).toBe("Forbidden");
  });

  it("keeps help and severity across the wire", () => {
    const p = new Problem("engine/lost", "gone", {}, { help: "reload", severity: "warning" });
    expect(Problem.from(p.toJSON())).toMatchObject({ help: "reload", severity: "warning" });
  });

  it("builds, serialises and rebuilds every row of the registry", () => {
    const codes = Object.keys(PROBLEMS) as (keyof typeof PROBLEMS)[];
    expect(codes.length).toBeGreaterThan(0);
    for (const code of codes) {
      expect(isCode(code)).toBe(true);
      const p = new Problem(code, "detail", {} as never);
      const back = Problem.from(JSON.parse(JSON.stringify(p)));
      expect(back).toMatchObject({ code, status: p.status, title: p.title, message: "detail", severity: "error" });
      expect(back.toJSON()).toEqual(p.toJSON());
    }
  });

  it("seeds the codes failure.mdx names", () => {
    for (const code of ["engine/lost", "graph/too-large", "llm/silent", "session/absent", "token/refused", "idp/silent", "organization/denied", "api/silent", "relations/no-step"]) {
      expect(code in PROBLEMS).toBe(true);
    }
  });
});
