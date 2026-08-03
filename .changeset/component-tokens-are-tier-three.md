---
"@kanzo-tech/palette": major
"@kanzo-tech/theme": major
"@kanzo-tech/ui": major
---

**The editor's two tokens leave the role table and become component tokens — the third tier, in use.**

Decision 2 of `.planning/COLOUR-REVIEW.md` was "delete the 15 level-names", gated on a real screen
saying it did not use them. There is no screen yet, so the criterion available was what the library
itself reached for. Measured, and it **reverses the recommendation for 15 of the 17**:

```
secondary-wash 5   accent-wash 3   selection 3   match 4   match-active 1
destructive-wash 7  -wash-strong 5  -border 2      (warning / success / info: 4/2/2 each)
```

All seventeen alpha-bound roles are used, at 53 call sites between them. None is dead vocabulary.
And the shape is the one every reference system has: Radix Themes publishes 12 solid + 12 alpha
steps *and* 13 semantic aliases — `--accent-surface`, `--accent-track` — which are these tokens by
another name. **The defect the review found was never that semantic names exist; it was that nothing
lived beneath them, so every new need minted one.** The reference layer fixed that. The names stay.

What the measurement *did* find is a different duplicate, in all three documents checked:

```
--muted = --editor-active-line        both are base step 3
```

That is a component's token living in the document, and the review's own §10 says where it belongs:
a component declares it, pointing at a layer it does not own, and a tenant may still override it
because CSS lets them. So `--editor-active-line` and `--editor-gutter` are gone from `ROLES`, and
`CodeEditor` writes:

```css
.cm-activeLine { background: var(--editor-active-line, var(--muted)) }
```

The default costs the document nothing; a tenant who wants to repaint an editor declares the token
and wins in the cascade without the role table knowing it exists. It is Material Web's
`--md-filled-button-container-color: var(--md-sys-color-error)`, exactly — and it is the answer for
the next graph, calendar heatmap or editor that would otherwise ask for a row.

The `syntax-on-active-line` cross-check now grades against `--muted`, which *is* the active line: a
gate cannot measure a value the document does not contain, and the fallback is what every tenant
gets unless one deliberately overrides it.

Also recorded rather than fixed: the eight `--sidebar-*` roles are byte-identical to their
non-sidebar counterparts in every shipped document, in both modes. They stay because they are
Shark's contract and the recipes paste in verbatim — but that is now a measurement, not a belief.
