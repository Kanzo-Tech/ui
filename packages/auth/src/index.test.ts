import { describe, expect, it } from "vitest";
import * as root from "./index";
import * as server from "./server";

/**
 * The runtime names on the two doors that carry more than one, so a name arrives or leaves in a
 * diff someone reads. A name is on a door because a product calls it there; the ones that left had
 * no caller outside this package — the pieces `bffAuth` and `relyingParty` are built from, and a
 * sketch of an admin-API lookup — and `claims` went to `./server` because the browser has no claim
 * set to read: the BFF reads it. Types ride along with their values and are not counted.
 */
describe("the doors' names", () => {
  it("are the session, the role question and the two console links on the root", () => {
    expect(Object.keys(root).sort()).toEqual(
      ["AuthProvider", "Gate", "accountUrl", "bffAuth", "can", "organizationConsoleUrl", "organizationOf", "useSession"].sort(),
    );
  });

  it("are the relying party, its claim reader, its issuer and its stores on the server door", () => {
    expect(Object.keys(server).sort()).toEqual(["claims", "issuer", "relyingParty", "statelessStore", "ticketStore"].sort());
  });
});
