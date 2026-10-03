output "key" {
  description = "What the tenant's server presents as its bearer to the gateway."
  value       = litellm_key.this.key
  sensitive   = true
}

output "team_id" {
  value = litellm_team.this.team_id
}
