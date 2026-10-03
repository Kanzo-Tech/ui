terraform {
  required_version = ">= 1.6.0"
  required_providers {
    litellm = {
      source  = "ncecere/litellm"
      version = "~> 2.1"
    }
  }
}
