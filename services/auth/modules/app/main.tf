# One application, registered with the platform's realm: its client, the audience its access
# token names, and its roles. An application declares this from its own repository; the realm
# knows no application by name.

resource "keycloak_openid_client" "app" {
  realm_id    = var.realm_id
  client_id   = var.client_id
  name        = coalesce(var.name, var.client_id)
  description = var.description
  enabled     = true

  access_type   = var.access_type
  client_secret = var.access_type == "CONFIDENTIAL" ? var.client_secret : null

  standard_flow_enabled        = true
  implicit_flow_enabled        = false
  direct_access_grants_enabled = false
  service_accounts_enabled     = false

  # On a confidential client too: it costs nothing and closes code injection against the callback.
  pkce_code_challenge_method = "S256"

  valid_redirect_uris                 = var.redirect_uris
  valid_post_logout_redirect_uris     = var.post_logout_redirect_uris
  web_origins                         = var.web_origins
  backchannel_logout_session_required = true
}

# `included_custom_audience`: a resource server validates tokens and never obtains one, so it is
# not a client. The ID token is for the interface and must not name the API, or an interface that
# forwarded it would look valid there.
resource "keycloak_openid_audience_protocol_mapper" "api" {
  count = var.audience == null ? 0 : 1

  realm_id  = var.realm_id
  client_id = keycloak_openid_client.app.id
  name      = "audience"

  included_custom_audience = var.audience
  add_to_access_token      = true
  add_to_id_token          = false
}

# ── Roles, in tiers ──────────────────────────────────────────────────────────
# A composite refers to the ids of the roles it contains, and a resource cannot refer to its own
# instances, so roles are created by depth: those that contain nothing, then those that contain
# only the first tier, then the rest.
locals {
  tier0 = [for name, role in var.roles : name if length(role.composites) == 0]
  tier1 = [
    for name, role in var.roles : name
    if length(role.composites) > 0 && alltrue([for c in role.composites : contains(local.tier0, c)])
  ]
  tier2 = [
    for name, role in var.roles : name
    if !contains(concat(local.tier0, local.tier1), name)
    && alltrue([for c in role.composites : contains(concat(local.tier0, local.tier1), c)])
  ]
}

resource "terraform_data" "roles_nest_three_deep" {
  lifecycle {
    precondition {
      condition     = length(local.tier0) + length(local.tier1) + length(local.tier2) == length(var.roles)
      error_message = "The roles' composites nest more than three deep, or form a cycle."
    }
  }
}

resource "keycloak_role" "tier0" {
  for_each = toset(local.tier0)

  realm_id    = var.realm_id
  client_id   = keycloak_openid_client.app.id
  name        = each.key
  description = var.roles[each.key].description
}

resource "keycloak_role" "tier1" {
  for_each = toset(local.tier1)

  realm_id        = var.realm_id
  client_id       = keycloak_openid_client.app.id
  name            = each.key
  description     = var.roles[each.key].description
  composite_roles = [for c in var.roles[each.key].composites : keycloak_role.tier0[c].id]
}

resource "keycloak_role" "tier2" {
  for_each = toset(local.tier2)

  realm_id    = var.realm_id
  client_id   = keycloak_openid_client.app.id
  name        = each.key
  description = var.roles[each.key].description
  composite_roles = [
    for c in var.roles[each.key].composites :
    contains(local.tier0, c) ? keycloak_role.tier0[c].id : keycloak_role.tier1[c].id
  ]
}

resource "keycloak_openid_client_default_scopes" "app" {
  realm_id       = var.realm_id
  client_id      = keycloak_openid_client.app.id
  default_scopes = var.default_scopes
}

resource "keycloak_openid_client_optional_scopes" "app" {
  realm_id        = var.realm_id
  client_id       = keycloak_openid_client.app.id
  optional_scopes = var.optional_scopes
}
