// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isSameSite } from "./same-site";

const ORIGIN = "https://app.example.test";

function asking(headers: Record<string, string>): Request {
  return new Request(`${ORIGIN}/api/data/reports`, { headers });
}

describe("isSameSite", () => {
  it("trusts a request the browser says came from us", () => {
    expect(isSameSite(asking({ "sec-fetch-site": "same-origin" }))).toBe(true);
  });

  /**
   * A bookmark, a typed URL, a link opened from a mail client. It is the person acting, which is
   * the thing being protected rather than the thing being refused.
   */
  it("trusts a request that came from no page at all", () => {
    expect(isSameSite(asking({ "sec-fetch-site": "none" }))).toBe(true);
  });

  it("refuses a cross-site request", () => {
    expect(isSameSite(asking({ "sec-fetch-site": "cross-site" }))).toBe(false);
  });

  /**
   * `same-site` is a sibling subdomain, and it is refused on purpose. The cookie is `__Host-` and
   * therefore host-only, but host-only says where the cookie *lives*, not who may cause a request
   * to it — so anything that can serve `docs.example.test` could otherwise call `app.example.test`'s
   * API as every reader of it.
   */
  it("refuses a sibling subdomain, which the cookie prefix does not cover", () => {
    expect(isSameSite(asking({ "sec-fetch-site": "same-site" }))).toBe(false);
  });

  it("falls back to Origin when the browser is too old to say", () => {
    expect(isSameSite(asking({ origin: ORIGIN }))).toBe(true);
    expect(isSameSite(asking({ origin: "https://evil.test" }))).toBe(false);
  });

  it("prefers Fetch Metadata over an Origin that disagrees", () => {
    // Script can set neither, but a proxy or a misconfiguration can mangle `Origin`, and the
    // header the browser sets for exactly this question is the one to read.
    expect(isSameSite(asking({ "sec-fetch-site": "cross-site", origin: ORIGIN }))).toBe(false);
  });

  /**
   * The end of the ladder is a refusal. A request carrying no evidence of where it came from is a
   * `curl`, a probe, a stripped proxy or an attacker's control. Only the browser calls `/api/*`
   * through the application, and there is no option.
   */
  it("refuses a request with neither Sec-Fetch-Site nor Origin", () => {
    expect(isSameSite(asking({}))).toBe(false);
  });

  it("refuses Origin: null, which no origin equals", () => {
    expect(isSameSite(asking({ origin: "null" }))).toBe(false);
  });
});
