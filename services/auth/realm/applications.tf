# Every declared application (declarations.tf): its own API when it has one, and its client.
#
#   client_id            the client; it keys `resource_access.<client_id>` in every token
#   description          optional
#   api                  optional: the application's own API, registered with modules/api
#   apis                 optional: the platform's APIs it also calls (this realm's `apis`)
#   origin + callback    one redirect URI per organization: `{organization}` in the origin is
#                        replaced by each alias, e.g. `https://{organization}.board.example.com`
#   redirect_uris        instead of origin + callback, when the application has fixed ones
#   backchannel_logout   optional: where Keycloak posts a logout token, as Keycloak reaches it
#   client_secret_file   where the client's secret is mounted; it is sent to Keycloak write-only,
#                        and never kept in state
#   roles                name => { description, composites }
module "application_api" {
  source   = "../modules/api"
  for_each = { for id, app in local.applications : id => app.api if can(app.api) }

  realm_id    = keycloak_realm.kanzo.id
  client_id   = each.value
  description = "${each.key}'s API."
}

module "application" {
  source   = "../modules/app"
  for_each = local.applications

  realm_id      = keycloak_realm.kanzo.id
  client_id     = each.key
  description   = try(each.value.description, "")
  access_type   = "CONFIDENTIAL"
  client_secret = trimspace(file(each.value.client_secret_file))
  redirect_uris = can(each.value.redirect_uris) ? each.value.redirect_uris : [
    for alias in keys(local.organizations) : "${replace(each.value.origin, "{organization}", alias)}${each.value.callback}"
  ]
  backchannel_logout_url = try(each.value.backchannel_logout, null)
  apis = concat(
    can(each.value.api) ? [module.application_api[each.key].scope] : [],
    [for api in try(each.value.apis, []) : module.api[api].scope],
  )
  roles = try(each.value.roles, {})
}

# A realm applied by a release before v0.35.0 holds the conformance client under the addresses it had
# when it was a variable rather than a declaration: moved, so such a realm carries on instead of
# re-creating clients Keycloak already has. Where nothing was there (a new realm, a deployment
# without dev/), they move nothing.
moved {
  from = module.conformance[0]
  to   = module.application["kanzo-conformance"]
}

moved {
  from = module.conformance_api[0]
  to   = module.application_api["kanzo-conformance"]
}
