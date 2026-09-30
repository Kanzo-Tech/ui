---
"@kanzo-tech/ui": minor
---

**`FieldGroup` takes `columns`.** `<FieldGroup columns={2}>` lays its fields out in two equal
columns (one to four), and `columns="auto"` fits as many as the width allows. A responsive count is
a class of your own: `columns={1} className="sm:grid-cols-2"`. A field that should span the row
takes `col-span-full`. Omitted, the group stacks as before. Replace a
hand-written `grid grid-cols-2 gap-4` around fields with it.
