---
"@kanzo-tech/auth": minor
---

**`ticketStore` bounds every adapter call itself, and `accountUrl` links Keycloak's account console.**

- Every `read`, `write` and `delete` a `ticketStore` makes on its adapter now ends at 30 s, rejecting
  as `session/silent` (`data.after: 30000`), which `relyingParty` reports as `session/unavailable`
  with that as the cause. If your adapter raced its own driver calls against a timeout, delete that:
  an adapter is the three driver calls. Keep the driver's connect timeout and no-offline-queue
  settings, which make a store that is down refuse at once.
- `accountUrl(issuer, page?)` returns `{issuer}/account`, or one of its pages —
  `AccountPage`: `""`, `"account-security/signing-in"`, `"account-security/device-activity"`. If you
  built that URL yourself, use this.
