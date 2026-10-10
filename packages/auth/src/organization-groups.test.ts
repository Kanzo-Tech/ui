import { describe, expect, it, vi } from "vitest";
import { organizationGroups } from "./organization-groups";
import { AuthError } from "./types";

const ADMIN = "http://keycloak:8080/admin/realms/kanzo";
const ORG = "org-1";

/**
 * The admin API as Keycloak 26.8.0 answered it for the seeded `bruno`, in acme's "Data team" and
 * "Research/ML": top-level groups hang under an internal group named by the organization's id.
 */
const GROUPS: Record<string, { id: string; name: string; parentId?: string }> = {
  internal: { id: "internal", name: ORG },
  research: { id: "research", name: "Research", parentId: "internal" },
  ml: { id: "ml", name: "ML", parentId: "research" },
  data: { id: "data", name: "Data team", parentId: "internal" },
};

function admin(status = 200) {
  return vi.fn<typeof globalThis.fetch>(async (input) => {
    const path = String(input).slice(ADMIN.length);
    if (status !== 200) return new Response("no", { status });
    if (path === `/organizations/${ORG}/members/bruno/groups`) {
      return Response.json([GROUPS["data"], GROUPS["ml"]]);
    }
    const id = path.match(/\/groups\/([^/]+)$/)?.[1];
    return id !== undefined && GROUPS[id] ? Response.json(GROUPS[id]) : new Response("", { status: 404 });
  });
}

describe("organizationGroups", () => {
  it("reads a member's groups with their ancestors, stopping at the organization's own group", async () => {
    const fetch = admin();
    const groups = organizationGroups({ adminUrl: ADMIN, token: async () => "t", fetch });
    expect(await groups(ORG, "bruno")).toEqual(["data", "ml", "research"]);
    expect(fetch.mock.calls[0]?.[1]?.headers).toMatchObject({ Authorization: "Bearer t" });
  });

  it("reads the direct groups alone when the realm's mapper does not inherit", async () => {
    const groups = organizationGroups({ adminUrl: ADMIN, token: async () => "t", fetch: admin(), inherited: false });
    expect(await groups(ORG, "bruno")).toEqual(["data", "ml"]);
  });

  it("asks once for a burst, and reuses the answer within its ttl", async () => {
    const fetch = admin();
    const groups = organizationGroups({ adminUrl: `${ADMIN}/`, token: async () => "t", fetch, inherited: false });
    await Promise.all([groups(ORG, "bruno"), groups(ORG, "bruno")]);
    await groups(ORG, "bruno");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("asks again once the ttl has passed", async () => {
    vi.useFakeTimers();
    try {
      const fetch = admin();
      const groups = organizationGroups({ adminUrl: ADMIN, token: async () => "t", fetch, inherited: false, ttl: 1000 });
      await groups(ORG, "bruno");
      vi.advanceTimersByTime(1000);
      await groups(ORG, "bruno");
      expect(fetch).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports a refusal by its status, and does not cache it", async () => {
    const groups = organizationGroups({ adminUrl: ADMIN, token: async () => "t", fetch: admin(403) });
    const error = await groups(ORG, "bruno").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AuthError);
    expect(error).toMatchObject({ code: "idp/unreachable", data: { status: 403 } });
  });
});
