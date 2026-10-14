---
"@kanzo-tech/ai": minor
---

Names leave `@kanzo-tech/ai`, none of them called by a product:

- `useChat`. Import it from `@ai-sdk/react`, which you already install as a required peer: `import { useChat } from "@ai-sdk/react"`.
- `MessageAvatar`, `MessageAvatarProps` and `MessageActions` are deleted, and `MessageRole` leaves the entry. `Message`, `MessageList` and `MessageContent` are unchanged; put an `Avatar` from `@kanzo-tech/ui`, or a row of buttons, inside a `Message` yourself.
- From `@kanzo-tech/ai/task`, `TaskState`. Where you typed an `onState` callback, use `RunOptions["onState"]`.
- From `@kanzo-tech/ai/data`, `askTransport`, `readAnswer`, `askAlternatives`, `link` and `questionOf`. `useAskChat` is the chat, `AskChips` draws the alternatives, and `askOffers` already returns each offer with its question.
