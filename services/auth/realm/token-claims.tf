# ── The claims, on BOTH tokens ────────────────────────────────────────────────
#
# A realm whose mappers leave `access.token.claim` off cannot be authorized on:
# the resource server sees no roles and has to trust whoever forwarded the call.
#
# The split:
#   ACCESS token  — what a resource server authorizes on. Must carry roles and
#                   organization, and must name its audience.
#   ID token      — what a UI draws from. Carries the same roles and organization,
#                   because a `<Gate>` needs them to hide a button. It does not
#                   decide anything; the resource server does.
#
# ── Why these are `import` blocks ─────────────────────────────────────────────
# Keycloak creates the `organization` and `roles` client scopes and their mappers
# itself, when the realm is created. They are exactly the mappers we need to
# change, and Terraform cannot change a resource it does not own — so it adopts
# them: a data source finds the id, an `import` block brings it into state, and a
# resource declares what it should say. The provider documents this pattern for
# this mapper by name.
#
# The cost is real and is why apply runs twice (see docker-compose.yml): an
# `import` id must resolve at PLAN time, and on an empty Keycloak the realm does
# not exist yet. First apply the realm alone, then everything.

data "keycloak_openid_client_scope" "organization" {
  realm_id = keycloak_realm.kanzo.id
  name     = "organization"
}

data "keycloak_openid_client_scope" "roles" {
  realm_id = keycloak_realm.kanzo.id
  name     = "roles"
}

# ── organization ──────────────────────────────────────────────────────────────

data "keycloak_generic_protocol_mapper" "organization" {
  realm_id        = keycloak_realm.kanzo.id
  client_scope_id = data.keycloak_openid_client_scope.organization.id
  name            = "organization"
}

import {
  to = keycloak_generic_protocol_mapper.organization
  id = "${var.realm}/client-scope/${data.keycloak_openid_client_scope.organization.id}/${data.keycloak_generic_protocol_mapper.organization.id}"
}

# Keycloak's own mapper, told to emit the id. Without `addOrganizationId` the claim
# is a bare list of aliases — `["acme"]` — and a consumer has nothing to key on.
# There must be exactly ONE membership mapper in play: a second one on the client
# does not override this one, it collides with it, and the claim comes out with a
# serialised JSON string as an object key. That was measured, not assumed.
resource "keycloak_generic_protocol_mapper" "organization" {
  realm_id        = keycloak_realm.kanzo.id
  client_scope_id = data.keycloak_openid_client_scope.organization.id
  name            = "organization"
  protocol        = "openid-connect"
  protocol_mapper = "oidc-organization-membership-mapper"

  config = {
    "claim.name" = "organization"
    # JSON, not String: with `addOrganizationId` the claim is an object, and
    # Keycloak rewrites the label to match. Declaring "String" here applies
    # cleanly and then shows up as a diff on the next plan, forever.
    "jsonType.label"            = "JSON"
    "multivalued"               = "true"
    "addOrganizationId"         = "true"
    "addOrganizationAttributes" = "false"
    "id.token.claim"            = "true"
    "access.token.claim"        = "true"
    "introspection.token.claim" = "true"
    "userinfo.token.claim"      = "true"
  }
}

# Fills each organization entry of the same claim with what the person holds THERE:
# `groups` (the paths, which are the organization's own data and mean nothing to an
# application) and, with `addGroupRoleMappings`, `resource_access.<client>.roles` —
# the roles mapped onto those groups, composites expanded. That second part is the
# contract: an application reads its roles in an organization from
# `organization[alias].resource_access[client_id].roles` and never parses a group
# name. Additive — it merges into the object the mapper above produces — which is
# why it is a second mapper and not a flag on the first one.
resource "keycloak_generic_protocol_mapper" "organization_groups" {
  realm_id        = keycloak_realm.kanzo.id
  client_scope_id = data.keycloak_openid_client_scope.organization.id
  name            = "organization-groups"
  protocol        = "openid-connect"
  protocol_mapper = "oidc-organization-group-membership-mapper"

  config = {
    "addGroupRoleMappings"      = "true"
    "id.token.claim"            = "true"
    "access.token.claim"        = "true"
    "introspection.token.claim" = "true"
    "userinfo.token.claim"      = "true"
  }
}

# ── roles ─────────────────────────────────────────────────────────────────────
# Keycloak ships these with `id.token.claim` unset, i.e. access token only. A BFF
# reads the ID token and a SPA must never open an access token, so a UI that wants
# to draw from roles needs them in the ID token as well.

data "keycloak_generic_protocol_mapper" "realm_roles" {
  realm_id        = keycloak_realm.kanzo.id
  client_scope_id = data.keycloak_openid_client_scope.roles.id
  name            = "realm roles"
}

import {
  to = keycloak_generic_protocol_mapper.realm_roles
  id = "${var.realm}/client-scope/${data.keycloak_openid_client_scope.roles.id}/${data.keycloak_generic_protocol_mapper.realm_roles.id}"
}

resource "keycloak_generic_protocol_mapper" "realm_roles" {
  realm_id        = keycloak_realm.kanzo.id
  client_scope_id = data.keycloak_openid_client_scope.roles.id
  name            = "realm roles"
  protocol        = "openid-connect"
  protocol_mapper = "oidc-usermodel-realm-role-mapper"

  config = {
    "claim.name"                = "realm_access.roles"
    "jsonType.label"            = "String"
    "multivalued"               = "true"
    "user.attribute"            = "foo" # Keycloak's own placeholder; the mapper ignores it
    "id.token.claim"            = "true"
    "access.token.claim"        = "true"
    "introspection.token.claim" = "true"
    # Keycloak writes this back itself on a role mapper. Omitting it is a
    # permanent plan diff rather than an error, which is worse.
    "userinfo.token.claim" = "true"
  }
}

data "keycloak_generic_protocol_mapper" "client_roles" {
  realm_id        = keycloak_realm.kanzo.id
  client_scope_id = data.keycloak_openid_client_scope.roles.id
  name            = "client roles"
}

import {
  to = keycloak_generic_protocol_mapper.client_roles
  id = "${var.realm}/client-scope/${data.keycloak_openid_client_scope.roles.id}/${data.keycloak_generic_protocol_mapper.client_roles.id}"
}

resource "keycloak_generic_protocol_mapper" "client_roles" {
  realm_id        = keycloak_realm.kanzo.id
  client_scope_id = data.keycloak_openid_client_scope.roles.id
  name            = "client roles"
  protocol        = "openid-connect"
  protocol_mapper = "oidc-usermodel-client-role-mapper"

  config = {
    "claim.name"                = "resource_access.$${client_id}.roles"
    "jsonType.label"            = "String"
    "multivalued"               = "true"
    "user.attribute"            = "foo"
    "id.token.claim"            = "true"
    "access.token.claim"        = "true"
    "introspection.token.claim" = "true"
    "userinfo.token.claim"      = "true"
  }
}
