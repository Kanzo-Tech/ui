---
"@kanzo-tech/ui": patch
---

**A `Dialog` with `bottomStickOnMobile` fades behind a nested dialog on small screens**, as it
already did on large ones. It read a layer count Ark never sets.
