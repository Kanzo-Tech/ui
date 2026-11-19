---
"@kanzo-tech/ui": minor
---

`PinInput`, `PinInputLabel`, `PinInputControl` and `PinInputInput` are no longer exported from
`@kanzo-tech/ui`, and the Pin Input docs page is gone. If you used them, import Ark's directly —
`import { PinInput } from "@ark-ui/react/pin-input"` — and compose `PinInput.Root`,
`PinInput.Label`, `PinInput.Control`, `PinInput.Input` and `PinInput.HiddenInput` with your own
classes. It still reads `Field`'s context, so it keeps working inside a `Field`.
