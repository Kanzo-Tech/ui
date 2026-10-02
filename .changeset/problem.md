---
"@kanzo-tech/ui": minor
---

**`Problem` draws any thrown value as a `Diagnostic`.** Pass what your `catch` holds; it reads the
shape every coded error here shares — `code` (`area/kind`), `title`, `message`, `data`, `cause`, and
`severity`, `help` and `related` where present — and nests the causes below it. Your words for a
code come from one function:

```tsx
<DiagnosticList>
  <Problem copy={(code, data) => registry[code]} error={error}>
    <Button onClick={retry} size="sm" variant="outline">Try again</Button>
  </Problem>
</DiagnosticList>
```

`copy` returns `{ title?, detail?, link?: { label, href }, page? }` or `undefined`; a rewritten
detail keeps the error's own row one level down. Each row's details trigger is named
`Details: <title>`; `translations` changes that and the severity words.

If you mapped errors onto `Diagnostic` parts yourself, you can delete that code.
