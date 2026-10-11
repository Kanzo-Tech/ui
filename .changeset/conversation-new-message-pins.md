---
"@kanzo-tech/ai": patch
---

A new message in `Conversation` brings the transcript back to its end, as *Scroll to the latest message* does. Once a reader had scrolled up (or a click inside an answer had scrolled it), the next question they sent was added below the fold, and so was its answer. A streaming answer still grows without taking the pin back, so reading higher up while it streams is left alone.
