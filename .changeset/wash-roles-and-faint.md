---
"@kanzo-tech/palette": minor
"@kanzo-tech/theme": minor
"@kanzo-tech/ui": patch
---

**Washes, and the ink between step 10 and step 11 — the roles a dilution sweep proved were missing.**

A sweep of every `/NN` colour dilution in `packages/ui/src` left most of them alone because the
theme published no role for what they were doing. Measuring why produced a finding that is not
about any one component: mapping the shipped percentages onto the family's own alpha scale, over
the page, `/4` is a3 in light and **a2 in dark**, `/10` is a4 and a3, `/20` is a5 and a4, `/32` is
a6 and a5. That follows from `CHROMA_PROFILE.dark` being deliberately fatter at the bottom of the
ramp — a tint has to work harder against a dark ground — so **every `bg-X/NN` in the library was
correct in at most one mode**. Three components had already written the symptom out by hand: a
badge at 10% with a dark override to 5%, a menu and a listbox at 10% with a dark override onto a
*different token*, and a slider track doing the same at 24%.

Eight new alpha roles, resolved against each mode's own ramp at derivation time, so one binding is
right in both:

- **`--secondary-wash`** `(neutral, a4)` and **`--accent-wash`** `(neutral, a5)` — what `--secondary`
  and `--accent` are when the component cannot know its backdrop. `bg-accent/50` measured ΔE **0.00**
  from the rest state on an accent backdrop and solid `bg-secondary` measured 0.00 on a secondary
  one; across the six surfaces the theme publishes the washes never fall below ΔE 4.32 (light) /
  6.00 (dark). Named for the **level**, never the state: the same two values are a radio card's
  hover, a calendar day's focus and a table row's selected state. `--field` is the a3 member under
  the name the `--input` split gave it.
- **`--X-wash`** `(X, a3)`, **`--X-wash-strong`** `(X, a4)` and **`--X-border`** `(X, a6)` for each of
  `destructive` / `warning` / `success` / `info` — the same steps the neutral uses for `--field` and
  `--border`, read across. None owes contrast: ink measures 4.86–6.81 on the fills across every
  surface, and WCAG 1.4.11 exempts a non-interactive border by name.

And one rename, not a second token: **`--kanzo-gutter-foreground` becomes `--faint`**. A gutter's
line numbers and a field's placeholder are one decision — ink that is present but is not content —
and eleven sites were spelling it `text-muted-foreground/64`, measuring **3.04–4.00:1**, live AA
failures. Step 10 reads 5.18:1 in light and 4.74 in dark on the page. It is an improvement, not a
blanket pass: a dark input nested in a popover still reads 4.13, and there is no step between it
and `--muted-foreground`.

`--selection` also gains its utility. It shipped a value and nothing mapped it in `@theme inline`,
so `bg-selection` did not exist and the graph canvas reached for `var(--selection)` by hand.

`TableRow` is a component-design change rather than a swap: its hover measured ΔE 1.20–1.50, under
the ramp's own ΔE-2 bar, and raising it collided with a `selected` state painted in solid `--muted`
— which is ΔE 0.00 from a dark popover. Rest is now the backdrop, hover is `--secondary-wash` and
selected is `--accent-wash`. `alpha-steps.test.ts` bans the spellings the new roles replace.
