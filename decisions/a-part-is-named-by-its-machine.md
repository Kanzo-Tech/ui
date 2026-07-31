# A part is named by its machine

- **Status** live — 2026-07-31
- **Decided** Where Ark and Shark spell the same part differently, the exported name is **Ark's**.
  `AccordionItemTrigger`, not `AccordionTrigger`. `NumberInputIncrementTrigger`, not
  `NumberInputIncrement`. `PaginationPrevTrigger`, not `PaginationPrevious`. `FileUploadItemSizeText`,
  not `FileUploadItemSize`. Eight parts, one rule.
- **Because** the name of a part is a fact about the machine underneath it, not a choice about how
  the surface looks — so it belongs to the reference that owns the machine. A reader who meets
  `AccordionItemTrigger` and goes to Ark's documentation finds it under that name; one who meets
  `AccordionTrigger` has to guess which part of the machine it wraps before they can look anything
  up. Shark shortens because it flattens compounds for a copy-paste registry, which is a different
  problem from the one this library has.
- **Reversed by** a part whose Ark name describes the machine's internals rather than the thing a
  caller places — a name that is precise and useless. None of the eight is: every one of them names
  an element a consumer writes by hand. Also reversed if Ark itself renames a part, in which case
  the exported name follows Ark rather than freezing, because the reason here is the pointer to the
  documentation and not the spelling.
- **Held by** `packages/ui/src/shark-parity.test.ts`, whose `RENAMED` table declares all eight as a
  pair — nothing missing and nothing extra, two references disagreeing about spelling; and
  `CONVENTIONS.md`, *Naming*, whose base-plus-part rule this is the reference-level justification for

**This settles eight names, and not the general question.** `decisions/a-measurement-overrules-the-reference.md`
records three shapes its rule does not decide, and the first is *the two references disagree with
each other* — nothing ranks Ark against Shark where they meet. This record does not rank them
either. It says only that a **part name** is behaviour's to give, because it is a fact about the
machine; it leaves untouched every other way the two could collide. The owner was offered the
general question and chose the narrow answer, which is the right size: a tie-break invented ahead
of the cases it must settle is how a rule ends up claiming more than it can prove.

The divergence file said in writing that this was "an owner's call and not a settled one". It was
settled on 2026-07-31; that sentence is now wrong and is corrected where it stands.
