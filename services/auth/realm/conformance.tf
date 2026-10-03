# The client the contract is proved through — no product's. Two roles, one containing the other,
# are the smallest set that shows composites arriving expanded inside an organization entry
# (scripts/verify.sh). A public client: the script logs in the way a browser does.
module "conformance" {
  source = "../modules/app"
  count  = var.conformance ? 1 : 0

  realm_id      = keycloak_realm.kanzo.id
  client_id     = "kanzo-conformance"
  description   = "Proves the claim contract. Development and CI only."
  access_type   = "PUBLIC"
  redirect_uris = ["http://localhost:8765/callback"]
  audience      = "kanzo-conformance-api"

  roles = {
    low  = { description = "Contained by high." }
    high = { description = "Contains low.", composites = ["low"] }
  }
}
