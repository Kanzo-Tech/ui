---
"@kanzo-tech/ai": patch
---

`ConversationScrollButton` no longer stays on screen with nothing to scroll to: when the transcript stops overflowing without a scroll — the panel grew, the device turned, a turn was removed — `Conversation` measures again and takes the pin back.
