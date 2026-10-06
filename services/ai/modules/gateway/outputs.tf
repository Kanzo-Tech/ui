output "url" {
  description = "Where applications on the network reach the gateway."
  value       = "http://${var.alias}:4000"
}
