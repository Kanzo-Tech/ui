# ONE realm for the whole platform. If each application had its own, the same
# person would be a different user in each, and there would be nothing for an
# organization to mean across applications. Applications are OIDC clients
# (modules/app); the tenants are the organizations.
resource "keycloak_realm" "kanzo" {
  realm        = var.realm
  enabled      = true
  display_name = "Kanzo"

  # The whole tenant model. Without it there is no `organization` client scope,
  # no organization groups, and no `organization` claim.
  organizations_enabled = true

  registration_allowed     = false
  login_with_email_allowed = true

  # Short access tokens because they are bearer credentials that no one can
  # revoke mid-life; the refresh token is the thing with a session behind it.
  access_token_lifespan    = "5m"
  sso_session_idle_timeout = "30m"
  sso_session_max_lifespan = "10h"

  # RFC 10017 requires, for a browser-based public client, either refresh token
  # rotation on every use or sender-constrained tokens, plus an absolute lifetime
  # or inactivity expiry. Rotation is realm-wide here: reuse revokes the chain.
  revoke_refresh_token    = true
  refresh_token_max_reuse = 0

  ssl_required = "external" # `all` would break plain-http localhost development

  # Passkeys beside the password, never instead of it. The username step offers the
  # passkeys a browser holds for this site as autofill (conditional mediation, the
  # default) and a "Sign in with Passkey" button; a passkey skips the password step.
  # The provider sends every field of the block, so the two Keycloak's passwordless
  # scenario requires are spelled out rather than reset to `not specified`. A person
  # adds one from the account console (Signing in → Passkeys), through the
  # `webauthn-register-passwordless` required action Keycloak enables in every realm.
  web_authn_passwordless_policy {
    passwordless_passkeys_enabled = true
    relying_party_entity_name     = "Kanzo"
    user_verification_requirement = "required"
    discoverable_credential       = "required" # what autofill lists: no username needed
  }
}
