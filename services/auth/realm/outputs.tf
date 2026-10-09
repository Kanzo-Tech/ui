output "issuer" {
  description = "The OIDC issuer every application configures."
  value       = "${var.issuer_base_url}/realms/${keycloak_realm.kanzo.realm}"
}

output "realm_id" {
  description = "What an application passes to modules/app as `realm_id`."
  value       = keycloak_realm.kanzo.id
}

output "organizations" {
  description = "alias => Keycloak's internal id, as it appears in the organization claim."
  value       = { for k, v in keycloak_organization.org : k => v.id }
}

output "apis" {
  description = "The platform's resource servers: client_id => the scope an application lists in `apis`."
  value       = { for k, m in module.api : k => m.scope }
}

output "applications" {
  description = "The declared applications' client ids."
  value       = keys(module.application)
}
