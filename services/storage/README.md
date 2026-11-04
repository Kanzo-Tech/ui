# Storage

A credential that opens **one prefix** of an organization's storage — to read and list it, or to
write under it — **for an hour**, in [Iceberg REST's `StorageCredential`](https://github.com/apache/iceberg/blob/main/open-api/rest-catalog-open-api.yaml)
form. It is what Unity Catalog and Polaris vend for a table, narrowed (writing never deletes and
does not read), for any prefix an application decides a person may open.

```http
POST /v1/credentials
x-forwarded-access-token: <the person's Keycloak access token>

{ "path": "graph-42", "access": "write" }
```

```json
{ "storage-credentials": [{ "prefix": "s3://bucket/graphs/graph-42/", "config": { "s3.access-key-id": "…", "s3.session-token": "…" } }] }
```

## Nothing here signs

| Store | What opens the prefix | Done by |
|---|---|---|
| S3 and S3-compatible | AssumeRole with a session policy | `@aws-sdk/client-sts` |
| Azure (ADLS Gen2) | a user delegation SAS over the directory | `@azure/storage-file-datalake` |
| Google Cloud Storage | a Credential Access Boundary on a downscoped token | `google-auth-library` |

The service chooses the scope and names the keys (`src/vend.ts`). Its authority is the
**deployment's identity** — the AWS default chain, `DefaultAzureCredential`, Google's ADC — and the
organization grants that identity a role on its storage. No key of the organization's is stored.

## Who may call it

An application's **server**, inside the deployment's network, after its own permission check. It
forwards the person's access token as the edge forwarded it; the service verifies it against the
realm (`@kanzo-tech/auth/server`) and names the person in the cloud's audit log
(`RoleSessionName`). Whether this person may open this path is the application's decision: the
service holds no permissions of its own. `/docs/design/services` says why, and what would reverse it.

## Running it

```sh
STORAGE_CONNECTION='{"kind":"s3","bucket":"b","root":"graphs","region":"eu-west-1","roleArn":"arn:aws:iam::123:role/kanzo-storage","externalId":"…"}' \
AUTH_ISSUER=https://id.example/realms/kanzo AUTH_CLIENT_ID=my-app \
docker compose -f compose.yaml up -d --wait
```

`compose.dev.yaml` publishes :8090 and uses the application's development store's user in place
of the deployment's identity (`dev/dev.env`).
