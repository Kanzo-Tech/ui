output "client_id" {
  description = "The audience the API validates."
  value       = keycloak_openid_client.api.client_id
}

output "scope" {
  description = "What an application lists in modules/app `apis` so its sign-in can ask for a token this API accepts."
  value       = keycloak_openid_client_scope.api.name
}
