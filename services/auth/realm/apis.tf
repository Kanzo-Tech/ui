# The platform's own resource servers — `ai-gateway` is services/ai — registered here because they
# ship with the realm rather than with any application. An application lists one in its
# modules/app `apis` by name.
module "api" {
  source   = "../modules/api"
  for_each = var.apis

  realm_id    = keycloak_realm.kanzo.id
  client_id   = each.key
  description = each.value
}
