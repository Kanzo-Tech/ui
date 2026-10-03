output "url" {
  description = "Where applications on the network reach the gateway."
  value       = "http://${var.alias}:4000"
}

output "master_key" {
  description = "The management key modules/team needs. Never an application's."
  value       = random_password.master.result
  sensitive   = true
}
