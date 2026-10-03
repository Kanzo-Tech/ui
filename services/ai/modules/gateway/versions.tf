# The gateway as Swarm services: LiteLLM, its Postgres and its cache, on a network the
# caller owns. The caller passes the profile — which upstream answers which alias — and
# the upstream keys; this module knows no provider and no application.
#
# Prerequisite the docker provider cannot do itself: `docker swarm init`.
terraform {
  required_version = ">= 1.6.0"
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}
