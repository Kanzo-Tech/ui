# How an application registers itself with the platform realm, from ITS OWN repository.
# Pin the module to the release the application was built against.

terraform {
  required_providers {
    keycloak = {
      source  = "keycloak/keycloak"
      version = "~> 5.9"
    }
  }
}

variable "realm_id" {
  type    = string
  default = "kanzo"
}

variable "client_secret" {
  type      = string
  sensitive = true
}

module "app" {
  source = "git::https://github.com/Kanzo-Tech/ui.git//services/auth/modules/app?ref=v0.30.0"

  realm_id      = var.realm_id
  client_id     = "board"
  access_type   = "CONFIDENTIAL" # a BFF; PUBLIC for an application with no server
  client_secret = var.client_secret
  redirect_uris = ["https://*.board.example.com/api/auth/callback"]
  audience      = "board-api"

  # Declared once, here. Every token carries the expanded set, so the application asks
  # "is editor present?" and never ranks roles itself.
  roles = {
    reader = {}
    editor = { composites = ["reader"] }
    admin  = { composites = ["editor"] }
  }
}

output "client_secret" {
  value     = module.app.client_secret
  sensitive = true
}
