# @kanzo-tech/ai

The AI surfaces of Kanzo UI: a field the model helps fill (`Assist`), a conversation with one
(`Chat`, with its transcript, composer, reasoning and tool calls), and Tasks — a small model fills a
small artefact, an oracle checks it, and a bounded loop repairs it or asks the person.

```sh
pnpm add @kanzo-tech/ai @kanzo-tech/ui ai @ai-sdk/react
```

```ts
import { Assist, Chat, useTask } from "@kanzo-tech/ai";
import { defineTask, runTask } from "@kanzo-tech/ai/task";
import { ask, useAskChat } from "@kanzo-tech/ai/data"; // needs the optional peer @kanzo-tech/mosaic
```

The model is reached through `@kanzo-tech/llm`, and none of the AI SDK is re-exported: import it from
`ai` by name.

The reference is <https://kanzo-tech.github.io/ui/docs/ai>, and why it is shaped this way is
<https://kanzo-tech.github.io/ui/docs/design/ai>.
