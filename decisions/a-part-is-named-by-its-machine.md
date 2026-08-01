# A part is named by its machine

- **Status** live — 2026-07-31
- **Decided** Where Ark and Shark spell the same part differently, the exported name is **Ark's**.
  `AccordionItemTrigger`, not `AccordionTrigger`. `NumberInputIncrementTrigger`, not
  `NumberInputIncrement`. `PaginationPrevTrigger`, not `PaginationPrevious`. `FileUploadItemSizeText`,
  not `FileUploadItemSize`. Nine parts, one rule.
- **Because** the name of a part is a fact about the machine underneath it, not a choice about how
  the surface looks — so it belongs to the reference that owns the machine. A reader who meets
  `AccordionItemTrigger` and goes to Ark's documentation finds it under that name; one who meets
  `AccordionTrigger` has to guess which part of the machine it wraps before they can look anything
  up. Shark shortens because it flattens compounds for a copy-paste registry, which is a different
  problem from the one this library has.
- **Reversed by** a part whose Ark name describes the machine's internals rather than the thing a
  caller places — a name that is precise and useless. None of the nine is: every one of them names
  an element a consumer writes by hand. Also reversed if Ark itself renames a part, in which case
  the exported name follows Ark rather than freezing, because the reason here is the pointer to the
  documentation and not the spelling.
- **Held by** `packages/ui/src/shark-parity.divergences.ts`, whose `RENAMED` table declares all nine
  as a pair — nothing missing and nothing extra, two references disagreeing about spelling;
  `packages/ui/src/shark-parity.test.ts`, which is what reads that table and fails; and
  `CONVENTIONS.md`, *Naming*, whose base-plus-part rule this is the reference-level justification for

**This settles nine names, and not the general question.** `decisions/a-measurement-overrules-the-reference.md`
records three shapes its rule does not decide, and the first is *the two references disagree with
each other* — nothing ranks Ark against Shark where they meet. This record does not rank them
either. It says only that a **part name** is behaviour's to give, because it is a fact about the
machine; it leaves untouched every other way the two could collide. The owner was offered the
general question and chose the narrow answer, which is the right size: a tie-break invented ahead
of the cases it must settle is how a rule ends up claiming more than it can prove.

The ninth arrived from a different direction and under the same rule.
`decisions/adopt-the-part-the-machine-ships.md` adopted Shark's `ClipboardValue`, which is Ark's
`Clipboard.ValueText`; that record decides *whether* a name is adopted and this one decides what it
is then called, so the pair produced a rename rather than an addition.

The divergence file said in writing that this was "an owner's call and not a settled one". It was
settled on 2026-07-31, and for a day only half of that file knew it: `RENAMED`'s shared reason cited
this record while the `BEYOND_THE_SURFACE` entry beside it still framed the same parts as never
having been weighed against parity, the cheapest of the open questions. Both halves now say the same
thing — the correction landing where the rule is *listed* and not only where it is stated is what
was missing.
