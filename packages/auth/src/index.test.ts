import { describe, expect, it } from "vitest";
import * as root from "./index";
import * as server from "./server";

/**
 * The runtime names on the two doors that carry more than one, so a name arrives or leaves in a
 * diff someone reads. A name is on a door because a product calls it there. The relying party, its
 * stores and its issuer left when oauth2-proxy became the relying party, and `bffAuth` with them:
 * the browser is handed the session and asks for nothing. `claims` is on `./server` because the
 * browser has no claim set to read. Types ride along with their values and are not counted.
 */
describe("the doors' names", () => {
  it("are the session, the role question and the two console links on the root", () => {
    expect(Object.keys(root).sort()).toEqual(
      ["AuthProvider", "Gate", "accountUrl", "can", "organizationConsoleUrl", "organizationOf", "useSession"].sort(),
    );
  });

  it("are the session reader and its claim reader on the server door", () => {
    expect(Object.keys(server).sort()).toEqual(["claims", "sessionReader"]);
  });
});
