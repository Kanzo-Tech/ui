import { isProblem } from "@kanzo-tech/kernel";
import { describe, expect, it } from "vitest";
import { directorySas, gcsBoundary, s3Policy, under, vend } from "./vend.ts";

describe("under", () => {
  it("opens a path below the root, and nothing that climbs out of it", () => {
    expect(under("graphs", "g1")).toBe("graphs/g1");
    expect(under("/graphs/", "/g1/vertex/")).toBe("graphs/g1/vertex");
    expect(under("", "g1")).toBe("g1");
    for (const path of ["", "/", "../etc", "g1/../../x", "./g1"]) {
      expect(() => under("graphs", path)).toThrow(expect.objectContaining({ code: "storage/path" }));
    }
  });
});

describe("s3Policy", () => {
  it("reads and lists the prefix, or writes under it; never deletes, and writing does not read", () => {
    const read = JSON.parse(s3Policy("b", "graphs/g1", "read"));
    expect(read.Statement[0]).toEqual({ Effect: "Allow", Action: ["s3:GetObject"], Resource: ["arn:aws:s3:::b/graphs/g1/*"] });
    expect(read.Statement[1].Condition.StringLike["s3:prefix"]).toEqual(["graphs/g1/*"]);
    const write = JSON.parse(s3Policy("b", "graphs/g1", "write"));
    expect(write.Statement).toEqual([
      { Effect: "Allow", Action: ["s3:PutObject", "s3:AbortMultipartUpload"], Resource: ["arn:aws:s3:::b/graphs/g1/*"] },
    ]);
  });
});

describe("directorySas", () => {
  // A directory SAS of one fixed delegation key and window. The signatures are the ones Keasy's
  // hand-written signer (keasy server, storage_client/vend.rs) produced for the same inputs on
  // 4 November 2026: two implementations agreeing on Azure's string-to-sign.
  const key = {
    signedObjectId: "23657296-5cd5-45b0-a809-d972a7f4dfe1",
    signedTenantId: "ab1f708d-50f6-404c-a006-d71b2ac7a606",
    signedStartsOn: new Date("2026-11-04T17:00:00Z"),
    signedExpiresOn: new Date("2026-11-04T19:00:00Z"),
    signedService: "b",
    signedVersion: "2022-11-02",
    value: "a2V5LWZvci10aGUtdmVjdG9yLXRlc3QtMzItYnl0ZXMhIQ==",
  };
  const sas = (access: "read" | "write") =>
    new URLSearchParams(
      directorySas("devstoreaccount1", "org-a", "graphs/g5", access, key, new Date("2026-11-04T17:00:00Z"), new Date("2026-11-04T18:00:00Z"), "2022-11-02"),
    );

  it("names the directory and its depth, and signs as Azure's string-to-sign says", () => {
    const read = sas("read");
    expect([read.get("sr"), read.get("sdd"), read.get("sp"), read.get("spr")]).toEqual(["d", "2", "rl", "https"]);
    expect(read.get("sig")).toBe("PQA11Sf87khssSmiN5ANXFrvU386X2doyzGiwYxLwYw=");
    const write = sas("write");
    expect(write.get("sp")).toBe("cw");
    expect(write.get("sig")).toBe("El/VrfMn81NLk7S0pjcpYFhf7WRgB2ZECLfB+mv/v5w=");
  });
});

describe("gcsBoundary", () => {
  it("bounds a token to the prefix's objects, and to listing under it only to read", () => {
    const read = gcsBoundary("b", "graphs/g1", "read").accessBoundary.accessBoundaryRules[0]!;
    expect(read.availablePermissions).toEqual(["inRole:roles/storage.objectViewer"]);
    expect(read.availabilityCondition.expression).toContain("startsWith('projects/_/buckets/b/objects/graphs/g1/')");
    expect(read.availabilityCondition.expression).toContain("objectListPrefix");
    const write = gcsBoundary("b", "graphs/g1", "write").accessBoundary.accessBoundaryRules[0]!;
    expect(write.availablePermissions).toEqual(["inRole:roles/storage.objectCreator"]);
    expect(write.availabilityCondition.expression).not.toContain("objectListPrefix");
  });
});

describe("vend", () => {
  it("refuses a path that climbs out before it asks any cloud", async () => {
    const connection = { kind: "s3" as const, bucket: "b", root: "graphs", region: "us-east-1", roleArn: "arn:aws:iam::1:role/r" };
    await expect(vend(connection, "../x", "read", "s")).rejects.toSatisfy((e: unknown) => isProblem(e) && (e as { code: string }).code === "storage/path");
  });
});
