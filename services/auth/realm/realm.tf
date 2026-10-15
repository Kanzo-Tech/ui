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

  # The baseline, set explicitly so the posture does not rest on a default nobody read. The shape
  # is here and the production figures are the deployment's (variables.tf), as for hostnames.
  # Second factor: none is required by the platform. Passkeys below carry user verification, and a
  # deployment that wants OTP for everyone declares it in its own flow; the package asks for none.
  password_policy = var.password_policy

  security_defenses {
    # Temporary lockout, escalating: permanent lockout would let anyone who knows a username lock
    # that person out for good, which is a denial of service handed to a stranger.
    brute_force_detection {
      permanent_lockout                = false
      max_login_failures               = var.max_login_failures
      wait_increment_seconds           = 60
      quick_login_check_milli_seconds  = 1000
      minimum_quick_login_wait_seconds = 60
      max_failure_wait_seconds         = var.lockout_max_wait_seconds
      failure_reset_time_seconds       = 43200
    }
  }

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

# Login events and admin events, kept for `events_retention_seconds`. The listener is Keycloak's
# own log, which a deployment ships wherever it ships its logs; the realm stores what the admin
# console shows and prunes it at the retention.
resource "keycloak_realm_events" "kanzo" {
  realm_id = keycloak_realm.kanzo.id

  events_enabled    = true
  events_expiration = var.events_retention_seconds
  events_listeners  = ["jboss-logging"]

  admin_events_enabled         = true
  admin_events_details_enabled = true
}
