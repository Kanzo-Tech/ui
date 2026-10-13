---
"@kanzo-tech/ai": minor
---

The transcript and the composer `Chat` draws with are exported, for a conversation whose turns are yours: `Conversation`, `ConversationContent` and `ConversationScrollButton` — the scroll region that follows new content only while the reader is at the end, and the button that takes them back — and `PromptInput`, `PromptInputTextarea`, `PromptInputToolbar` and `PromptInputSubmit` (`PromptInputSubmitProps`), the composer where Enter sends, Shift+Enter is a newline and the button is Send, Stop or Retry by the chat's `status`. A transcript that scrolls itself to the bottom on every turn, or a composer built from `InputGroup`, can be replaced with them.
