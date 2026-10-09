# What the deployment declares, read from files rather than tfvars: its organizations and its
# applications. Whoever runs the realm mounts them under `var.declarations`, anywhere below it, so
# each party mounts its own folder and none collides with another:
#
#   x-organization: { alias: acme, name: Acme Corporation, domain: acme.com }
#
# is an organization. It sits on top of the compose file that runs the organization's own services,
# so the list of organizations is written once, in the files that also deploy them.
#
#   x-application: { client_id: board, api: board-api, apis: [ai-gateway], origin: …, roles: … }
#
# is an application registering itself (modules/app, and modules/api for its own API). A compose
# project hands it over as a `configs` entry, interpolated, so its origin can differ per environment.
locals {
  declared = [
    for f in fileset(var.declarations, "**/*.{yaml,yml}") : yamldecode(file("${var.declarations}/${f}"))
  ]

  organizations = merge([
    for d in local.declared : { (d["x-organization"].alias) = d["x-organization"] } if can(d["x-organization"])
  ]...)

  applications = merge([
    for d in local.declared : { (d["x-application"].client_id) = d["x-application"] } if can(d["x-application"])
  ]...)
}
