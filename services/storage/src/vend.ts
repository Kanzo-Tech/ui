/**
 * A credential that opens one prefix of an organization's storage — for reading and listing, or for
 * writing — for an hour, in Iceberg REST's `StorageCredential` form: what `@fossil-lang/storage`
 * consumes in the browser. The temporary credentials of Unity Catalog and Polaris, narrowed.
 *
 * Nothing here signs or mints. Each cloud's own SDK does: STS's AssumeRole with a session policy
 * (AWS), a user delegation SAS over a directory (Azure), a Credential Access Boundary (Google). This
 * module chooses the scope and names the keys. Its authority is the deployment's identity — the AWS
 * default chain, `DefaultAzureCredential`, Google's ADC — and the organization grants that identity
 * a role; no secret of the organization's is stored (`/docs/design/services`, *The storage service*).
 */
import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";
import { DefaultAzureCredential, type TokenCredential } from "@azure/identity";
import { DataLakeServiceClient, DirectorySASPermissions, generateDataLakeSASQueryParameters, SASProtocol } from "@azure/storage-file-datalake";
import { Problem } from "@kanzo-tech/problems";
import { DownscopedClient, GoogleAuth } from "google-auth-library";

export type Access = "read" | "write";

/** Iceberg REST's `StorageCredential`, verbatim: a prefix, and the configuration that opens it. */
export interface StorageCredential {
  readonly prefix: string;
  readonly config: Readonly<Record<string, string>>;
}

/**
 * Where the organization's data may live, as the deployment declares it: a storage URL and the role
 * the deployment's identity is granted there — Unity Catalog's external location and its storage
 * credential in one. A role, never a key.
 */
export type Location =
  | {
      readonly kind: "s3";
      /** `s3://bucket/prefix` */
      readonly url: string;
      readonly region: string;
      readonly roleArn: string;
      readonly externalId?: string;
      /** An S3-compatible store's endpoints (MinIO, SeaweedFS); AWS's own when absent. */
      readonly stsEndpoint?: string;
      readonly s3Endpoint?: string;
    }
  | {
      readonly kind: "adls";
      /** `abfss://container@account.dfs.core.windows.net/prefix` */
      readonly url: string;
    }
  | {
      readonly kind: "gcs";
      /** `gs://bucket/prefix` */
      readonly url: string;
    };

/** Unity Catalog's and Polaris's lifetime. Readers renew before it lapses. */
export const LIFETIME_S = 3600;

/** Azure refuses a SAS whose start is ahead of its clock; Polaris backdates by the same margin. */
const SKEW_MS = 5 * 60 * 1000;

/** A storage URL taken apart: which store (`kind`, and the bucket or the account's container) and the path's segments. */
interface Parsed {
  readonly kind: Location["kind"];
  readonly bucket: string;
  readonly account?: string;
  readonly segments: readonly string[];
}

const SCHEMES: Readonly<Record<string, Location["kind"]>> = { s3: "s3", s3a: "s3", abfss: "adls", gs: "gcs" };

/**
 * `s3://b/a`, `abfss://c@account.dfs.core.windows.net/a`, `gs://b/a`. The path is taken as the text
 * names it: a `.`, a `..` or an empty segment is refused, never resolved, so what is checked against a
 * location and what is signed are the same string.
 */
export function parse(url: string): Parsed {
  const refuse = (why: string) => new Problem("storage/path", `${url}: ${why}`, { path: url });
  const match = /^([a-z0-9]+):\/\/([^/]+)(\/.*)?$/i.exec(url);
  const kind = match && SCHEMES[match[1]!.toLowerCase()];
  if (!match || !kind) throw refuse("not an s3://, abfss:// or gs:// URL");
  const path = (match[3] ?? "").replace(/^\/|\/$/g, "");
  const segments = path === "" ? [] : path.split("/");
  if (segments.some((s) => s === "" || s === "." || s === "..")) throw refuse("a path names no `.`, `..` or empty segment");
  if (kind === "adls") {
    const at = /^([^@]+)@([a-z0-9]+)\.dfs\.core\.windows\.net$/i.exec(match[2]!);
    if (!at) throw refuse("names no container@account.dfs.core.windows.net");
    return { kind, bucket: at[1]!, account: at[2]!.toLowerCase(), segments };
  }
  if (/[@:]/.test(match[2]!)) throw refuse("names no bucket");
  return { kind, bucket: match[2]!, segments };
}

