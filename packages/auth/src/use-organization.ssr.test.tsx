// @vitest-environment node

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AuthProvider } from "./auth-provider";
import type { Auth } from "./types";
import { useOrganization } from "./use-organization";

const auth: Auth = {
  getSession: async () => null,
  subscribe: () => () => {},
  signIn: async () => {},
  signOut: async () => {},
  fetch: globalThis.fetch,
};

function Probe() {
  const { organization, isMember } = useOrganization();
  return <span>{`${organization?.alias ?? "-"}:${isMember}`}</span>;
}

describe("useOrganization on a server", () => {
  it("renders without a window, because there is one render before the browser has one", () => {
    // Node, not jsdom — the file's own environment line. The hostname is a browser fact, so the
    // server render resolves to nothing; there is no hydration mismatch to manage either, since
    // the session arrives in the provider's effect and the first client render agrees with this.
    expect(typeof window).toBe("undefined");
    expect(
      renderToStaticMarkup(
        <AuthProvider auth={auth}>
          <Probe />
        </AuthProvider>,
      ),
    ).toBe("<span>-:false</span>");
  });
});
