---
"@kanzo-tech/ai": minor
---

**`useAgentChat(agent)` runs an agent in the page and keeps what it threw.** Its `error` is the value
the agent threw, so an `AiError` arrives with its `code` and `data` rather than as a sentence.
Replace `useChat({ transport: new DirectChatTransport({ agent }) })` with `useAgentChat(agent)`.
`useChat` stays for an agent behind your own HTTP route.

**`Chat` draws its error through `Problem`**, with the code shown, and takes a `copy` prop for your
words per code.

**A call left running when an answer stopped reads "Stopped"** instead of spinning forever. `Tool`
takes `stopped` for a transcript of your own.

**`QueryResult` draws every state of a `query` call.** While it runs, it shows the statement under a
skeleton. A stopped call shows its statement. A refusal is a `Problem`, and the statement gate's
carries `query/refused` on `data-code`. Pass it `stopped` from `Chat`.

**Breaking:**

- `ChatToolRenderers` are called at **every** state of a call, not only once it has a result, with
  a second argument `{ stopped }`. A renderer that only draws the result now checks
  `part.state === "output-available"` and returns something else before that, for example
  `<ToolInput />`.
- `Chat`'s `chat.error` is `unknown`, whatever stopped the answer.
- A refusal in `QueryResult` is no longer an `Alert`: select it by `[data-code="query/refused"]` or
  `[data-slot=diagnostic]`.
