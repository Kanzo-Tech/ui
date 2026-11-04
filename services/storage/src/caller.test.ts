import { describe, expect, it } from "vitest";
import { member } from "./caller.ts";

describe("member", () => {
  it("lets a member of the deployment's organization ask, and nobody from another", () => {
    expect(() => member({ organizations: [{ alias: "acme" }, { alias: "globex" }] }, "acme")).not.toThrow();
    expect(() => member({ organizations: [{ alias: "globex" }] }, "acme")).toThrow(expect.objectContaining({ code: "organization/denied" }));
    expect(() => member({ organizations: [] }, "acme")).toThrow(expect.objectContaining({ code: "organization/denied" }));
  });
});
