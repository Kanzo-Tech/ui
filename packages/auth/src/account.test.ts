// @vitest-environment node
import { describe, expect, it } from "vitest";
import { accountUrl } from "./account";

describe("accountUrl", () => {
  it("is the realm's account console, under the issuer, with or without a trailing slash", () => {
    expect(accountUrl("https://id.example/realms/kanzo")).toBe("https://id.example/realms/kanzo/account");
    expect(accountUrl("https://id.example/realms/kanzo/")).toBe("https://id.example/realms/kanzo/account");
  });

  it("names a page of the console under it", () => {
    expect(accountUrl("https://id.example/realms/kanzo", "account-security/device-activity")).toBe(
      "https://id.example/realms/kanzo/account/account-security/device-activity",
    );
  });
});
