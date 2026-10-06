output "id" {
  description = "The client's internal id, for role mappings."
  value       = keycloak_openid_client.app.id
}

output "client_id" {
  value = keycloak_openid_client.app.client_id
}

output "client_secret" {
  value     = keycloak_openid_client.app.client_secret
  sensitive = true
}

output "roles" {
  description = "Role name => its id, to map onto organization groups."
  value = merge(
    { for k, r in keycloak_role.tier0 : k => r.id },
    { for k, r in keycloak_role.tier1 : k => r.id },
    { for k, r in keycloak_role.tier2 : k => r.id },
  )
}
