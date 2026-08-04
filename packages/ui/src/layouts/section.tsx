import { ark } from "@ark-ui/react/factory";
import type { ComponentProps } from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../lib/cn.js";

/**
 * Section — the content scaffolding that sits INSIDE a shell region.
 *
 * Different axis from `shell.tsx`: the Shell regions position the window, this positions the
 * content within them. They never compete, and a Section nests inside `ShellMain`.
 *
 * This is one vocabulary where there were three. `PageShell` (Header · Title · Description ·
 * Actions · Content · Footer), `SectionHeader` (Icon · Content · Title · Description ·
 * Actions) and `TopBarMain` (TitleGroup · Title · Subtitle · Actions) described the same row
 * — a heading with optional icon, supporting text and end-aligned controls — under three sets
 * of names. `scale` is what actually differed between them.
 *
 * NOT merged, deliberately: `CardHeader` and `DialogHeader` have this same shape but stay with
 * their components. A header wired to a machine belongs to that machine — `DialogHeader` wires
 * Ark's `aria-labelledby`. Precedent that the line is right: `TourHeader` *is* `DialogHeader`.
 * Sharing across machines is fine when the wiring is shared; merging layout with wiring is not.
 *
 * Parts are FLAT exports. Statics are lost when a module becomes a client reference under RSC,
 * so `Section.Header` would read back as `undefined` — a bug we hit for real with `Preferences`.
 */

export const sectionVariants = tv({
  base: "flex min-h-0 flex-1 flex-col",
});

/** The container. Presentational — the scale lives on the parts that render text. */
export type SectionRootProps = ComponentProps<typeof ark.div>;

export function SectionRoot({ className, slot, ...rest }: SectionRootProps) {
  return (
    <ark.div className={cn(sectionVariants(), className)} {...rest} data-slot={slot ?? "section"} />
  );
}
SectionRoot.displayName = "SectionRoot";

const sectionHeaderVariants = tv({
  base: "flex items-start gap-3",
  variants: {
    /** `page` is the top of a screen; `section` is a block within one. The difference is
     *  breathing room, and it is the only thing that ever really separated PageShellHeader
     *  from SectionHeader. */
    scale: {
      page: "px-4 pt-4 pb-2",
      section: "",
    },
    /** Draw a separator under the header. */
    bordered: { true: "border-b border-border pb-3", false: "" },
  },
  defaultVariants: { scale: "section", bordered: false },
});

export interface SectionHeaderProps
  extends ComponentProps<typeof ark.header>,
    VariantProps<typeof sectionHeaderVariants> {}

/**
 * A flex row, not a grid. `PageShellHeader` used a two-column grid so its actions could span
 * both text rows; a flex row with a title group and `ms-auto` on the actions achieves the same
 * alignment, handles the optional icon that the grid could not, and mirrors under RTL without
 * a second code path.
 */
export function SectionHeader({ className, scale, bordered, slot, ...rest }: SectionHeaderProps) {
  return (
    <ark.header
      className={cn(sectionHeaderVariants({ scale, bordered }), className)}
      {...rest}
      data-slot={slot ?? "section-header"}
    />
  );
}
SectionHeader.displayName = "SectionHeader";

/** Leading icon or badge. `mt-0.5` optically aligns it with the title's cap height. */
export function SectionIcon({ className, slot, ...rest }: ComponentProps<typeof ark.div>) {
  return (
    <ark.div
      className={cn("mt-0.5 shrink-0 text-muted-foreground [&_svg]:size-5", className)}
      {...rest}
      data-slot={slot ?? "section-icon"}
    />
  );
}
SectionIcon.displayName = "SectionIcon";

/** The text column: title over description. `min-w-0` is what lets the title truncate rather
 *  than pushing the actions off the row. */
export function SectionTitleGroup({ className, slot, ...rest }: ComponentProps<typeof ark.div>) {
  return (
    <ark.div
      className={cn("min-w-0 flex-1", className)}
      {...rest}
      data-slot={slot ?? "section-title-group"}
    />
  );
}
SectionTitleGroup.displayName = "SectionTitleGroup";

const sectionTitleVariants = tv({
  base: "truncate text-foreground",
  variants: {
    scale: {
      page: "text-lg font-bold",
      section: "text-lg font-semibold",
    },
  },
  defaultVariants: { scale: "section" },
});

export interface SectionTitleProps
  extends Omit<ComponentProps<"h2">, "ref">,
    VariantProps<typeof sectionTitleVariants> {
  /** Heading level, so the title slots into the surrounding document outline. Default 2.
   *  Kept SEPARATE from `scale`: how big it looks and where it sits in the outline are
   *  different questions, and tying them would force a visual choice to change semantics. */
  level?: 1 | 2 | 3 | 4 | 5 | 6;
}

export function SectionTitle({ level = 2, scale, className, slot, ...rest }: SectionTitleProps) {
  const Title = `h${level}` as const;
  return (
    <Title
      className={cn(sectionTitleVariants({ scale }), className)}
      {...rest}
      slot={slot ?? "section-title"}
    />
  );
}
SectionTitle.displayName = "SectionTitle";

/** Supporting text under the title. Was `TopBarSubtitle` and `PageShellDescription` too. */
export function SectionDescription({ className, slot, ...rest }: ComponentProps<typeof ark.p>) {
  return (
    <ark.p
      className={cn("mt-0.5 text-muted-foreground text-sm", className)}
      {...rest}
      data-slot={slot ?? "section-description"}
    />
  );
}
SectionDescription.displayName = "SectionDescription";

/** End-aligned controls. `ms-auto` rather than the root's `justify-between`: with an optional
 *  icon and text column ahead of it, one logical margin pushes the actions to the inline end
 *  and still mirrors in RTL. */
export function SectionActions({ className, slot, ...rest }: ComponentProps<typeof ark.div>) {
  return (
    <ark.div
      className={cn("ms-auto flex shrink-0 items-center gap-2 self-center", className)}
      {...rest}
      data-slot={slot ?? "section-actions"}
    />
  );
}
SectionActions.displayName = "SectionActions";

const sectionBodyVariants = tv({
  base: "flex min-h-0 flex-1 flex-col gap-4 overflow-auto",
  variants: {
    scale: { page: "p-4", section: "" },
  },
  defaultVariants: { scale: "section" },
});

export interface SectionBodyProps
  extends ComponentProps<typeof ark.section>,
    VariantProps<typeof sectionBodyVariants> {}

/**
 * The content region. Renders `<section>`, NEVER `<main>` — a Section nests inside a shell
 * that already owns the page's single `<main>` landmark, and two of those are a conformance
 * error that also makes "skip to main content" ambiguous.
 */
export function SectionBody({
  className,
  scale,
  slot,
  ...rest
}: SectionBodyProps) {
  return (
    <ark.section
      className={cn(sectionBodyVariants({ scale }), className)}
      {...rest}
      data-slot={slot ?? "section-body"}
    />
  );
}
SectionBody.displayName = "SectionBody";

/** Pinned footer — form actions, a save bar. Unlike the header it carries a surface, because
 *  it sits against the bottom of a scrolling body and needs to separate from it. */
export function SectionFooter({ className, slot, ...rest }: ComponentProps<typeof ark.footer>) {
  return (
    <ark.footer
      className={cn(
        "flex shrink-0 items-center justify-between gap-2 border-t border-border bg-card px-4 py-3",
        className,
      )}
      {...rest}
      data-slot={slot ?? "section-footer"}
    />
  );
}
SectionFooter.displayName = "SectionFooter";
