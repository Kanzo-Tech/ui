variable "name" {
  description = "Prefix for the services, volume, config and secret."
  type        = string
  default     = "ai"
}

variable "network" {
  description = "The overlay the gateway joins. Applications reach it there as `alias`:4000."
  type        = string
}

variable "alias" {
  description = "The gateway's name on the network."
  type        = string
  default     = "ai-gateway"
}

variable "profile" {
  description = "The LiteLLM config (YAML): which upstream answers each alias. The deployment's to write; the dev profile beside this module shows the shape."
  type        = string
}

variable "upstream_keys" {
  description = "Env name => key, for every upstream the profile names (e.g. { ANTHROPIC_API_KEY = \"…\" })."
  type        = map(string)
  sensitive   = true
  default     = {}
}

variable "image" {
  type = string
  # Pinned by digest: two LiteLLM releases (1.82.7, 1.82.8) shipped compromised. Bump it
  # deliberately, from a release that has been out for a few days.
  default = "ghcr.io/berriai/litellm-database:v1.103.0@sha256:f4f114b1996c5923c4d62a7bbdcecb2ccf9df17bdebce76050f609be97f75f5c"
}

variable "postgres_image" {
  type    = string
  default = "postgres:17-alpine"
}

variable "valkey_image" {
  type    = string
  default = "valkey/valkey:8.1-alpine"
}

variable "admin_hostname" {
  description = "A host for the admin console and the management API, routed by Traefik. Null: no route."
  type        = string
  default     = null
}

variable "admin_allow" {
  description = "CIDRs allowed through to admin_hostname (the operator's, a VPN's)."
  type        = list(string)
  default     = []
}

variable "admin_entrypoint" {
  description = "The Traefik entrypoint the admin route listens on."
  type        = string
  default     = "websecure"
}

variable "admin_certresolver" {
  description = "The Traefik certificate resolver for the admin route."
  type        = string
  default     = "le"
}
