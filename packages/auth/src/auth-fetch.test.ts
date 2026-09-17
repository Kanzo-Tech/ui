import { describe, expect, it, vi } from "vitest";
import { authFetch, type TokenSource } from "./auth-fetch";

function source(tokens: { current: string | null; renewed?: string | null }): TokenSource {
  return {
    current: vi.fn(async () => tokens.current),
    renew: vi.fn(async () => tokens.renewed ?? null),
  };
}

const ok = () => new Response("fine", { status: 200 });
const unauthorized = () => new Response("no", { status: 401 });

describe("authFetch", () => {
  it("attaches the bearer token", async () => {
    const base = vi.fn(async () => ok());
    await authFetch(source({ current: "t-1" }), base)("/v1/jobs");

    const [, init] = base.mock.calls[0] as unknown as [RequestInfo, RequestInit];
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer t-1");
  });

  it("sends no header at all when there is no token, which is the BFF case", async () => {
    // The cookie rides along on a same-origin request by itself; an empty `Bearer` would be worse
    // than nothing, because a resource server may reject it rather than ignore it.
    const base = vi.fn(async () => ok());
    await authFetch(source({ current: null }), base)("/v1/jobs");

    const [, init] = base.mock.calls[0] as unknown as [RequestInfo, RequestInit];
    expect(new Headers(init.headers).has("Authorization")).toBe(false);
  });

  it("keeps the caller's own headers", async () => {
    const base = vi.fn(async () => ok());
    await authFetch(source({ current: "t-1" }), base)("/v1/jobs", {
      headers: { "Content-Type": "application/json" },
    });

    const [, init] = base.mock.calls[0] as unknown as [RequestInfo, RequestInit];
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
  });

  it("renews once on a 401 and retries with the new token", async () => {
    const base = vi
      .fn<typeof globalThis.fetch>()
      .mockImplementationOnce(async () => unauthorized())
      .mockImplementationOnce(async () => ok());
    const tokens = source({ current: "stale", renewed: "fresh" });

    const response = await authFetch(tokens, base)("/v1/jobs");

    expect(response.status).toBe(200);
    expect(base).toHaveBeenCalledTimes(2);
    const [, retry] = base.mock.calls[1] as unknown as [RequestInfo, RequestInit];
    expect(new Headers(retry.headers).get("Authorization")).toBe("Bearer fresh");
  });

  it("retries only once, so an expired session is not a loop", async () => {
    const base = vi.fn(async () => unauthorized());
    const response = await authFetch(source({ current: "stale", renewed: "fresh" }), base)("/v1/x");

    expect(response.status).toBe(401);
    expect(base).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 403, which is an answer rather than a stale credential", async () => {
    const base = vi.fn(async () => new Response("nope", { status: 403 }));
    const tokens = source({ current: "t-1", renewed: "t-2" });

    expect((await authFetch(tokens, base)("/v1/x")).status).toBe(403);
    expect(base).toHaveBeenCalledTimes(1);
    expect(tokens.renew).not.toHaveBeenCalled();
  });

  it("does not renew when there was no token to be stale", async () => {
    const base = vi.fn(async () => unauthorized());
    const tokens = source({ current: null });

    expect((await authFetch(tokens, base)("/v1/x")).status).toBe(401);
    expect(base).toHaveBeenCalledTimes(1);
    expect(tokens.renew).not.toHaveBeenCalled();
  });

  it("does not retry when renewal returns the same token", async () => {
    // Renewing to the same value means nothing changed; sending it again would ask a question that
    // has already been answered.
    const base = vi.fn(async () => unauthorized());
    const response = await authFetch(source({ current: "same", renewed: "same" }), base)("/v1/x");

    expect(response.status).toBe(401);
    expect(base).toHaveBeenCalledTimes(1);
  });

  it("does not retry a streamed body, because it cannot be sent twice", async () => {
    // The dishonest alternative is retrying with an empty body and reporting the far end's
    // complaint about it. Better: the 401 reaches the caller intact.
    const base = vi.fn(async () => unauthorized());
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("{}"));
        controller.close();
      },
    });

    const response = await authFetch(source({ current: "stale", renewed: "fresh" }), base)("/v1/x", {
      method: "POST",
      body,
      // @ts-expect-error duplex is required for a stream body and is not in older lib.dom types
      duplex: "half",
    });

    expect(response.status).toBe(401);
    expect(base).toHaveBeenCalledTimes(1);
  });

  it("retries a string body, which can be sent again", async () => {
    const base = vi
      .fn<typeof globalThis.fetch>()
      .mockImplementationOnce(async () => unauthorized())
      .mockImplementationOnce(async () => ok());

    const response = await authFetch(source({ current: "stale", renewed: "fresh" }), base)("/v1/x", {
      method: "POST",
      body: JSON.stringify({ name: "acme" }),
    });

    expect(response.status).toBe(200);
    const [, retry] = base.mock.calls[1] as unknown as [RequestInfo, RequestInit];
    expect(retry.body).toBe(JSON.stringify({ name: "acme" }));
  });
});
