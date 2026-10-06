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
  description = "YAML with one key, `models`: agentgateway's `llm.models`, which upstream answers each alias. The deployment's to write; gateway.yaml beside the module carries the development ones."
  type        = string
}

variable "upstream_keys" {
  description = "Env name => key, for every upstream the profile names (e.g. { ANTHROPIC_API_KEY = \"…\" }, read as `$ANTHROPIC_API_KEY`)."
  type        = map(string)
  sensitive   = true
  default     = {}
}

variable "issuer" {
  description = "The realm whose access tokens the gateway accepts, as the tokens say it: `https://<host>/realms/<realm>`."
  type        = string
}

variable "jwks_url" {
  description = "Where the gateway fetches the realm's keys, when it reaches Keycloak by another address than the issuer's. Null: the issuer's own."
  type        = string
  default     = null
}

variable "audience" {
  description = "The audience a token must name to be accepted: the gateway's client in the realm."
  type        = string
  default     = "ai-gateway"
}

variable "tokens_per_hour" {
  description = "Tokens each organization may spend an hour, input and output together. Null: no budget."
  type        = number
  default     = null
}

variable "image" {
  type = string
  # Pinned by digest, and moved deliberately: the gateway holds every provider's key.
  default = "ghcr.io/agentgateway/agentgateway:v1.6.0@sha256:9d3e6044ddcdc0878b1787f77bd401252b95e22684203fb5e874c4c42d2ed90c"
}

variable "postgres_image" {
  type    = string
  default = "postgres:17-alpine"
}
