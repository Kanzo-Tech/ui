---
"@kanzo-tech/llm": minor
---

A local model's answer that was interrupted or cut off is now an error, not a result. An interrupted
generation rejects as an `AbortError`; a structured answer (`Output.object` or a grammar) that did not
fit the model's context rejects as `LlmError` coded `llm/truncated`; text that did not fit is returned
with the finish `length`. Ask no longer shows "No object generated: could not parse the response" for
a generation that was stopped. Calls to a local model now run one at a time, and cancelling a call
that is still waiting no longer stops the question being answered. If you branch on `LlmError.code`,
`llm/truncated` is a second code beside `llm/unavailable`.
