#!/bin/sh
# Map an application's client role onto an organization's group: what an organization
# admin does in the console, as a command — for bootstrapping an organization's first
# admins and for development seeds.
#
#   scripts/map-group-role.sh ALIAS GROUP CLIENT_ID ROLE
#   scripts/map-group-role.sh acme Admins board admin
#
# The group is created if the organization does not have it. Idempotent.
# Needs: sh, curl, jq.  Env: KC_URL, KC_REALM, KC_ADMIN_USERNAME, KC_ADMIN_PASSWORD.
set -eu

[ $# -eq 4 ] || { echo "usage: $0 ALIAS GROUP CLIENT_ID ROLE" >&2; exit 2; }
ALIAS=$1 GROUP=$2 CLIENT=$3 ROLE=$4

KC_URL=${KC_URL:-http://localhost:8080}
KC_REALM=${KC_REALM:-kanzo}
TOKEN=$(curl -sf -d client_id=admin-cli -d "username=${KC_ADMIN_USERNAME:-admin}" \
  -d "password=${KC_ADMIN_PASSWORD:-admin}" -d grant_type=password \
  "$KC_URL/realms/master/protocol/openid-connect/token" | jq -r .access_token)
API="$KC_URL/admin/realms/$KC_REALM"
kc() { curl -sf -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' "$@"; }

oid=$(kc "$API/organizations?search=$ALIAS" | jq -r --arg a "$ALIAS" '.[] | select(.alias == $a) | .id')
[ -n "$oid" ] || { echo "no organization $ALIAS" >&2; exit 1; }

group_id() {
  kc "$API/organizations/$oid/groups?search=$(printf '%s' "$GROUP" | jq -sRr @uri)&exact=true" |
    jq -r --arg n "$GROUP" '.[] | select(.name == $n) | .id'
}
gid=$(group_id)
if [ -z "$gid" ]; then
  kc -X POST "$API/organizations/$oid/groups" --data "$(jq -n --arg n "$GROUP" '{name: $n}')" >/dev/null
  gid=$(group_id)
fi

cuid=$(kc "$API/clients?clientId=$CLIENT" | jq -r '.[0].id // empty')
[ -n "$cuid" ] || { echo "no client $CLIENT" >&2; exit 1; }
rep=$(kc "$API/clients/$cuid/roles/$ROLE")

# Under the organization: the realm's /groups/{id}/role-mappings answers 400 for an
# organization group.
kc -X POST "$API/organizations/$oid/groups/$gid/role-mappings/clients/$cuid" --data "[$rep]" >/dev/null
echo "$ALIAS/$GROUP -> $CLIENT:$ROLE"
