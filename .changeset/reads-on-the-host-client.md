---
"@kanzo-tech/ui": minor
"@kanzo-tech/ai": minor
---

A relation's fields and Ask's answers are read once per page and kept, on your own TanStack Query client. `useFieldStats` — and with it `Dashboard` and `AnswerCard` — reads a relation's `SUMMARIZE` once for every part that asks for it, whatever each hides, never retries, and reads again only for a new relation or after a failure; `useAskChat` reads an answer asked again under the same chips once, and *Stop* cancels the read at once. The reads appear in your client's devtools and go when you clear it. **Breaking:** install `@tanstack/react-query` 5 and render one `QueryClientProvider` above a page that reads fields through `@kanzo-tech/ui/analytics` (`Dashboard`, `useFieldStats`) and above Ask (`@kanzo-tech/ai/data`); without it those hooks throw TanStack's own *No QueryClient set*. `Chat` and `Assist` from `@kanzo-tech/ai`'s root, and the charts on their own, need neither. `queryFieldStats` is gone: use `useFieldStats`, or run `SUMMARIZE` yourself and pass the rows to `fieldStats`. `askTransport` takes the client as its second argument — `askTransport(() => options, useQueryClient())`. Clear your client on sign-out.
