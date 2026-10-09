# ── Connection ────────────────────────────────────────────────────────────────
# No default. A compose service URL as a default is a hostname that only resolves
# inside compose, and silently points a real apply at nothing.
variable "kc_url" {
  description = "Keycloak base URL as this module reaches it (no trailing slash)."
  type        = string
}

variable "kc_admin_username" {
  type    = string
  default = "admin"
}

variable "kc_admin_password" {
  type      = string
  sensitive = true
}

# ── The realm ─────────────────────────────────────────────────────────────────
variable "realm" {
  description = "Realm name. One realm for the whole platform: applications are OIDC clients of it, not tenants of their own."
  type        = string
  default     = "kanzo"
}

variable "issuer_base_url" {
  description = "Public origin a browser reaches Keycloak at. Only used to document the issuer in outputs."
  type        = string
  default     = "http://localhost:8080"
}

# ── Declarations ──────────────────────────────────────────────────────────────
variable "declarations" {
  description = "The folder the organizations and applications are declared in (declarations.tf): every YAML file below it, at any depth."
  type        = string
  default     = "/declarations"
}

# ── APIs ──────────────────────────────────────────────────────────────────────
variable "apis" {
  description = "client_id => description: the platform's own resource servers, registered with modules/api. An application's own API is declared with the application (`x-application.api`)."
  type        = map(string)
  default = {
    ai-gateway = "services/ai: the platform's AI gateway."
  }
}
