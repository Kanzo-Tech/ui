---
"@kanzo-tech/testing": minor
---

The harness API takes Angular CDK's names wherever CDK has the operation.

**Breaking**, in your page objects and specs:

- `env.harness(` is `env.getHarness(`, `env.harnesses(` is `env.getAllHarnesses(`, and `env.root` is `env.rootElement`.
- Inside a harness, `this.locate(query)` and `this.one(by, what, within?)` are one `this.locatorFor(query, what?)`, which returns the function that finds it: `await this.locatorFor(TileHarness)()`, `await this.locatorFor({ role: "button", name: "Add" }, "no Add")(within)`. Declare it once as a field and call it where you need it.
- `Handle` is `TestElement`, and `HarnessType` is `ComponentHarnessConstructor`.
- On a `TestElement`, `.attribute(` is `.getAttribute(`, `.press(` is `.sendKeys(`, and `.rect()` is `.getDimensions()`, an `ElementDimensions` with `top` and `left` in place of `y` and `x`; `Rect` is `ElementDimensions`.
- `Severity` is gone: it is `FindingSeverity`, from `@kanzo-tech/ui`. `FindingsItemHarness.severity()` answers the same three values.
