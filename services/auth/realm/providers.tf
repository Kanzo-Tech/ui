# Authenticate as the bootstrap admin. A single-operator model: Terraform owns
# everything in this realm, so there is no least-privilege service client to mint
# and then have to bootstrap in turn.
provider "keycloak" {
  client_id = "admin-cli"
  username  = var.kc_admin_username
  password  = var.kc_admin_password
  url       = var.kc_url
}
