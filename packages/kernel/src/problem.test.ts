import { describe, expect, it } from "vitest";
import { Problem, isCode, isProblem } from "./index.js";
import type { ProblemBody } from "./index.js";
import { PROBLEMS, TYPE_BASE } from "./problems.gen.js";

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

  it("serialises to RFC 9457: a type derived from the code, the registry's title, the status, the occurrence's detail", () => {
    const p = new Problem("session/silent", "no answer within 30000 ms", { after: 30_000 });
    expect(JSON.parse(JSON.stringify(p))).toEqual({
      type: `${TYPE_BASE}session/silent`,
      status: 504,
      title: PROBLEMS["session/silent"].title,
      detail: "no answer within 30000 ms",
      code: "session/silent",
      data: { after: 30_000 },
      severity: "error",
    });
    expect(p.type).toBe("tag:kanzo.tech,2026:problem/session/silent");
  });

  it("never writes about:blank or the status phrase: a coded problem has semantics beyond its status", () => {
    for (const code of Object.keys(PROBLEMS) as (keyof typeof PROBLEMS)[]) {
      const wire = new Problem(code, "d", {} as never).toJSON();
      expect(wire.type).toBe(TYPE_BASE + code);
      expect(wire.title).toBe(PROBLEMS[code].title);
      expect(wire.title).not.toMatch(/^(Bad Request|Unauthorized|Forbidden|Bad Gateway|Service Unavailable|Gateway Timeout|Not Implemented)$/);
    }
  });

  it("keeps the title per type, not per occurrence, and lets a host's own code carry its own", () => {
    expect(new Problem("engine/lost", "a", {}, { title: "Other" }).title).toBe(PROBLEMS["engine/lost"].title);
    expect(new Problem("rbac/forbidden", "a", {}, { title: "Not allowed" }).toJSON()).toMatchObject({ title: "Not allowed", type: `${TYPE_BASE}rbac/forbidden` });
  });

  it("types data per code: required fields are required, a host's code is free JSON", () => {
    new Problem("graph/too-large", "x", { count: 2, limit: 1 });
    new Problem("engine/lost", "x");
    new Problem("llm/silent", "x", { after: 1 });
    new Problem("rbac/forbidden", "x", { anything: [1] });
    // @ts-expect-error `after` is required
    new Problem("engine/unavailable", "x");
    // @ts-expect-error `limit` is required
    new Problem("graph/too-large", "x", { count: 2 });
    // @ts-expect-error `after` is a number
    new Problem("engine/unavailable", "x", { after: "soon" });
    // @ts-expect-error an unregistered field
    new Problem("engine/unavailable", "x", { after: 1, extra: 1 });
    expect(true).toBe(true);
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

  it("keeps a foreign cause's registry-declared data and drops the rest, all of it for a code the registry lacks", () => {
    const known = Object.assign(new FossilError("idp/silent", "slow"), { data: { after: 5, token: "abc", nested: { a: 1 } } });
    expect(new Problem("session/silent", "x", { after: 1 }, { cause: known }).toJSON().cause?.data).toEqual({ after: 5 });
    const wrong = Object.assign(new FossilError("idp/silent", "slow"), { data: { after: "5" } });
    expect(new Problem("session/silent", "x", { after: 1 }, { cause: wrong }).toJSON().cause?.data).toEqual({});
    const hosts = Object.assign(new FossilError("rbac/forbidden", "no"), { data: { secret: "s" } });
    expect(new Problem("session/silent", "x", { after: 1 }, { cause: hosts }).toJSON().cause?.data).toEqual({});
    // our own Problem's data is what its author wrote
    const own = new Problem("rbac/forbidden", "no", { role: "admin" });
    expect(new Problem("session/silent", "x", { after: 1 }, { cause: own }).toJSON().cause?.data).toEqual({ role: "admin" });
  });

  it("survives a cause cycle and a self-cause, and caps the chain at 8 deep", () => {
    const a = new Problem("engine/lost", "a");
    const b = new Problem("engine/failed", "b", {}, { cause: a });
    (a as { cause?: unknown }).cause = b;
    const wire = a.toJSON();
    expect(wire.code).toBe("engine/lost");
    expect(wire.cause?.code).toBe("engine/failed");
    expect(wire.cause?.cause).toBeUndefined();
    (a as { cause?: unknown }).cause = a;
    expect(a.toJSON().cause).toBeUndefined();

    let chain = new Problem("engine/lost", "0");
    for (let i = 1; i < 20; i += 1) chain = new Problem("engine/lost", String(i), {}, { cause: chain });
    let depth = 0;
    for (let body: ProblemBody | undefined = chain.toJSON(); body; body = body.cause) depth += 1;
    expect(depth).toBe(8);
    expect(() => JSON.stringify(chain)).not.toThrow();
  });

  it("ignores, on rebuilding, a member of the wrong type, the derived type and unknown members (RFC 9457 §3.1, §3.2)", () => {
    const body = { type: "https://elsewhere/x", status: "504", title: 3, detail: "d", code: "idp/silent", data: { after: 1 }, help: 9, severity: "loud", extra: 1 };
    const p = Problem.from(body as never);
    expect(p).toMatchObject({ status: 504, title: PROBLEMS["idp/silent"].title, help: undefined, severity: "error", type: `${TYPE_BASE}idp/silent` });
    expect(Problem.from({ ...body, code: "rbac/x", status: "403" } as never).status).toBeUndefined();
    expect(JSON.stringify(p)).not.toContain("elsewhere");
    expect(JSON.stringify(p)).not.toContain("extra");
  });

  it("serialises related problems", () => {
    const p = new Problem("relations/invalid", "x", {}, { related: [new Problem("relations/no-step", "y")] });
    expect(p.toJSON().related?.[0]?.code).toBe("relations/no-step");
  });

  it("owns a host's code as free JSON data and an explicit status and title", () => {
    const p = new Problem("rbac/forbidden", "no", { role: "admin" }, { status: 403, title: "Not allowed" });
    expect(p.toJSON()).toMatchObject({ status: 403, title: "Not allowed", data: { role: "admin" } });
    expect(Problem.from(p.toJSON()).title).toBe("Not allowed");
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
