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
  description = "A confidential client's secret. Null lets Keycloak generate one, read back from the `client_secret` output."
  type        = string
  default     = null
  sensitive   = true
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

variable "backchannel_logout_url" {
  description = <<-EOT
    Where Keycloak posts a logout token when a session ends at the IdP: `kanzoAuth`'s
    `<basePath>/backchannel-logout`. Keycloak calls it server to server, so it is a URL Keycloak can
    reach — an internal hostname inside a cluster — and it is one URL per client: a client shared by
    several deployments can name only one of them. Null leaves back-channel logout off.
  EOT
  type        = string
  default     = null
}

variable "apis" {
  description = <<-EOT
    The APIs the application calls: each one's modules/api `scope`. The application exchanges its
    session's token for one naming a single API and a single organization before each call, so the
    token it signs in with names none of them. Needs a CONFIDENTIAL client: an exchange is a client
    authenticating itself.
  EOT
  type        = list(string)
  default     = []

  validation {
    condition     = length(var.apis) == 0 || var.access_type == "CONFIDENTIAL"
    error_message = "A token exchange is made by a CONFIDENTIAL client; a PUBLIC one calls no API through this realm."
  }
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

variable "default_scopes" {
  type    = list(string)
  default = ["acr", "basic", "email", "profile", "roles", "web-origins"]
}

variable "optional_scopes" {
  description = "`organization` is optional on purpose: it is a dynamic scope, asked for as `organization:*` per request."
  type        = list(string)
  default     = ["organization", "offline_access"]
}
