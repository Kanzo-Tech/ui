---
"@kanzo-tech/ai": minor
---

`@kanzo-tech/ai/task` runs a Task: `defineTask({ name, context, instructions, prompt, output, verify, decide })` declares what a model may answer and which oracles check it, and `runTask(task, input, { model })` asks for the artefact with `Output.object`, sends the oracles' diagnostics back for another attempt, and answers a `Proposal` — accepted, with its diagnostics, or with a `Decision` for the person. No React and no tools.
