#!/usr/bin/env bash
# Prove the claim contract: run a real authorization-code + PKCE login through the
# `kanzo-conformance` client, exchange the session's token for one its API accepts
# (RFC 8693, one organization), and check what each ACCESS token says — the
# exchanged one is the token a resource server authorizes on.
#
#   scripts/verify.sh            # ana: acme (high, so high+low) and globex (low)
#   scripts/verify.sh bruno      # one organization, low
#   scripts/verify.sh carla      # globex only (high)
#   scripts/verify.sh fede       # a member of acme with no group: no roles there
#   scripts/verify.sh dan        # no organization; a client role held directly
#
# The contract: an application's roles in an organization are
# `organization[alias].resource_access[client_id].roles`, composites expanded; the
# session's token names no API, and an exchanged one names one API and one organization.
#
# Needs: bash, curl, jq, openssl.
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
TOKEN_EP=$(jq -r .token_endpoint <<<"$DISCO")
jq -r '"issuer: \(.issuer)\nscopes: \(.scopes_supported | join(" "))"' <<<"$DISCO"

echo
TOKENS=$(CLIENT=$CLIENT SECRET=$SECRET KC_URL=$KC_URL KC_REALM=$KC_REALM "$(dirname "$0")/login.sh" "$USERNAME")

ACCESS=$(jq -r .access_token <<<"$TOKENS")
ID=$(jq -r .id_token <<<"$TOKENS")

echo
echo "== ACCESS TOKEN =="
jwt "$ACCESS"

# ── standard token exchange (RFC 8693) ────────────────────────────────────────
# What an application's server does before every call: the session's token for one
# naming the API and the one organization the call is for. Prints the response, a
# token or Keycloak's refusal; an empty ORG asks for no organization.
exchange() {  # exchange ORG
  curl -s -X POST "$TOKEN_EP" \
    --data-urlencode "grant_type=urn:ietf:params:oauth:grant-type:token-exchange" \
    --data-urlencode "client_id=$CLIENT" \
    --data-urlencode "client_secret=$SECRET" \
    --data-urlencode "subject_token=$ACCESS" \
    --data-urlencode "subject_token_type=urn:ietf:params:oauth:token-type:access_token" \
    --data-urlencode "scope=$API${1:+ organization:$1}"
}
exchanged() { jq -r '.access_token // empty' <<<"$(exchange "$1")"; }

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

check "the session's access token names no API" \
  "$(jq -r --arg api "$API" '[.aud] | flatten | all(. != $api)' <<<"$AT")"
check "the ID token does not name the API" \
  "$(jq -r --arg api "$API" '[.aud] | flatten | all(. != $api)' <<<"$IT")"
for_api() {  # for_api ALIAS -> the exchanged token's claims, or {} when the exchange was refused
  local t; t=$(exchanged "$1"); if [ -n "$t" ]; then jwt "$t"; else echo '{}'; fi
}
one_org() {  # one_org ALIAS: an exchange for ALIAS names the API alone and ALIAS alone
  local x; x=$(for_api "$1")
  check "$1: the exchanged token names the API" "$(jq -r --arg api "$API" '[.aud] | flatten | index($api) != null' <<<"$x")"
  check "$1: the exchanged token names $1 and no other organization" \
    "$(jq -r --arg a "$1" '(.organization // {} | keys) == [$a]' <<<"$x")"
  check "$1: the granted scope says organization:$1" \
    "$(jq -r --arg s "organization:$1" '(.scope // "" | split(" ")) | index($s) != null' <<<"$(exchange "$1")")"
}
outsider() {  # outsider ALIAS: an organization the person is not in is dropped, never granted
  local r; r=$(exchange "$1")
  check "$1: not a member, so the granted scope leaves organization:$1 out" \
    "$(jq -r --arg s "organization:$1" '(.scope // "" | split(" ")) | index($s) == null' <<<"$r")"
  check "$1: not a member, so the exchanged token names no organization" \
    "$(jq -r 'has("organization") | not' <<<"$(jwt "$(jq -r .access_token <<<"$r")")")"
}

case "$USERNAME" in
  ana)
    check "acme: high arrives with the low it contains (composite expanded)" \
      "$([ "$(roles_in "$AT" acme)" = '["high","low"]' ] && echo true || echo false)"
    check "globex: low only" \
      "$([ "$(roles_in "$AT" globex)" = '["low"]' ] && echo true || echo false)"
    check "the ID token carries the same roles inside organizations" \
      "$([ "$(roles_in "$IT" acme)" = '["high","low"]' ] && echo true || echo false)"
    check "every organization entry has an id" \
      "$(jq -r '[.organization[] | has("id")] | all' <<<"$AT")"
    one_org acme
    check "acme: the exchanged token keeps the roles held there" \
      "$([ "$(roles_in "$(for_api acme)" acme)" = '["high","low"]' ] && echo true || echo false)"
    one_org globex
    # The application lists the AI gateway among its `apis` (dev/kanzo-conformance.yaml), so a
    # token for it can be had; a scope it does not list cannot.
    check "acme: an exchange for the AI gateway names it" \
      "$(jq -r '[.aud] | flatten | index("ai-gateway") != null' <<<"$(API=ai-gateway for_api acme)")"
    check "an API the application does not list is refused (invalid_scope)" \
      "$(jq -r '.error == "invalid_scope" and (has("access_token") | not)' <<<"$(API=kanzo-unlisted exchange acme)")"
    ;;
  carla)
    check "globex: high arrives with the low it contains" \
      "$([ "$(roles_in "$AT" globex)" = '["high","low"]' ] && echo true || echo false)"
    check "no membership of acme" "$(jq -r '.organization | has("acme") | not' <<<"$AT")"
    one_org globex
    outsider acme
    ;;
  bruno|eva)
    check "acme: low only" "$([ "$(roles_in "$AT" acme)" = '["low"]' ] && echo true || echo false)"
    one_org acme
    ;;
  fede)
    check "acme: a member, with no role" \
      "$(jq -r '.organization | has("acme")' <<<"$AT")"
    check "acme: no role" "$([ "$(roles_in "$AT" acme)" = '[]' ] && echo true || echo false)"
    ;;
  dan)
    check "no organization claim" "$(jq -r 'has("organization") | not' <<<"$AT")"
    check "the client role held directly is top-level resource_access" \
      "$(jq -r --arg c "$CLIENT" '.resource_access[$c].roles // [] | index("low") != null' <<<"$AT")"
    check "and the token exchanged for the API still carries it" \
      "$(jq -r --arg c "$CLIENT" '.resource_access[$c].roles // [] | index("low") != null' <<<"$(for_api "")")"
    ;;
esac

# Informational: whether Keycloak also copies roles mapped onto organization groups
# into the top-level resource_access. An application must not read them there either
# way — a role held in one organization says nothing about another.
echo "  --   top-level resource_access[$CLIENT]: $(jq -c --arg c "$CLIENT" '.resource_access[$c].roles // []' <<<"$AT")"
echo "  --   access token size: ${#ACCESS} bytes"

exit "$fail"
