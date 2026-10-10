---
"@kanzo-tech/ai": patch
---

`suggest()` takes a `count` and offers at most that many, dropping a repeated text; `dataSuggestions` passes its `count` (default 4) through, so a model that writes more than it was asked for no longer puts more than four questions in the Ask strip.
