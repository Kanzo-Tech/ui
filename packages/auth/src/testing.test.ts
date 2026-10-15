import { describe, expect, it, vi } from "vitest";
import { claims } from "./claims";
import { fakeAuth } from "./testing";

const session = claims({ sub: "u-1", organization: { acme: {} } }, { clientId: "board" });

describe("fakeAuth", () => {
  it("answers the session it was given, and tells its subscribers when it changes", async () => {
    const auth = fakeAuth(session);
    const heard = vi.fn();
    const unsubscribe = auth.subscribe(heard);

    expect(await auth.getSession()).toBe(session);
    await auth.signOut();
    expect(await auth.getSession()).toBeNull();
    await auth.signIn();
    expect(await auth.getSession()).toBe(session);
    auth.set(null);
    expect(heard).toHaveBeenCalledTimes(3);

    unsubscribe();
    auth.set(session);
    expect(heard).toHaveBeenCalledTimes(3);
  });

  it("uses the host's fetch, and a 204 otherwise", async () => {
    expect((await fakeAuth(null).fetch("/anything")).status).toBe(204);
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response("mine"));
    expect(await (await fakeAuth(null, { fetch }).fetch("/x")).text()).toBe("mine");
  });
});
