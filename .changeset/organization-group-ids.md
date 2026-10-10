---
"@kanzo-tech/auth": minor
---

**Each organization on a session now says which of its groups the person is in, by id.**

`Organization.groups` holds the ids of the person's groups in that organization, read from
`organization.<alias>.groups`. It is for an application that grants to a group ("Research may use
this") and stores the grant by the group's id. Group paths, which Keycloak writes under the same key
when the mapper is not configured, are never read, so that case reads as no groups.

`Organization.groupsOverage` follows Microsoft Entra ID's overage rule. When it is `true`, the
person is in more groups there than the token carries, `groups` is empty and means nothing, and the
application reads the membership from the realm. `organizationGroups(config)` on
`@kanzo-tech/auth/server` sketches that lookup: it asks the admin API, walks the ancestors and
caches the answer. It needs a service account holding `view-organizations` and `view-users`.

The identity service (`services/auth`) is what writes them. It now includes a Keycloak protocol
mapper (`services/auth/mappers`), which the new one-shot `auth-mappers` service builds with Maven and
mounts into Keycloak's providers directory. No custom image is involved. An application opts in from
its declaration:

```yaml
x-application:
  client_id: board
  groups: {}            # or { inherited: false, overage: 50 }
```

By default, a member of a subgroup also carries its ancestors' ids. Past 100 ids, an organization's
entry carries `groups_overage: true` and no ids.

**What to change:** `groupsOverage` and `groups` are required on `Organization`, so a test double or
fixture that builds one adds `groups: [], groupsOverage: false`. The first `up` after upgrading
downloads Maven's dependencies into the `kanzo-auth-m2` volume. Later runs reuse that volume.

The size budget for `@kanzo-tech/auth/server` was raised deliberately, from 5.5 to 5.75 kB, to make
room for `organizationGroups`. Measured size went from 5.25 to 5.68 kB.