/**
 * The declared location `url` lies in, and the prefix to open — `url`'s own path, never the
 * location's root alone unless it is that. A URL in no declared location is `storage/path`: the
 * deployment's identity reaches only what the organization granted, and this service only what it
 * was told was granted.
 */
export function within<L extends Location>(locations: readonly L[], url: string): { location: L; bucket: string; account?: string; prefix: string } {
  const wanted = parse(url);
  const same = (a: Parsed) => a.kind === wanted.kind && a.bucket === wanted.bucket && a.account === wanted.account;
  const found = locations
    .map((location) => ({ location, root: parse(location.url) }))
    .filter(({ root }) => same(root) && root.segments.every((s, i) => wanted.segments[i] === s))
    .sort((a, b) => b.root.segments.length - a.root.segments.length)[0];
  if (!found) throw new Problem("storage/path", `${url} is in no storage location of this deployment`, { path: url });
  if (wanted.segments.length === 0) throw new Problem("storage/path", `${url} names a whole bucket`, { path: url });
  return { location: found.location, bucket: wanted.bucket, ...(wanted.account ? { account: wanted.account } : {}), prefix: wanted.segments.join("/") };
}

/** Read and list the prefix, or write under it. Never delete, and writing does not read. */
export function s3Policy(bucket: string, prefix: string, access: Access): string {
  const objects = `arn:aws:s3:::${bucket}/${prefix}/*`;
  const Statement =
    access === "read"
      ? [
          { Effect: "Allow", Action: ["s3:GetObject"], Resource: [objects] },
          {
            Effect: "Allow",
            Action: ["s3:ListBucket"],
            Resource: [`arn:aws:s3:::${bucket}`],
            Condition: { StringLike: { "s3:prefix": [`${prefix}/*`] } },
          },
        ]
      : [{ Effect: "Allow", Action: ["s3:PutObject", "s3:AbortMultipartUpload"], Resource: [objects] }];
  return JSON.stringify({ Version: "2012-10-17", Statement });
}

/** The directory SAS's permissions: read and list, or create and write. */
export function sasPermissions(access: Access): DirectorySASPermissions {
  return DirectorySASPermissions.parse(access === "read" ? "rl" : "cw");
}

/** The SDK's directory SAS, for a delegation key already obtained. */
export function directorySas(
  account: string,
  container: string,
  prefix: string,
  access: Access,
  key: Parameters<typeof generateDataLakeSASQueryParameters>[1],
  startsOn: Date,
  expiresOn: Date,
  version?: string,
): string {
  return generateDataLakeSASQueryParameters(
    {
      fileSystemName: container,
      pathName: prefix,
      isDirectory: true,
      protocol: SASProtocol.Https,
      permissions: sasPermissions(access),
      startsOn,
      expiresOn,
      ...(version ? { version } : {}),
    },
    key,
    account,
  ).toString();
}

