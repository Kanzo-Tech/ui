# One resource server, registered with the platform's realm: an API, a storage
# broker. It obtains no token, so its client has no flow; it exists to be named. A token reaches
# it from an application whose sign-in asked for this scope: the edge's access token then names
# this API in `aud`, and the application forwards it as it came.

resource "keycloak_openid_client" "api" {
  realm_id    = var.realm_id
  client_id   = var.client_id
  name        = coalesce(var.name, var.client_id)
  description = var.description
  enabled     = true

  access_type                  = "BEARER-ONLY"
  standard_flow_enabled        = false
  implicit_flow_enabled        = false
  direct_access_grants_enabled = false
  service_accounts_enabled     = false
}

# The scope a sign-in asks for, named as the client is. Optional on every application that calls
# this API (modules/app `apis`), so only a sign-in that names it — the edge's, beside
# `organization:*` — gets an access token whose `aud` names this API.
resource "keycloak_openid_client_scope" "api" {
  realm_id               = var.realm_id
  name                   = var.client_id
  description            = "Names ${var.client_id} in aud. Asked for at sign-in, beside organization:*."
  include_in_token_scope = true
}

# On the access token only: the ID token is for the interface, and an interface that forwarded it
# must not look valid at the API.
resource "keycloak_openid_audience_protocol_mapper" "api" {
  realm_id        = var.realm_id
  client_scope_id = keycloak_openid_client_scope.api.id
  name            = "audience"

  included_client_audience = keycloak_openid_client.api.client_id
  add_to_access_token      = true
  add_to_id_token          = false
}
