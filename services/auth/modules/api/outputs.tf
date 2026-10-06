output "client_id" {
  description = "The audience the API validates."
  value       = keycloak_openid_client.api.client_id
}

output "scope" {
  description = "What an application lists in modules/app `apis` to exchange its token for one this API accepts."
  value       = keycloak_openid_client_scope.api.name
}
