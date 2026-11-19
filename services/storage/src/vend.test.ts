import { isProblem } from "@kanzo-tech/problems";
import { describe, expect, it } from "vitest";
import { directorySas, gcsBoundary, type Location, s3Policy, vend, within } from "./vend.ts";

const locations: Location[] = [
  { kind: "s3", url: "s3://b/graphs", region: "us-east-1", roleArn: "arn:aws:iam::1:role/r" },
  { kind: "s3", url: "s3://b/graphs/sales", region: "eu-west-1", roleArn: "arn:aws:iam::1:role/sales" },
  { kind: "adls", url: "abfss://c@acct.dfs.core.windows.net/" },
  { kind: "gcs", url: "gs://g/raw" },
];
const refused = expect.objectContaining({ code: "storage/path" });

describe("within", () => {
  it("opens the prefix a URL names, in the deepest location that holds it", () => {
    expect(within(locations, "s3://b/graphs/g1/")).toMatchObject({ location: locations[0], bucket: "b", prefix: "graphs/g1" });
    expect(within(locations, "s3a://b/graphs/sales/q3")).toMatchObject({ location: locations[1], prefix: "graphs/sales/q3" });
    expect(within(locations, "s3://b/graphs")).toMatchObject({ location: locations[0], prefix: "graphs" });
    expect(within(locations, "abfss://c@ACCT.dfs.core.windows.net/x/y")).toMatchObject({ location: locations[2], bucket: "c", account: "acct", prefix: "x/y" });
    expect(within(locations, "gs://g/raw/2026")).toMatchObject({ location: locations[3], prefix: "raw/2026" });
  });

  it("refuses what no location holds, a whole bucket, and a path that climbs", () => {
    for (const url of [
      "s3://b/graphsx/g1", "s3://b/other", "s3://other/graphs/g1", "gs://b/graphs/g1",
      "abfss://c@other.dfs.core.windows.net/x", "abfss://c@acct.dfs.core.windows.net/",
      "s3://b/graphs/../x", "s3://b/graphs/./g1", "s3://b/graphs//g1", "https://b/graphs/g1", "graphs/g1",
    ]) {
      expect(() => within(locations, url), url).toThrow(refused);
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
  it("refuses a URL outside its locations before it asks any cloud", async () => {
    await expect(vend(locations, "s3://b/elsewhere", "read", "s")).rejects.toSatisfy((e: unknown) => isProblem(e) && (e as { code: string }).code === "storage/path");
  });
});
