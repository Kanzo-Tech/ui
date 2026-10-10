#!/bin/sh
# Seed LOCAL DEVELOPMENT members into the kanzo realm.
#
# Why this is a script and not Terraform: in Keycloak's model, membership is a
# runtime concern — invitation links, IdP brokering, automatic enrolment by email
# domain — and the official provider has no membership resource (issue 1554, open
# and unstarted since April 2026). That gap is not worth fighting, because nothing
# declarative was ever going to be right here: production invites.
#
# Everything DURABLE — the realm, the organizations, application clients and their
# roles — is Terraform's, and this script never creates any of it. It creates each
# organization's groups, maps client roles onto them, creates users, and puts them
# in organizations and groups. Idempotent.
#
# Needs: sh, curl, jq.  Env: KC_URL, KC_ADMIN_USERNAME, KC_ADMIN_PASSWORD, KC_REALM.
set -eu

KC_URL=${KC_URL:-http://keycloak:8080}
KC_REALM=${KC_REALM:-kanzo}
KC_ADMIN_USERNAME=${KC_ADMIN_USERNAME:-admin}
KC_ADMIN_PASSWORD=${KC_ADMIN_PASSWORD:-admin}
SEED_FILE=${SEED_FILE:-$(dirname "$0")/seed.json}
# An application maps its own roles onto these groups by handing the seed a file of the same shape
# in SEED_DIR (a compose `configs` entry): `{"organizations": {"acme": {"groups": {"Admins":
# {"board": ["admin"]}}}}}`. They are merged into SEED_FILE, deeply, before anything runs.
SEED_DIR=${SEED_DIR:-/seed.d}
if ls "$SEED_DIR"/*.json >/dev/null 2>&1; then
  jq -s 'reduce .[] as $part ({}; . * $part)' "$SEED_FILE" "$SEED_DIR"/*.json > /tmp/seed.json
  SEED_FILE=/tmp/seed.json
fi

TOKEN=$(curl -sf -d client_id=admin-cli -d "username=$KC_ADMIN_USERNAME" \
  -d "password=$KC_ADMIN_PASSWORD" -d grant_type=password \
  "$KC_URL/realms/master/protocol/openid-connect/token" | jq -r .access_token)
[ -n "$TOKEN" ] && [ "$TOKEN" != "null" ] || { echo "seed: cannot authenticate to $KC_URL" >&2; exit 1; }

API="$KC_URL/admin/realms/$KC_REALM"

# kc METHOD PATH [BODY] -> response body on stdout
kc() {
  _m=$1; _p=$2; shift 2
  if [ $# -gt 0 ]; then
    curl -s -X "$_m" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
      --data-binary "$1" "$API$_p"
  else
    curl -s -X "$_m" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' "$API$_p"
  fi
}

# kc_code METHOD PATH [BODY] -> HTTP status on stdout
kc_code() {
  _m=$1; _p=$2; shift 2
  if [ $# -gt 0 ]; then
    curl -s -o /dev/null -w '%{http_code}' -X "$_m" -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' --data-binary "$1" "$API$_p"
  else
    curl -s -o /dev/null -w '%{http_code}' -X "$_m" -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' "$API$_p"
  fi
}

PASSWORD=$(jq -r '.password' "$SEED_FILE")

org_id() {
  kc GET "/organizations?search=$1" | jq -r --arg a "$1" '.[] | select(.alias == $a) | .id'
}

# The id of the group PATH in organization OID, or empty. A path is a top-level group's name, or
# "Parent/Child" for a subgroup one level down.
org_group_id() {
  case "$2" in
    */*)
      _parent=$(org_group_id "$1" "${2%%/*}")
      [ -n "$_parent" ] || return 0
      kc GET "/organizations/$1/groups/$_parent/children?max=1000" |
        jq -r --arg n "${2#*/}" '.[] | select(.name == $n) | .id'
      ;;
    *)
      kc GET "/organizations/$1/groups?search=$(printf '%s' "$2" | jq -sRr @uri)&exact=true" |
        jq -r --arg n "$2" '.[] | select(.name == $n) | .id'
      ;;
  esac
}

# Create the group PATH in organization OID: a top-level group, or a subgroup of its parent, which
# the seed lists first. Prints the HTTP status.
create_org_group() {
  case "$2" in
    */*)
      _parent=$(org_group_id "$1" "${2%%/*}")
      kc_code POST "/organizations/$1/groups/$_parent/children" "$(jq -n --arg n "${2#*/}" '{name: $n}')"
      ;;
    *) kc_code POST "/organizations/$1/groups" "$(jq -n --arg n "$2" '{name: $n}')" ;;
  esac
}

client_uuid() {
  kc GET "/clients?clientId=$1" | jq -r '.[0].id // empty'
}

