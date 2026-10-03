---
"@kanzo-tech/auth": minor
---

**Roles inside an organization come from `organization[alias].resource_access[clientId].roles`, and group paths are no longer read.**

- `session.organizations[n].roles` is now what Keycloak writes inside each organization entry: the
  roles an organization's administrator mapped onto the groups the person is in, with composite
  roles expanded. The realm needs the Organization Group Membership mapper on the `organization`
  scope with `addGroupRoleMappings` on, which needs Keycloak 26.7 or later; without it every
  organization reads as a membership holding no roles. `services/auth` in this repository already
  configures it.
- Group names are not read at all, so a group called `/board/editor` grants nothing any more. If
  your realm named groups `/<client>/<role>`, map the client role onto the group instead (the
  console, or `services/auth/scripts/map-group-role.sh ALIAS GROUP CLIENT ROLE`); the group can then
  be called anything.
- `roleFromGroupPath` is removed. Delete any call to it: `organizationOf(session, alias)?.roles`
  is already the roles for your client.
- An organization's roles are still not merged into `session.roles`.
- If you wrote a hierarchy out at the call site (`can(s, "owner", org) || can(s, "member", org)`),
  declare it as composite roles in your client registration instead and ask for the lowest role
  once: the token carries the expanded set.
