#!/usr/bin/env bash
# Prove the claim contract: run a real authorization-code + PKCE login through the
# `kanzo-conformance` client with the scope the edge asks for — `organization:*` and the
# client's API — and check what the ACCESS token says: it is the token the edge forwards and
# a resource server authorizes on.
#
#   scripts/verify.sh            # ana: acme (high, so high+low) and globex (low)
#   scripts/verify.sh bruno      # one organization, low; in Research/ML, so Research's id too
#   scripts/verify.sh carla      # globex only (high)
#   scripts/verify.sh fede       # a member of acme with no group: no roles there
#   scripts/verify.sh gil        # five of acme's groups: past the overage threshold, so no ids
#   scripts/verify.sh dan        # no organization; a client role held directly
#
# The contract: an application's roles in an organization are
# `organization[alias].resource_access[client_id].roles`, composites expanded; the
# access token names the API the sign-in asked for and every organization the person is in, and
# the ID token names no API. The ids
# of the person's groups in an organization are `organization[alias].groups` (the platform's mapper,
# ../mappers), checked against the admin API's — which is why this also needs the admin's
# credentials — or `groups_overage: true` and none past the client's threshold.
#
# Needs: bash, curl, jq, openssl.  Env: KC_URL, KC_REALM, KC_ADMIN_USERNAME, KC_ADMIN_PASSWORD.
set -euo pipefail

