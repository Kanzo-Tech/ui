import { describe, expect, it } from "vitest";
import { organizationFromHost } from "./host";

describe("organizationFromHost reads the leading label, when there is one to spare", () => {
  it("takes the subdomain of a real host", () => {
    expect(organizationFromHost("acme.kanzo.tech")).toBe("acme");
    expect(organizationFromHost("acme.eu.kanzo.tech")).toBe("acme");
  });

  it("finds nothing on the site itself", () => {
    // Two labels is the apex, not a tenant of it. Reading `kanzo` here would make every visitor to
    // the marketing site an addressee of an organization that does not exist.
    expect(organizationFromHost("kanzo.tech")).toBeUndefined();
    expect(organizationFromHost("localhost")).toBeUndefined();
  });

  it("makes the one exception a developer needs", () => {
    // `acme.localhost` resolves without editing DNS, which is how a tenant is reached locally.
    expect(organizationFromHost("acme.localhost")).toBe("acme");
  });

  it("finds nothing in an address", () => {
    expect(organizationFromHost("127.0.0.1")).toBeUndefined();
    expect(organizationFromHost("10.0.12.4")).toBeUndefined();
    expect(organizationFromHost("[::1]")).toBeUndefined();
  });

  it("finds nothing in nothing", () => {
    expect(organizationFromHost(undefined)).toBeUndefined();
    expect(organizationFromHost("")).toBeUndefined();
    expect(organizationFromHost(".kanzo.tech")).toBeUndefined();
  });
});
