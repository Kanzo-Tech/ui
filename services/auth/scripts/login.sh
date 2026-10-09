#!/usr/bin/env bash
# Sign in as a development user through a confidential client — a real authorization-code +
# PKCE login, Keycloak's two-step form included — and print the token response (access_token,
# id_token, refresh_token) as JSON. What verify.sh starts from, and ../../ai/scripts/verify.sh.
#
#   scripts/login.sh [user]        # default: ana
#
# Needs: bash, curl, jq, openssl.  Env: KC_URL, KC_REALM, CLIENT, SECRET, PASSWORD, SCOPE.
set -euo pipefail

USERNAME=${1:-ana}
CLIENT=${CLIENT:-kanzo-conformance}
SECRET=${SECRET:-conformance}
REDIRECT=http://localhost:8765/callback
PASSWORD=${PASSWORD:-password}
KC_URL=${KC_URL:-http://localhost:8080}
KC_REALM=${KC_REALM:-kanzo}
SCOPE=${SCOPE:-"openid organization:*"}

ISSUER="$KC_URL/realms/$KC_REALM"
WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT
JAR="$WORK/cookies"

b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }

DISCO=$(curl -sf "$ISSUER/.well-known/openid-configuration")
AUTH_EP=$(jq -r .authorization_endpoint <<<"$DISCO")
TOKEN_EP=$(jq -r .token_endpoint <<<"$DISCO")

# ── authorization code + PKCE ─────────────────────────────────────────────────
VERIFIER=$(openssl rand 32 | b64url)
CHALLENGE=$(printf '%s' "$VERIFIER" | openssl dgst -binary -sha256 | b64url)
STATE=$(openssl rand 12 | b64url)

echo >&2 "== login: $USERNAME via $CLIENT, scope '$SCOPE' =="
LOGIN_PAGE=$(curl -s -c "$JAR" -b "$JAR" -G "$AUTH_EP" \
  --data-urlencode "client_id=$CLIENT" \
  --data-urlencode "redirect_uri=$REDIRECT" \
  --data-urlencode "response_type=code" \
  --data-urlencode "scope=$SCOPE" \
  --data-urlencode "state=$STATE" \
  --data-urlencode "code_challenge=$CHALLENGE" \
  --data-urlencode "code_challenge_method=S256")

# Keycloak 26's login theme is TWO steps — username, then password — so this
# submits the form it is given until a redirect carries a code. Posting both
# fields every time is deliberate: each step ignores the one it did not ask for,
# and the loop then works against a one-step theme too.
CODE=""
page=$LOGIN_PAGE
for _ in 1 2 3; do
  ACTION=$(grep -o 'action="[^"]*"' <<<"$page" | head -1 | sed 's/^action="//; s/"$//; s/&amp;/\&/g')
  if [ -z "$ACTION" ]; then
    echo "no login form at the authorization endpoint — the page said:" >&2
    head -c 800 <<<"$page" >&2; exit 1
  fi
  curl -s -c "$JAR" -b "$JAR" -o "$WORK/page.html" -D "$WORK/head.txt" \
    --data-urlencode "username=$USERNAME" \
    --data-urlencode "password=$PASSWORD" \
    --data-urlencode "credentialId=" \
    "$ACTION"
  LOCATION=$(tr -d '\r' < "$WORK/head.txt" | sed -n 's/^[Ll]ocation: //p')
  if [ -n "$LOCATION" ]; then
    CODE=$(sed -n 's/.*[?&]code=\([^&]*\).*/\1/p' <<<"$LOCATION")
    break
  fi
  page=$(cat "$WORK/page.html")
done

if [ -z "$CODE" ]; then
  if grep -q 'id="organization-' <<<"$page"; then
    echo "the login stopped to ASK WHICH ORGANIZATION. That is what plain 'organization'" >&2
    echo "does for a user who belongs to more than one — it is the documented cause of the" >&2
    echo "'organization claim disappeared' reports. Request 'organization:*' instead." >&2
    echo "  offered: $(grep -oE 'id="organization-[^"]*"' <<<"$page" | sed 's/id="organization-//; s/"//' | tr '\n' ' ')" >&2
    exit 1
  fi
  echo "no authorization code. last redirect: ${LOCATION:-<none>}" >&2
  grep -oE 'id="input-error[^"]*"[^>]*>[^<]*' <<<"$page" >&2 || true
  exit 1
fi
echo >&2 "authorization code received"

TOKENS=$(curl -sf -X POST "$TOKEN_EP" \
  --data-urlencode "grant_type=authorization_code" \
  --data-urlencode "client_id=$CLIENT" \
  --data-urlencode "client_secret=$SECRET" \
  --data-urlencode "code=$CODE" \
  --data-urlencode "redirect_uri=$REDIRECT" \
  --data-urlencode "code_verifier=$VERIFIER")

echo "$TOKENS"
