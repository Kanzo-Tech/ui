# One resource server, registered with the platform's realm: an API, the AI gateway, a storage
# broker. It obtains no token, so its client has no flow; it exists to be named. A token reaches
# it through an application's token exchange (RFC 8693), which asks for this scope and this
# audience and gets a token that names nothing else.

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

# The scope an exchange asks for, named as the client is. Optional on every application that calls
# this API (modules/app `apis`), so a sign-in never asks for it and the session's token names no
# API; an exchange asks for it and gets a token whose `aud` is this API alone.
resource "keycloak_openid_client_scope" "api" {
  realm_id               = var.realm_id
  name                   = var.client_id
  description            = "Names ${var.client_id} in aud. Asked for in a token exchange, never at sign-in."
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
