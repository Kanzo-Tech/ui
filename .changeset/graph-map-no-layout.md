---
"@kanzo-tech/graph": minor
---

While `x` and `y` place the points (Map), no layout runs over them: the toolbar's layout buttons are
disabled, `resume()` and `restart()` do nothing, a change of `sim` starts nothing, and binding the
second axis stops a layout that was running. `simulate={true}` no longer runs a layout over bound
positions; it only matters for an unbound graph, where `simulate={false}` keeps the seeded start.
