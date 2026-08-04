---
"@kanzo-tech/ui": minor
---

**`SidebarNav` takes a `className`, so a secondary group can sit at the foot of the rail.**

A "Support" group had to render directly under "Platform" no matter how much room was left below it, because the component swallowed every class. shadcn's own answer to this is `NavSecondary` — which is nothing but `<SidebarGroup className="mt-auto">` with the class coming from the call site — so the missing piece was the passthrough, not a second component.

It lands on the `<nav>` (now a flex column) rather than the inner group, which is what makes `mt-auto` reach the right box. `docs/showcases/app-shell` and `docs/showcases/job-studio` both use it.
