---
"@kanzo-tech/ui": minor
---

**`useDebouncedCommit`'s `commit` answers what `onCommit` answered.** Pass
`(next) => save.mutateAsync(next)` and `commit(next)` hands back the save's promise, for a caller that
waits on the write its decision made — `AnswerCard`'s `onAdd`. The paused commit and `flush` leave
no rejection unhandled; report a failed write where you always did, in the mutation's `onError`.
Nothing changes for an `onCommit` that answers nothing.

What keasy's `dashboard-store.tsx` changes, to give the Ask panel the save to wait on:

```ts
const save = useMutation({ mutationFn: …, onSuccess: …, onError: (err) => toastError(err, "Failed to save the dashboard") });
const { draft, change, commit } = useDebouncedCommit(stored.spec, (spec) => spec && save.mutateAsync(spec), SAVE_MS);
// edit.commit's type: (next: Dashboards) => Promise<unknown> | undefined
```
