resource "random_password" "db" {
  length  = 32
  special = false
}

resource "docker_secret" "db_password" {
  name = "${var.name}-db-password"
  data = base64encode(random_password.db.result)
}

# The service's own gateway.yaml with the deployment's models in place of the development ones,
# and the token budget when one is set. Its key is the organization the request is charged to,
# which gateway.yaml already says once, for the request log.
locals {
  base = yamldecode(file("${path.module}/../../gateway.yaml"))

  budget = var.tokens_per_hour == null ? {} : {
    localRateLimit = [{
      type          = "tokens"
      maxTokens     = var.tokens_per_hour
      tokensPerFill = var.tokens_per_hour
      fillInterval  = "1h"
      key           = local.base.config.standardAttributes.group
    }]
  }

  config = yamlencode(merge(local.base, {
    llm = merge(local.base.llm, {
      policies = merge(local.base.llm.policies, local.budget)
      models   = yamldecode(var.profile).models
    })
  }))
}

# Named by the config's hash, so a changed profile or budget is a new config and rolls the gateway.
resource "docker_config" "gateway" {
  name = "${var.name}-gateway-${substr(sha256(local.config), 0, 12)}"
  data = base64encode(local.config)
  lifecycle {
    create_before_destroy = true
  }
}

resource "docker_volume" "postgres" {
  name = "${var.name}-postgres"
}

resource "docker_service" "postgres" {
  name = "${var.name}-postgres"

  task_spec {
    container_spec {
      image = var.postgres_image
      env = {
        POSTGRES_DB            = "gateway"
        POSTGRES_USER          = "gateway"
        POSTGRES_PASSWORD_FILE = "/run/secrets/db-password"
      }
      secrets {
        secret_id   = docker_secret.db_password.id
        secret_name = docker_secret.db_password.name
        file_name   = "/run/secrets/db-password"
      }
      mounts {
        type   = "volume"
        source = docker_volume.postgres.name
        target = "/var/lib/postgresql/data"
      }
      healthcheck {
        test         = ["CMD-SHELL", "pg_isready -U gateway -d gateway"]
        interval     = "10s"
        timeout      = "5s"
        retries      = 5
        start_period = "30s"
      }
    }
    restart_policy {
      condition = "any"
    }
    placement {
      max_replicas = 1
    }
    networks_advanced {
      name = var.network
    }
  }

  mode {
    replicated {
      replicas = 1
    }
  }

  update_config {
    order = "stop-first"
  }
}

# The database URL and the upstream keys are env, expanded into gateway.yaml and the profile when
# the gateway loads them; their values live in state, as Keycloak's admin password does. The
# gateway exits while the realm's keys cannot be fetched, and Swarm starts it again.
resource "docker_service" "gateway" {
  name = "${var.name}-gateway"

  task_spec {
    container_spec {
      image = var.image
      args  = ["-f", "/config/gateway.yaml"]
      env = merge(var.upstream_keys, {
        AI_DATABASE_URL = "postgresql://gateway:${random_password.db.result}@${var.name}-postgres:5432/gateway"
        AI_ISSUER       = var.issuer
        AI_JWKS_URL     = coalesce(var.jwks_url, "${var.issuer}/protocol/openid-connect/certs")
        AI_AUDIENCE     = var.audience
      })
      configs {
        config_id   = docker_config.gateway.id
        config_name = docker_config.gateway.name
        file_name   = "/config/gateway.yaml"
      }
    }
    restart_policy {
      condition = "any"
      delay     = "5s"
    }
    networks_advanced {
      name    = var.network
      aliases = [var.alias]
    }
  }

  # One replica: the token budget is counted in the gateway's memory, so a second replica would be
  # a second budget.
  mode {
    replicated {
      replicas = 1
    }
  }

  update_config {
    order          = "start-first"
    failure_action = "rollback"
    monitor        = "30s"
  }
}
