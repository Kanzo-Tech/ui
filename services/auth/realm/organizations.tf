# ── The tenant model ──────────────────────────────────────────────────────────
#
# An organization is a DATUM, not infrastructure: adding a customer adds two lines
# to a tfvars map, never a client.
#
# WHAT IS NOT HERE, DELIBERATELY:
# - Membership. Keycloak's model makes it runtime — invitation links, IdP brokering,
#   enrolment by email domain — and the provider has no membership resource (open,
#   unstarted, since April 2026). Development seeds it (seed/seed.sh); production
#   invites.
# - Organization groups. Since 26.6 each organization owns an isolated group tree,
#   and what is in it ("Data team", "Analysts") is the organization's own business.
#   An application never learns a group's name: the organization maps the
#   application's roles onto its groups, and the token carries the roles.

resource "keycloak_organization" "org" {
  for_each = var.organizations

  realm   = keycloak_realm.kanzo.id
  name    = each.value.name
  alias   = each.key
  enabled = true

  domain {
    name     = each.value.domain
    verified = false
  }
}
