variable "realm_id" {
  description = "The realm the application is a client of: the platform's one realm."
  type        = string
}

variable "client_id" {
  description = "The application's client id. It keys `resource_access.<client_id>` in every token, inside each organization entry too."
  type        = string
}

variable "name" {
  type    = string
  default = null
}

variable "description" {
  type    = string
  default = ""
}

variable "access_type" {
  description = "CONFIDENTIAL for an application with a server (a BFF); PUBLIC for one without, which then relies on PKCE alone."
  type        = string

  validation {
    condition     = contains(["CONFIDENTIAL", "PUBLIC"], var.access_type)
    error_message = "access_type is CONFIDENTIAL or PUBLIC."
  }
}

variable "client_secret" {
  description = "A confidential client's secret, which the application's server also holds. Sent to Keycloak write-only: it is never kept in state, and changing it rotates it."
  type        = string
  default     = null
  sensitive   = true

  validation {
    condition     = (var.access_type == "CONFIDENTIAL") == (var.client_secret != null)
    error_message = "A CONFIDENTIAL client takes a client_secret; a PUBLIC one does not."
  }
}

variable "redirect_uris" {
  type = list(string)
}

variable "post_logout_redirect_uris" {
  type    = list(string)
  default = ["+"]
}

variable "web_origins" {
  type    = list(string)
  default = ["+"]
}

variable "apis" {
  description = <<-EOT
    The APIs the application calls: each one's modules/api `scope`, an optional scope of the
    client. The sign-in asks for it beside `organization:*` (the edge's OAUTH2_PROXY_SCOPE), so the
    access token names the API in `aud` and is forwarded to it as it came. A scope not listed here
    is refused at the authorization endpoint with `invalid_scope`.
  EOT
  type        = list(string)
  default     = []
}

variable "roles" {
  description = <<-EOT
    The application's roles: name => { description, composites }. A composite names the roles it
    contains, and Keycloak expands it into every token, so `admin = { composites = ["editor"] }`
    makes an admin's token say admin and editor. A hierarchy is declared here, once, and the
    application only ever asks whether a role is present. Composites nest at most three deep.
  EOT
  type = map(object({
    description = optional(string, "")
    composites  = optional(list(string), [])
  }))
  default = {}

  validation {
    condition = alltrue(flatten([
      for name, role in var.roles : [for c in role.composites : contains(keys(var.roles), c) && c != name]
    ]))
    error_message = "A composite names another role of this application."
  }
}

variable "groups" {
  description = <<-EOT
    Whether the application's tokens carry the ids of the person's groups in each organization,
    `organization.<alias>.groups`, for an application that grants to a group. Null: no ids. An
    object turns them on: `inherited` (default true) adds each group's ancestors, so a member of
    Research/ML carries Research's id too; above `overage` ids (default 100) an organization's entry
    carries `groups_overage: true` and none, and the application reads membership from the admin
    API. Needs the platform's mapper jar in Keycloak (../../mappers).
  EOT
  type = object({
    inherited = optional(bool, true)
    overage   = optional(number, 100)
  })
  default = null

  validation {
    condition     = var.groups == null || try(var.groups.overage >= 0 && floor(var.groups.overage) == var.groups.overage, false)
    error_message = "groups.overage is a whole number, zero or more."
  }
}

variable "default_scopes" {
  type    = list(string)
  default = ["acr", "basic", "email", "profile", "roles", "web-origins"]
}

variable "optional_scopes" {
  description = <<-EOT
    `organization` is optional on purpose: it is a dynamic scope, asked for as `organization:*` per
    request. `offline_access` is not among the defaults: the BFF never asks for it, a refresh token
    that outlives the browser session is the thing the platform's session clocks exist to prevent,
    and `kanzoAuth` refuses to let a sign-in inject it. An application that needs one lists it here.
  EOT
  type        = list(string)
  default     = ["organization"]
}
