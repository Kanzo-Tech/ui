# The client the contract is proved through — no product's. Two roles, one containing the other,
# are the smallest set that shows composites arriving expanded inside an organization entry, and
# one API is the smallest set that shows a session's token exchanged for one that names it
# (scripts/verify.sh). Confidential, as every application with a server is: an exchange is a client
# authenticating itself, and the secret is a development one.
module "conformance_api" {
  source = "../modules/api"
  count  = var.conformance ? 1 : 0

  realm_id    = keycloak_realm.kanzo.id
  client_id   = "kanzo-conformance-api"
  description = "The API the contract's tokens are exchanged for. Development and CI only."
}

module "conformance" {
  source = "../modules/app"
  count  = var.conformance ? 1 : 0

  realm_id      = keycloak_realm.kanzo.id
  client_id     = "kanzo-conformance"
  description   = "Proves the claim contract. Development and CI only."
  access_type   = "CONFIDENTIAL"
  client_secret = "conformance"
  redirect_uris = ["http://localhost:8765/callback"]
  apis          = [module.conformance_api[0].scope]

  roles = {
    low  = { description = "Contained by high." }
    high = { description = "Contains low.", composites = ["low"] }
  }
}