async function s3(c: Extract<Location, { kind: "s3" }>, bucket: string, prefix: string, access: Access, session: string): Promise<StorageCredential> {
  const sts = new STSClient({ region: c.region, ...(c.stsEndpoint ? { endpoint: c.stsEndpoint } : {}) });
  const { Credentials: k } = await sts.send(
    new AssumeRoleCommand({
      RoleArn: c.roleArn,
      ExternalId: c.externalId,
      RoleSessionName: session,
      Policy: s3Policy(bucket, prefix, access),
      DurationSeconds: LIFETIME_S,
    }),
  );
  if (!k?.AccessKeyId || !k.SecretAccessKey || !k.SessionToken || !k.Expiration) {
    throw new Problem("storage/refused", "STS answered without a credential");
  }
  return {
    prefix: `s3://${bucket}/${prefix}/`,
    config: {
      "s3.access-key-id": k.AccessKeyId,
      "s3.secret-access-key": k.SecretAccessKey,
      "s3.session-token": k.SessionToken,
      "s3.session-token-expires-at-ms": String(k.Expiration.getTime()),
      "client.region": c.region,
      ...(c.s3Endpoint ? { "s3.endpoint": c.s3Endpoint, "s3.path-style-access": "true" } : {}),
    },
  };
}

async function adls(account: string, container: string, prefix: string, access: Access, identity: TokenCredential): Promise<StorageCredential> {
  const host = `${account}.dfs.core.windows.net`;
  const startsOn = new Date(Date.now() - SKEW_MS);
  const expiresOn = new Date(Date.now() + LIFETIME_S * 1000);
  const key = await new DataLakeServiceClient(`https://${host}`, identity).getUserDelegationKey(startsOn, expiresOn);
  return {
    prefix: `abfss://${container}@${host}/${prefix}/`,
    config: {
      [`adls.sas-token.${host}`]: directorySas(account, container, prefix, access, key, startsOn, expiresOn),
      [`adls.sas-token-expires-at-ms.${host}`]: String(expiresOn.getTime()),
    },
  };
}

/** The Credential Access Boundary of a prefix: its objects, and (to read) listing under it. */
export function gcsBoundary(bucket: string, prefix: string, access: Access) {
  const resource = `projects/_/buckets/${bucket}`;
  const objects = `resource.name.startsWith('${resource}/objects/${prefix}/')`;
  const listing = `api.getAttribute('storage.googleapis.com/objectListPrefix', '').startsWith('${prefix}/')`;
  return {
    accessBoundary: {
      accessBoundaryRules: [
        {
          availableResource: `//storage.googleapis.com/${resource}`,
          availablePermissions: [access === "read" ? "inRole:roles/storage.objectViewer" : "inRole:roles/storage.objectCreator"],
          availabilityCondition: { expression: access === "read" ? `${objects} || ${listing}` : objects },
        },
      ],
    },
  };
}

async function gcs(bucket: string, prefix: string, access: Access): Promise<StorageCredential> {
  const source = await new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] }).getClient();
  const downscoped = new DownscopedClient({ authClient: source as never, credentialAccessBoundary: gcsBoundary(bucket, prefix, access) });
  const { token, res } = await downscoped.getAccessToken();
  if (!token) throw new Problem("storage/refused", "Google's STS answered without a token");
  const expiresIn = (res?.data as { expires_in?: number } | undefined)?.expires_in ?? LIFETIME_S;
  return {
    prefix: `gs://${bucket}/${prefix}/`,
    config: { "gcs.oauth2.token": token, "gcs.oauth2.token-expires-at": String(Date.now() + expiresIn * 1000) },
  };
}

/** The deployment's identity, once: each SDK keeps and renews its own token. */
let azure: TokenCredential | undefined;

/**
 * One credential for the prefix `url` names, inside one of the deployment's `locations`. `session`
 * names the person in the cloud's audit log (CloudTrail's `RoleSessionName`); the decision that they
 * may is the caller's, taken before it asks.
 */
export async function vend(locations: readonly Location[], url: string, access: Access, session: string): Promise<StorageCredential> {
  const { location, bucket, account, prefix } = within(locations, url);
  try {
    if (location.kind === "s3") return await s3(location, bucket, prefix, access, session);
    if (location.kind === "adls") return await adls(account!, bucket, prefix, access, (azure ??= new DefaultAzureCredential()));
    return await gcs(bucket, prefix, access);
  } catch (error) {
    if (error instanceof Problem) throw error;
    throw new Problem("storage/refused", `the store refused: ${(error as Error).message}`, {}, { cause: error });
  }
}
