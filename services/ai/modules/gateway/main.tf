resource "random_password" "master" {
  length  = 48
  special = false
}

resource "random_password" "db" {
  length  = 32
  special = false
}

resource "docker_secret" "db_password" {
  name = "${var.name}-db-password"
  data = base64encode(random_password.db.result)
}

# Named by the profile's hash, so a changed profile is a new config and rolls the gateway.
resource "docker_config" "profile" {
  name = "${var.name}-gateway-${substr(sha256(var.profile), 0, 12)}"
  data = base64encode(var.profile)
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
        POSTGRES_DB            = "litellm"
        POSTGRES_USER          = "litellm"
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
        test         = ["CMD-SHELL", "pg_isready -U litellm -d litellm"]
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

# Exact-match cache for `complete` (opted in per request). Losing it costs
# tokens, nothing else, so no volume.
resource "docker_service" "cache" {
  name = "${var.name}-cache"

  task_spec {
    container_spec {
      image = var.valkey_image
    }
    restart_policy {
      condition = "any"
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
}

# LiteLLM reads no `_FILE` variants, so the master key, the DB URL and the upstream
# keys are env — their values live in state, as Keycloak's admin password does.
resource "docker_service" "gateway" {
  name = "${var.name}-gateway"

  task_spec {
    container_spec {
      image = var.image
      args  = ["--config", "/app/config.yaml", "--port", "4000"]
      env = merge(var.upstream_keys, {
        LITELLM_MASTER_KEY = random_password.master.result
        DATABASE_URL       = "postgresql://litellm:${random_password.db.result}@${var.name}-postgres:5432/litellm"
        REDIS_HOST         = "${var.name}-cache"
        REDIS_PORT         = "6379"
        STORE_MODEL_IN_DB  = "False"
      })
      configs {
        config_id   = docker_config.profile.id
        config_name = docker_config.profile.name
        file_name   = "/app/config.yaml"
      }
      healthcheck {
        test         = ["CMD-SHELL", "python -c \"import urllib.request;urllib.request.urlopen('http://localhost:4000/health/liveliness')\""]
        interval     = "15s"
        timeout      = "5s"
        retries      = 5
        start_period = "60s"
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

  # The admin console (and the management API modules/team drives) on an internal
  # host, reachable only from `admin_allow`. Applications never use this route: they
  # reach `alias`:4000 over the overlay.
  dynamic "labels" {
    for_each = var.admin_hostname == null ? {} : {
      "traefik.enable"                                                           = "true"
      "traefik.docker.network"                                                   = var.network
      "traefik.http.routers.${var.name}-admin.rule"                              = "Host(`${var.admin_hostname}`)"
      "traefik.http.routers.${var.name}-admin.entrypoints"                       = var.admin_entrypoint
      "traefik.http.routers.${var.name}-admin.tls.certresolver"                  = var.admin_certresolver
      "traefik.http.routers.${var.name}-admin.middlewares"                       = "${var.name}-admin-allow"
      "traefik.http.middlewares.${var.name}-admin-allow.ipallowlist.sourcerange" = join(",", var.admin_allow)
      "traefik.http.services.${var.name}-admin.loadbalancer.server.port"         = "4000"
    }
    content {
      label = labels.key
      value = labels.value
    }
  }
}
