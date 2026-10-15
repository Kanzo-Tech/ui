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


# ── The baseline (realm.tf) ───────────────────────────────────────────────────
# Safe defaults; a deployment's figures are its own, like its hostnames and passwords.
variable "password_policy" {
  description = "Keycloak's password policy string. The development seed's password must satisfy it."
  type        = string
  default     = "length(12) and notUsername and notEmail"
}

variable "max_login_failures" {
  description = "Failed logins before Keycloak starts making a user wait (brute-force detection, temporary lockout)."
  type        = number
  default     = 5
}

variable "lockout_max_wait_seconds" {
  description = "The longest a user is made to wait after repeated failures."
  type        = number
  default     = 900
}

variable "events_retention_seconds" {
  description = "How long login and admin events are kept. Default thirty days."
  type        = number
  default     = 2592000
}
