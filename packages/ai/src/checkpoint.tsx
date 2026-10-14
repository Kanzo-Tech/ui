import { ark } from "@ark-ui/react/factory";
import { BookmarkIcon } from "lucide-react";
import type React from "react";
import { Button, type ButtonProps, cn, Separator } from "@kanzo-tech/ui";

/** Every word a checkpoint draws. English by default. */
export interface CheckpointTranslations {
  /** The trigger's label, when it is given none of its own. */
  restore: string;
}

const ENGLISH: CheckpointTranslations = {
  restore: "Restore",
};

/**
 * A point in the transcript the host can go back to — *Preview 2*, and a way back to it — drawn as
 * a thin rule across the conversation: what the children say, then the rule to the end of the row.
 * AI Elements' `Checkpoint`, and v0's and Lovable's version restore. It restores nothing itself: what
 * going back means is the host's, and it is `CheckpointTrigger`'s `onClick`.
 *
 * **An item of the transcript, so an `<li>`**: it sits in `MessageList` between two `Message`s, and
 * anything else there would break the list the transcript is. `asChild` for a transcript that is
 * not one.
 *
 * ARIA: the item reads as its children — the label, then the trigger, a button named by its words.
 * The rule is `aria-hidden`: it is paint, and a `role="separator"` announced after the button says
 * nothing the item has not.
 */
export const Checkpoint = (props: React.ComponentProps<typeof ark.li>) => {
  const { className, children, slot, ...rest } = props;

  return (
    <ark.li
      className={cn("flex min-w-0 items-center gap-2 text-muted-foreground text-xs", className)}
      {...rest}
      data-slot={slot ?? "checkpoint"}
    >
      {children}
      {/* `flex-1` and not a width: the flex basis takes the row's remainder over `Separator`'s own
          `w-full`, which would push the label and the trigger off the row's start. */}
      <Separator aria-hidden className="flex-1" />
    </ark.li>
  );
};

/** The checkpoint's mark — a bookmark unless given another glyph as its child. */
export const CheckpointIcon = (props: React.ComponentProps<typeof ark.span>) => {
  const { className, children, slot, ...rest } = props;

  return (
    <ark.span
      aria-hidden
      className={cn("flex shrink-0 [&_svg:not([class*='size-'])]:size-4", className)}
      {...rest}
      data-slot={slot ?? "checkpoint-icon"}
    >
      {children ?? <BookmarkIcon />}
    </ark.span>
  );
};

export interface CheckpointTriggerProps extends ButtonProps {
  translations?: Partial<CheckpointTranslations>;
}

/** The way back: a quiet button, *Restore* unless given words of its own. `onClick` is the restore. */
export const CheckpointTrigger = (props: CheckpointTriggerProps) => {
  const { translations, children, size = "sm", variant = "ghost", slot, ...rest } = props;
  const t = { ...ENGLISH, ...translations };

  return (
    <Button size={size} variant={variant} {...rest} slot={slot ?? "checkpoint-trigger"}>
      {children ?? t.restore}
    </Button>
  );
};
