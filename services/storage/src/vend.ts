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
import { Problem } from "@kanzo-tech/kernel";
import { DownscopedClient, GoogleAuth } from "google-auth-library";

export type Access = "read" | "write";

/** Iceberg REST's `StorageCredential`, verbatim: a prefix, and the configuration that opens it. */
export interface StorageCredential {
  readonly prefix: string;
  readonly config: Readonly<Record<string, string>>;
}

/**
 * The organization's storage, as the deployment declares it: where its graphs live (`root`) and the
 * role the deployment's identity is granted there. A role, never a key.
 */
export type Connection =
  | {
      readonly kind: "s3";
      readonly bucket: string;
      readonly root: string;
      readonly region: string;
      readonly roleArn: string;
      readonly externalId?: string;
      /** An S3-compatible store's endpoints (MinIO, SeaweedFS); AWS's own when absent. */
      readonly stsEndpoint?: string;
      readonly s3Endpoint?: string;
    }
  | { readonly kind: "adls"; readonly account: string; readonly container: string; readonly root: string }
  | { readonly kind: "gcs"; readonly bucket: string; readonly root: string };

/** Unity Catalog's and Polaris's lifetime. Readers renew before it lapses. */
export const LIFETIME_S = 3600;

/** Azure refuses a SAS whose start is ahead of its clock; Polaris backdates by the same margin. */
const SKEW_MS = 5 * 60 * 1000;

/**
 * The prefix a request may open: the path under the connection's root, relative, with no `.`, `..`
 * or empty segment. Anything else is `storage/path` — a caller cannot climb out of the root.
 */
export function under(root: string, path: string): string {
  const parts = path.split("/").filter((p) => p !== "");
  if (parts.length === 0 || parts.some((p) => p === "." || p === "..")) {
    throw new Problem("storage/path", `not a graph path: ${path}`, { path });
  }
  return [...root.split("/"), ...parts].filter((p) => p !== "").join("/");
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

async function s3(c: Extract<Connection, { kind: "s3" }>, prefix: string, access: Access, session: string): Promise<StorageCredential> {
  const sts = new STSClient({ region: c.region, ...(c.stsEndpoint ? { endpoint: c.stsEndpoint } : {}) });
  const { Credentials: k } = await sts.send(
    new AssumeRoleCommand({
      RoleArn: c.roleArn,
      ExternalId: c.externalId,
      RoleSessionName: session,
      Policy: s3Policy(c.bucket, prefix, access),
      DurationSeconds: LIFETIME_S,
    }),
  );
  if (!k?.AccessKeyId || !k.SecretAccessKey || !k.SessionToken || !k.Expiration) {
    throw new Problem("storage/refused", "STS answered without a credential");
  }
  return {
    prefix: `s3://${c.bucket}/${prefix}/`,
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

async function adls(c: Extract<Connection, { kind: "adls" }>, prefix: string, access: Access, identity: TokenCredential): Promise<StorageCredential> {
  const host = `${c.account}.dfs.core.windows.net`;
  const startsOn = new Date(Date.now() - SKEW_MS);
  const expiresOn = new Date(Date.now() + LIFETIME_S * 1000);
  const key = await new DataLakeServiceClient(`https://${host}`, identity).getUserDelegationKey(startsOn, expiresOn);
  return {
    prefix: `abfss://${c.container}@${host}/${prefix}/`,
    config: {
      [`adls.sas-token.${host}`]: directorySas(c.account, c.container, prefix, access, key, startsOn, expiresOn),
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

async function gcs(c: Extract<Connection, { kind: "gcs" }>, prefix: string, access: Access): Promise<StorageCredential> {
  const source = await new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] }).getClient();
  const downscoped = new DownscopedClient({ authClient: source as never, credentialAccessBoundary: gcsBoundary(c.bucket, prefix, access) });
  const { token, res } = await downscoped.getAccessToken();
  if (!token) throw new Problem("storage/refused", "Google's STS answered without a token");
  const expiresIn = (res?.data as { expires_in?: number } | undefined)?.expires_in ?? LIFETIME_S;
  return {
    prefix: `gs://${c.bucket}/${prefix}/`,
    config: { "gcs.oauth2.token": token, "gcs.oauth2.token-expires-at": String(Date.now() + expiresIn * 1000) },
  };
}

/** The deployment's identity, once: each SDK keeps and renews its own token. */
let azure: TokenCredential | undefined;

/**
 * One credential for `path` under the connection's root. `session` names the person in the cloud's
 * audit log (CloudTrail's `RoleSessionName`); the decision that they may is the caller's, taken
 * before it asks.
 */
export async function vend(c: Connection, path: string, access: Access, session: string): Promise<StorageCredential> {
  const prefix = under(c.root, path);
  try {
    if (c.kind === "s3") return await s3(c, prefix, access, session);
    if (c.kind === "adls") return await adls(c, prefix, access, (azure ??= new DefaultAzureCredential()));
    return await gcs(c, prefix, access);
  } catch (error) {
    if (error instanceof Problem) throw error;
    throw new Problem("storage/refused", `the store refused: ${(error as Error).message}`, {}, { cause: error });
  }
}