# ── organization groups, and the roles mapped onto them ───────────────────────
jq -r '.organizations | keys[]' "$SEED_FILE" | while read -r alias; do
  oid=$(org_id "$alias")
  [ -n "$oid" ] || { echo "seed: no organization '$alias' — is terraform applied?" >&2; exit 1; }

  jq -c --arg a "$alias" '.organizations[$a].groups | to_entries[]' "$SEED_FILE" | while IFS= read -r entry; do
    group=$(printf '%s' "$entry" | jq -r .key)
    gid=$(org_group_id "$oid" "$group")
    if [ -z "$gid" ]; then
      code=$(create_org_group "$oid" "$group")
      case "$code" in
        201|204) ;;
        *) echo "seed: group $alias/$group FAILED ($code)" >&2; exit 1 ;;
      esac
      gid=$(org_group_id "$oid" "$group")
      echo "seed: created group $alias/$group"
    fi
    [ -n "$gid" ] || { echo "seed: group $alias/$group not found after creating it" >&2; exit 1; }

    printf '%s' "$entry" | jq -r '.value | to_entries[] | "\(.key) \(.value | join(" "))"' |
    while read -r client roles; do
      cuid=$(client_uuid "$client")
      [ -n "$cuid" ] || { echo "seed: no client $client — is it registered?" >&2; exit 1; }
      for role in $roles; do
        rep=$(kc GET "/clients/$cuid/roles/$role")
        # An organization group's role mappings live under the organization:
        # the realm's /groups/{id}/role-mappings answers 400 for one. Keycloak
        # copies them into the organization's entry of the claim
        # (`addGroupRoleMappings`).
        code=$(kc_code POST "/organizations/$oid/groups/$gid/role-mappings/clients/$cuid" "[$rep]")
        case "$code" in
          204|201) echo "seed:   $alias/$group -> $client:$role" ;;
          *) echo "seed:   $alias/$group -> $client:$role FAILED ($code)" >&2; exit 1 ;;
        esac
      done
    done
  done
done

# ── users ─────────────────────────────────────────────────────────────────────
jq -c '.users[]' "$SEED_FILE" | while IFS= read -r row; do
  username=$(printf '%s' "$row" | jq -r .username)

  # requiredActions is emptied explicitly: a realm's default required actions
  # (VERIFY_PROFILE) otherwise leave a seeded account unable to log in at all,
  # and the only symptom is "Account is not fully set up" at the token endpoint.
  profile=$(printf '%s' "$row" | jq '{username, email, firstName, lastName,
                                      enabled: true, emailVerified: true, requiredActions: []}')
  uid=$(kc GET "/users?username=$username&exact=true" | jq -r '.[0].id // empty')
  if [ -z "$uid" ]; then
    kc_code POST "/users" "$profile" >/dev/null
    uid=$(kc GET "/users?username=$username&exact=true" | jq -r '.[0].id // empty')
    echo "seed: created user $username"
  else
    kc_code PUT "/users/$uid" "$profile" >/dev/null
    echo "seed: updated user $username"
  fi
  [ -n "$uid" ] || { echo "seed: FAILED to create $username" >&2; exit 1; }

  kc_code PUT "/users/$uid/reset-password" \
    "$(jq -n --arg p "$PASSWORD" '{type:"password", value:$p, temporary:false}')" >/dev/null

  printf '%s' "$row" | jq -c '(.organizations // {}) | to_entries[]' | while IFS= read -r membership; do
    alias=$(printf '%s' "$membership" | jq -r .key)
    oid=$(org_id "$alias")
    [ -n "$oid" ] || { echo "seed: no organization '$alias'" >&2; exit 1; }

    # The members endpoint takes the RAW user id as the body, with a JSON content
    # type. text/plain gets a 415.
    code=$(kc_code POST "/organizations/$oid/members" "$uid")
    case "$code" in
      201) echo "seed:   $username -> organization $alias" ;;
      409) : ;; # already a member
      *)   echo "seed:   $username -> organization $alias FAILED ($code)" >&2; exit 1 ;;
    esac

    printf '%s' "$membership" | jq -r '.value[]' | while IFS= read -r group; do
      gid=$(org_group_id "$oid" "$group")
      [ -n "$gid" ] || { echo "seed: no group $alias/$group" >&2; exit 1; }
      # Organization group membership has its own endpoint. Neither
      # PUT /users/{id}/groups/{gid} (400) nor
      # PUT /organizations/{o}/members/{u}/groups/{g} (405) is it.
      code=$(kc_code PUT "/organizations/$oid/groups/$gid/members/$uid")
      case "$code" in
        204|201) echo "seed:   $username -> $alias/$group" ;;
        409) : ;; # already in the group
        *) echo "seed:   $username -> $alias/$group FAILED ($code)" >&2; exit 1 ;;
      esac
    done
  done

  # ── client roles held directly: the single-tenant shape ─────────────────────
  printf '%s' "$row" | jq -r '(.clientRoles // {}) | to_entries[] | "\(.key) \(.value | join(" "))"' |
  while read -r client roles; do
    cuid=$(client_uuid "$client")
    [ -n "$cuid" ] || { echo "seed: no client $client" >&2; exit 1; }
    for role in $roles; do
      rep=$(kc GET "/clients/$cuid/roles/$role")
      code=$(kc_code POST "/users/$uid/role-mappings/clients/$cuid" "[$rep]")
      case "$code" in
        204|201) echo "seed:   $username -> $client:$role" ;;
        *) echo "seed:   $username -> $client:$role FAILED ($code)" >&2; exit 1 ;;
      esac
    done
  done
done

echo "seed: done"
