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

# ── Organizations ─────────────────────────────────────────────────────────────
variable "organizations" {
  description = "alias => {name, domain}. Keycloak is the only registry of organizations; there is no tenant table anywhere else."
  type = map(object({
    name   = string
    domain = string
  }))
}

# ── Conformance ───────────────────────────────────────────────────────────────
variable "conformance" {
  description = "Register `kanzo-conformance`, the client scripts/verify.sh proves the claim contract through. Development and CI only."
  type        = bool
  default     = false
}
