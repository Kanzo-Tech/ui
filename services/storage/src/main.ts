/**
 * The storage service: `POST /v1/credentials` `{ path, access }` → `{ "storage-credentials": [...] }`,
 * Iceberg REST's `LoadCredentialsResponse`. Its caller is an application's server, after its own
 * permission check, forwarding the person's access token as the edge forwarded it to that server
 * (`x-forwarded-access-token`); the token is verified against the realm's keys by
 * `@kanzo-tech/auth/server`, must name a member of the deployment's organization (`AUTH_ORGANIZATION`),
 * and names the person in the cloud's audit log. The service is reached only on its own network,
 * which the application's server alone joins (`compose.yaml`).
 */
import { createServer } from "node:http";
import { sessionReader } from "@kanzo-tech/auth/server";
import { Problem } from "@kanzo-tech/kernel";
import { member } from "./caller.ts";
import { vend, type Access, type Connection } from "./vend.ts";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const connection = JSON.parse(required("STORAGE_CONNECTION")) as Connection;
const read = sessionReader({
  issuer: required("AUTH_ISSUER"),
  clientId: required("AUTH_CLIENT_ID"),
  ...(process.env.AUTH_JWKS ? { jwks: process.env.AUTH_JWKS } : {}),
});
const organization = required("AUTH_ORGANIZATION");
const port = Number(process.env.PORT ?? 8090);

/** What a role session may be named: `[\w+=,.@-]`, at most 64 characters (STS). */
const sessionName = (id: string) => `kanzo-${id}`.replace(/[^\w+=,.@-]/g, "_").slice(0, 64);

createServer(async (request, response) => {
  const reply = (status: number, body: unknown, type = "application/json") => {
    response.writeHead(status, { "content-type": type });
    response.end(JSON.stringify(body));
  };
  const problem = (p: Problem) => reply(p.status ?? 500, p.toJSON(), "application/problem+json");
  if (request.method === "GET" && request.url === "/health") return reply(200, { status: "UP" });
  if (request.method !== "POST" || request.url !== "/v1/credentials") return reply(404, { error: "not found" });
  try {
    const headers = new Headers();
    for (const [name, value] of Object.entries(request.headers)) if (typeof value === "string") headers.set(name, value);
    const session = await read(headers);
    if (session === null) return problem(new Problem("session/absent", "no access token was forwarded"));
    member(session, organization);
    let body = "";
    for await (const chunk of request) body += chunk;
    const { path, access } = JSON.parse(body) as { path?: unknown; access?: unknown };
    if (typeof path !== "string" || (access !== "read" && access !== "write")) {
      return problem(new Problem("storage/path", "the body is { path, access: read | write }", { path: String(path) }));
    }
    const credential = await vend(connection, path, access as Access, sessionName(session.user.id));
    reply(200, { "storage-credentials": [credential] });
  } catch (error) {
    problem(error instanceof Problem ? error : new Problem("storage/refused", String(error), {}, { cause: error }));
  }
}).listen(port, () => console.log(`storage: ${connection.kind} on :${port}`));
