# The AI surfaces are their own package

- **Status** live — 2026-08-20
- **Decided** `@kanzo-tech/ai` ships the transcript, the composer, a model's reasoning, the calls it
  makes, and the two field affordances — `Complete`, `Suggest` and the three engine hooks moved
  there whole. It depends on `@kanzo-tech/ui`; nothing in `ui` may import it.
- **Because** the root barrel is a one-way door, and a consumer who wants a `Button` must not pay
  for a transcript.
- **Reversed by** a second package needing the engine hooks without the surfaces, which would make
  the hooks a third package rather than move them back.
- **Held by** `packages/ui/src/index.test.ts`, "drops components superseded by composition or a
  merge", `!SuggestRoot`, `!CompleteRoot`, `!useAiStream`;
  `packages/ui/src/documented-exports.test.ts`, "resolves every entry point and every declared peer"

The line is not *is it AI*. It is **does the component know a model exists** — and by that test the
two field affordances should have stayed. `Suggest` takes candidates and a callback; a human typing
would be indistinguishable, and `useInlineCompletion` takes a function returning an async iterable
and never makes a request. They moved anyway, on the owner's call, and the reason is not the code:
the ✨ marks a field as model-assisted *to the reader*, and that mark is the thing being bought. A
package that ships the transcript and leaves the mark behind splits one purchase across two
installs.

What that costs, and it is worth writing down because it is the argument for the other answer:
`@kanzo-tech/ui` now exports two fewer compounds than a reader of `DESIGN.md`'s AI paragraph
expects, and `decisions/ai-assist-composes-over-pure-inputs.md` — which is still live, and still
right about *no prop on the primitives and no provider* — now describes a shape that lives next
door. That record was edited to say where, not reopened: nothing it decided changed.

`@kanzo-tech/ui/editor`'s `CodeEditor` was checked before the move and imports nothing from the
engine — the only completion in that file is CodeMirror's own `autocompletion` and
`completionKeymap`. That is what makes the split produce no cycle; had it imported
`useInlineCompletion`, `ui/editor` would have depended on `ai` and `ai` already depends on `ui`.

An earlier draft of this paragraph said `CodeEditor` "takes a `complete` prop", and it does not —
`CodeEditorProps` is `value` / `onChange` / `extensions` / `readOnly` / `basics` and no such prop.
The claim came from `editor.ts`'s own comment and from a row in `forms/controls.mdx`, both of which
described a design that was never shipped; both are corrected. The conclusion survived its premise,
which is exactly the shape `decisions/README.md` warns about — the sentence that reaches outward is
the one that rots.
