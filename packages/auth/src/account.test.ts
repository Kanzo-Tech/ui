// @vitest-environment node
import { describe, expect, it } from "vitest";
import { accountUrl, organizationConsoleUrl } from "./account";
import type { Organization } from "./types";

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

describe("organizationConsoleUrl", () => {
  const acme: Organization = { alias: "acme", id: "f8d3-1", roles: ["owner"], groups: [], groupsOverage: false };

  it("is the realm's admin console at the organization's settings, by its id", () => {
    expect(organizationConsoleUrl("https://id.example/realms/kanzo", acme)).toBe(
      "https://id.example/admin/kanzo/console/#/kanzo/organizations/f8d3-1/settings",
    );
    expect(organizationConsoleUrl("https://id.example/auth/realms/kanzo/", acme)).toBe(
      "https://id.example/auth/admin/kanzo/console/#/kanzo/organizations/f8d3-1/settings",
    );
  });

  it("has no link for an organization the realm sent without its id", () => {
    expect(organizationConsoleUrl("https://id.example/realms/kanzo", { ...acme, id: undefined })).toBeUndefined();
  });

  it("refuses an issuer that is not a realm's", () => {
    expect(() => organizationConsoleUrl("https://id.example/", acme)).toThrow(/realms/);
  });
});