USERNAME=${1:-ana}
CLIENT=kanzo-conformance
SECRET=${SECRET:-conformance}
API=kanzo-conformance-api
KC_URL=${KC_URL:-http://localhost:8080}
KC_REALM=${KC_REALM:-kanzo}

jwt() {  # decode a JWT payload; base64url has no padding, so put it back
  local p; p=$(cut -d. -f2 <<<"$1")
  case $(( ${#p} % 4 )) in 2) p="$p==";; 3) p="$p=";; esac
  tr '_-' '/+' <<<"$p" | openssl base64 -d -A | jq .
}

echo "== discovery =="
DISCO=$(curl -sf "$KC_URL/realms/$KC_REALM/.well-known/openid-configuration")
jq -r '"issuer: \(.issuer)\nscopes: \(.scopes_supported | join(" "))"' <<<"$DISCO"

echo
# The edge's OAUTH2_PROXY_SCOPE (../compose.yaml, auth-proxy).
SCOPE="openid email profile organization:* $API"
TOKENS=$(CLIENT=$CLIENT SECRET=$SECRET KC_URL=$KC_URL KC_REALM=$KC_REALM SCOPE=$SCOPE "$(dirname "$0")/login.sh" "$USERNAME")

ACCESS=$(jq -r .access_token <<<"$TOKENS")
ID=$(jq -r .id_token <<<"$TOKENS")

echo
echo "== ACCESS TOKEN =="
jwt "$ACCESS"

# ── a scope the application does not list ─────────────────────────────────────
# The authorization request alone: Keycloak answers it with a redirect, carrying a code's
# login form or, for a scope that is not the client's, `error=invalid_scope`.
authorize_redirect() {  # authorize_redirect SCOPE -> the Location of the authorization endpoint's answer
  local challenge; challenge=$(openssl rand 32 | openssl base64 -A | tr '+/' '-_' | tr -d '=')
  curl -s -o /dev/null -w '%{redirect_url}' -G "$(jq -r .authorization_endpoint <<<"$DISCO")" \
    --data-urlencode "client_id=$CLIENT" \
    --data-urlencode "redirect_uri=http://localhost:8765/callback" \
    --data-urlencode "response_type=code" \
    --data-urlencode "scope=$1" \
    --data-urlencode "state=verify" \
    --data-urlencode "code_challenge=$challenge" \
    --data-urlencode "code_challenge_method=S256"
}

# ── the assertions ────────────────────────────────────────────────────────────
echo
echo "== checks =="
AT=$(jwt "$ACCESS")
IT=$(jwt "$ID")
fail=0
check() { if [ "$2" = true ]; then echo "  ok   $1"; else echo "  FAIL $1"; fail=1; fi; }
roles_in() {  # roles_in TOKEN ALIAS -> the client's roles inside that organization, sorted
  jq -c --arg a "$2" --arg c "$CLIENT" '[.organization[$a].resource_access[$c].roles // [] | .[]] | sort' <<<"$1"
}

check "the access token names the API the sign-in asked for" \
  "$(jq -r --arg api "$API" '[.aud] | flatten | index($api) != null' <<<"$AT")"
check "the granted scope says the API" \
  "$(jq -r --arg api "$API" '(.scope // "" | split(" ")) | index($api) != null' <<<"$TOKENS")"
check "the ID token does not name the API" \
  "$(jq -r --arg api "$API" '[.aud] | flatten | all(. != $api)' <<<"$IT")"
outsider() {  # outsider ALIAS: an organization the person is not in is never named
  check "$1: not a member, so the token names no $1" \
    "$(jq -r --arg a "$1" '(.organization // {}) | has($a) | not' <<<"$AT")"
}

group_ids_in() {  # group_ids_in TOKEN ALIAS -> the group ids inside that organization, sorted
  jq -c --arg a "$2" '[.organization[$a].groups // [] | .[]] | sort' <<<"$1"
}
ADMIN=$(curl -sf -d client_id=admin-cli -d "username=${KC_ADMIN_USERNAME:-admin}" \
  -d "password=${KC_ADMIN_PASSWORD:-admin}" -d grant_type=password \
  "$KC_URL/realms/master/protocol/openid-connect/token" | jq -r .access_token)
admin() { curl -sf -H "Authorization: Bearer $ADMIN" "$KC_URL/admin/realms/$KC_REALM$1"; }
ids_of() {  # ids_of ALIAS PATH... -> what the admin API says those groups' ids are, sorted
  local alias=$1 path id; shift
  local oid; oid=$(admin "/organizations?search=$alias" | jq -r --arg a "$alias" '.[] | select(.alias == $a) | .id')
  for path in "$@"; do  # "Research" or "Research/ML"
    id=$(admin "/organizations/$oid/groups?max=1000" | jq -r --arg n "${path%%/*}" '.[] | select(.name == $n) | .id')
    if [ "$path" != "${path#*/}" ]; then
      id=$(admin "/organizations/$oid/groups/$id/children?max=1000" | jq -r --arg n "${path#*/}" '.[] | select(.name == $n) | .id')
    fi
    echo "$id"
  done | jq -Rsc 'split("\n") | map(select(. != "")) | sort'
}
groups_are() {  # groups_are TOKEN ALIAS NAME...: the token's ids there are exactly those groups'
  local token=$1 alias=$2; shift 2
  [ "$(group_ids_in "$token" "$alias")" = "$(ids_of "$alias" "$@")" ] && echo true || echo false
}

check "every organization's groups are ids, never paths" \
  "$(jq -r '[.organization // {} | .[] | .groups // [] | .[] | startswith("/") | not] | all' <<<"$AT")"

# The realm's baseline (realm/realm.tf), read back through the admin API rather than assumed: the
# figures are the deployment's, so this checks that each protection is ON, not what it is set to.
REALM_JSON=$(admin "")
EVENTS_JSON=$(admin "/events/config")
check "brute-force detection is on, with a temporary lockout" \
  "$(jq -r '.bruteForceProtected == true and .permanentLockout == false' <<<"$REALM_JSON")"
check "a password policy is set" \
  "$(jq -r '(.passwordPolicy // "") | test("length\\([0-9]+\\)")' <<<"$REALM_JSON")"
check "login events and admin events are on, with a retention" \
  "$(jq -r '.eventsEnabled == true and .adminEventsEnabled == true and (.eventsExpiration // 0) > 0' <<<"$EVENTS_JSON")"
check "$CLIENT does not carry offline_access among its optional scopes" \
  "$(jq -r '(.[0].optionalClientScopes // []) | index("offline_access") == null' <<<"$(admin "/clients?clientId=$CLIENT")")"

case "$USERNAME" in
  ana)
    check "acme: the ids of Admins and Research, and no name" "$(groups_are "$AT" acme Admins Research)"
    check "globex: the ids of Readers and Research" "$(groups_are "$AT" globex Readers Research)"
    check "the two Researches are two ids" \
      "$([ "$(ids_of acme Research)" != "$(ids_of globex Research)" ] && echo true || echo false)"
    check "the ID token carries the same group ids" "$(groups_are "$IT" acme Admins Research)"
    check "acme: high arrives with the low it contains (composite expanded)" \
      "$([ "$(roles_in "$AT" acme)" = '["high","low"]' ] && echo true || echo false)"
    check "globex: low only" \
      "$([ "$(roles_in "$AT" globex)" = '["low"]' ] && echo true || echo false)"
    check "the ID token carries the same roles inside organizations" \
      "$([ "$(roles_in "$IT" acme)" = '["high","low"]' ] && echo true || echo false)"
    check "every organization entry has an id" \
      "$(jq -r '[.organization[] | has("id")] | all' <<<"$AT")"
    check "the token names acme and globex, and no other organization" \
      "$(jq -r '(.organization // {} | keys) == ["acme", "globex"]' <<<"$AT")"
    # A scope the application does not list cannot be had.
    check "an API the application does not list is refused (invalid_scope)" \
      "$(case "$(authorize_redirect "openid organization:* kanzo-unlisted")" in *error=invalid_scope*) echo true;; *) echo false;; esac)"
    ;;
  carla)
    check "globex: high arrives with the low it contains" \
      "$([ "$(roles_in "$AT" globex)" = '["high","low"]' ] && echo true || echo false)"
    check "no membership of acme" "$(jq -r '.organization | has("acme") | not' <<<"$AT")"
    check "globex: the id of Platform" "$(groups_are "$AT" globex Platform)"
    outsider acme
    ;;
  bruno)
    check "acme: low only" "$([ "$(roles_in "$AT" acme)" = '["low"]' ] && echo true || echo false)"
    check "acme: the ids of Data team, Research/ML and Research above it (inherited)" \
      "$(groups_are "$AT" acme "Data team" Research/ML Research)"
    outsider globex
    ;;
  eva)
    check "acme: low only" "$([ "$(roles_in "$AT" acme)" = '["low"]' ] && echo true || echo false)"
    check "acme: the ids of Analysts and Finance" "$(groups_are "$AT" acme Analysts Finance)"
    ;;
  fede)
    check "acme: a member, with no role" \
      "$(jq -r '.organization | has("acme")' <<<"$AT")"
    check "acme: no role" "$([ "$(roles_in "$AT" acme)" = '[]' ] && echo true || echo false)"
    check "acme: no group, so no group id and no overage" \
      "$(jq -r '.organization.acme | (.groups == []) and (has("groups_overage") | not)' <<<"$AT")"
    ;;
  gil)
    check "acme: five groups past a threshold of four, so groups_overage and no ids" \
      "$(jq -r '.organization.acme | (.groups_overage == true) and (has("groups") | not)' <<<"$AT")"
    check "acme: the roles still arrive" \
      "$([ "$(roles_in "$AT" acme)" = '["high","low"]' ] && echo true || echo false)"
    ;;
  dan)
    check "no organization claim" "$(jq -r 'has("organization") | not' <<<"$AT")"
    check "the client role held directly is top-level resource_access" \
      "$(jq -r --arg c "$CLIENT" '.resource_access[$c].roles // [] | index("low") != null' <<<"$AT")"
    ;;
esac

# Informational: whether Keycloak also copies roles mapped onto organization groups
# into the top-level resource_access. An application must not read them there either
# way — a role held in one organization says nothing about another.
echo "  --   top-level resource_access[$CLIENT]: $(jq -c --arg c "$CLIENT" '.resource_access[$c].roles // []' <<<"$AT")"
echo "  --   access token size: ${#ACCESS} bytes"

exit "$fail"
