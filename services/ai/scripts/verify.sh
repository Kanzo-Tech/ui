#!/usr/bin/env bash
# Prove the gateway end to end: sign in as a development user (../auth/scripts/login.sh), exchange
# the session's token for one naming the gateway and one organization (RFC 8693) — what an
# application's server does — and ask each alias for a few tokens. Then the refusals: a token for
# every organization, and a provider's model asked for by name.
#
#   scripts/verify.sh            # ana, acme
#   ORG=globex scripts/verify.sh
#
# Needs: bash, curl, jq, openssl, and the stack of ../compose.yaml up.
set -euo pipefail

USERNAME=${1:-ana}
ORG=${ORG:-acme}
CLIENT=kanzo-conformance
SECRET=${SECRET:-conformance}
KC_URL=${KC_URL:-http://localhost:8080}
KC_REALM=${KC_REALM:-kanzo}
AI_URL=${AI_URL:-http://localhost:4000}

TOKEN_EP="$KC_URL/realms/$KC_REALM/protocol/openid-connect/token"
SESSION=$(KC_URL=$KC_URL KC_REALM=$KC_REALM "$(dirname "$0")/../../auth/scripts/login.sh" "$USERNAME" | jq -r .access_token)
exchange() {  # exchange SCOPE -> an access token for the gateway
  curl -sf -X POST "$TOKEN_EP" \
    --data-urlencode "grant_type=urn:ietf:params:oauth:grant-type:token-exchange" \
    --data-urlencode "client_id=$CLIENT" \
    --data-urlencode "client_secret=$SECRET" \
    --data-urlencode "subject_token=$SESSION" \
    --data-urlencode "subject_token_type=urn:ietf:params:oauth:token-type:access_token" \
    --data-urlencode "scope=ai-gateway $1" | jq -r .access_token
}
ask() {  # ask TOKEN MODEL -> "<status> <body>"
  curl -s -m 180 -o /tmp/kanzo-ai-verify.$$ -w '%{http_code}' "$AI_URL/v1/chat/completions" \
    -H "Authorization: Bearer $1" -H 'Content-Type: application/json' \
    -d "{\"model\":\"$2\",\"max_tokens\":8,\"messages\":[{\"role\":\"user\",\"content\":\"Say hi.\"}]}"
  printf ' %s' "$(head -c 300 /tmp/kanzo-ai-verify.$$)"; rm -f /tmp/kanzo-ai-verify.$$
}

TOKEN=$(exchange "organization:$ORG")
fail=0
check() { if [ "$2" = true ]; then echo "  ok   $1"; else echo "  FAIL $1"; fail=1; fi; }

echo "== $USERNAME, $ORG =="
for alias in chat complete; do
  r=$(ask "$TOKEN" "$alias")
  check "$alias answers (${r%% *})" "$([ "${r%% *}" = 200 ] && echo true || echo false)"
  [ "${r%% *}" = 200 ] || echo "       ${r#* }"
done
r=$(ask "$(exchange "organization:*")" chat)
check "a token for every organization is refused (${r%% *})" "$([ "${r%% *}" = 403 ] && echo true || echo false)"
r=$(ask "$TOKEN" "anthropic/claude-haiku-4-5")
check "a provider's model by name is not reachable (${r%% *})" "$([ "${r%% *}" = 404 ] && echo true || echo false)"
exit $fail
