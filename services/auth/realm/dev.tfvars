# Local development. Read by the `realm` service in compose.yml.
# `kc_url` is the compose service address; a browser reaches Keycloak at
# http://localhost:8080, and that is what the issuer says.

kc_url          = "http://keycloak:8080"
issuer_base_url = "http://localhost:8080"
conformance     = true

apis = {
  ai-gateway = "services/ai: the platform's AI gateway."
}

organizations = {
  acme = {
    name   = "Acme Corporation"
    domain = "acme.test"
  }
  globex = {
    name   = "Globex Corporation"
    domain = "globex.test"
  }
}
