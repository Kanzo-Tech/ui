# The platform realm. This module talks to the Keycloak admin API only, and declares what is
# durable and belongs to no application: the realm, its organizations, and the claim mappers every
# application reads. Applications register themselves with ../modules/app from their own
# repositories; membership is runtime (see organizations.tf).
#
# `addGroupRoleMappings` on the organization group mapper needs Keycloak >= 26.7, organization
# groups need provider >= 5.9, and a client secret sent write-only (modules/app) needs provider
# >= 5.10 and Terraform >= 1.11: floors, not preferences.
terraform {
  required_version = ">= 1.11.0"

  # Where the state lives is the caller's to say: `terraform init -backend-config=path=…`
  # (compose.yaml puts it in a volume beside the database).
  backend "local" {}

  required_providers {
    keycloak = {
      source  = "keycloak/keycloak"
      version = "~> 5.10"
    }
  }
}
