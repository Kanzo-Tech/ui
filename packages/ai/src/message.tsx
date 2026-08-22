import { ark } from "@ark-ui/react/factory";
import type React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { Avatar, AvatarFallback, AvatarImage, cn } from "@kanzo-tech/ui";

export type MessageRole = "user" | "assistant" | "system";

const messageVariants = tv({
  base: [
    "group/message",
    "flex w-full flex-wrap items-start gap-3",
    "text-sm",
  ],
  variants: {
    role: {
      // Reversed rather than `justify-end`: the row packs against the reading end and the avatar
      // goes with it, and `row-reverse` is direction-aware where a physical side is not.
      user: "flex-row-reverse",
      assistant: "",
      // **No surface of its own, and that is the correction.** A system note used to be a centred
      // `rounded-full` pill painted by `MessageContent` — a shape the library already has, spelled
      // again, and one that cannot hold what it was given: a full-round pill around a wrapped
      // sentence is a stadium with dead corners, and `Badge`, the component it was imitating, is
      // `whitespace-nowrap` at a fixed `h-5` and could never have rendered it.
      //
      // AI Elements types `from` as the AI SDK's `UIMessage["role"]` — system included — and gives
      // it no treatment at all: `is-user` or `is-assistant`, nothing else. So the role stays, the
      // invented surface goes, and a caller who wants the note to read as an aside composes an
      // `Alert` inside the row. That is a component with a wash, a border, an icon slot, an action
      // slot, `role="status"` and the ability to wrap.
      system: "",
    },
  },
  defaultVariants: {
    role: "assistant",
  },
});

export interface MessageProps
  extends Omit<React.ComponentProps<typeof ark.li>, "role">,
    VariantProps<typeof messageVariants> {}

/**
 * One turn. The role is declared once, here, and every part below reads it off `data-role`
 * through a group selector — repeating it as a prop on each part is how the two drift.
 *
 * `role` is the speaker and not the ARIA attribute, which is why the HTML one is omitted rather
 * than merged: two meanings under one name, and the wrong one reaching the DOM, is worse than an
 * `<li>` nobody can re-role.
 */
export const Message = (props: MessageProps) => {
  const { role = "assistant", className, slot, ...rest } = props;

  return (
    <ark.li
      className={cn(messageVariants({ role }), className)}
      data-role={role}
      {...rest}
      data-slot={slot ?? "message"}
    />
  );
};

/**
 * **`role="list"` on top of the `<ul>`, because `list-none` takes the implicit one away.** WebKit
 * drops list semantics from a list whose `list-style` is `none` — items included — so a styled
 * transcript announces nothing in VoiceOver. jsdom does not model it, so the role queries passed
 * throughout. See `DiagnosticList`, which carries the argument in full.
 */
export const MessageList = (props: React.ComponentProps<typeof ark.ul>) => {
  const { className, slot, ...rest } = props;

  return (
    <ark.ul
      className={cn("flex w-full list-none flex-col gap-6", className)}
      role="list"
      {...rest}
      data-slot={slot ?? "message-list"}
    />
  );
};

const initials = (name?: string) =>
  (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

export interface MessageAvatarProps extends React.ComponentProps<typeof Avatar> {
  src?: string;
  /** Names the image and, when there is no image, supplies the fallback's initials. */
  name?: string;
}

export const MessageAvatar = (props: MessageAvatarProps) => {
  const { src, name, className, children, size = "sm", slot, ...rest } = props;

  return (
    <Avatar
      className={cn(
        "shrink-0",
        "group-data-[role=system]/message:hidden",
        className
      )}
      size={size}
      {...rest}
      slot={slot ?? "message-avatar"}
    >
      {children ?? (
        <>
          {src ? <AvatarImage alt={name ?? ""} src={src} /> : null}
          <AvatarFallback>{initials(name)}</AvatarFallback>
        </>
      )}
    </Avatar>
  );
};

/**
 * The turn's words. The two speakers are told apart by surface before they are read: the user gets
 * a bubble and the assistant the page itself. A system note takes neither — it is not a speaker.
 *
 * **One treatment per speaker, not two.** The bubble was `bg-muted` plus a border, and it needed
 * the border because `--muted` is one step off `--background` (#efefef on #fafafa) — a fill nobody
 * could see, rescued by an outline. `--secondary` is the step that shows on its own, which is the
 * fill the source uses for exactly this, and it takes the outline back out. The tucked corner went
 * with it: a radius the rest of the library does not use, pointing at an avatar that is already
 * beside it.
 *
 * **Two treatments, not three.** The system pill that used to be here is gone; see `Message`.
 */
export const MessageContent = (props: React.ComponentProps<typeof ark.div>) => {
  const { className, slot, ...rest } = props;

  return (
    <ark.div
      className={cn(
        "flex min-w-0 flex-1 flex-col gap-2 leading-relaxed",
        "group-data-[role=user]/message:max-w-[85%] group-data-[role=user]/message:flex-none",
        "group-data-[role=user]/message:rounded-xl",
        "group-data-[role=user]/message:bg-secondary group-data-[role=user]/message:text-secondary-foreground",
        "group-data-[role=user]/message:px-3.5 group-data-[role=user]/message:py-2.5",
        className
      )}
      {...rest}
      data-slot={slot ?? "message-content"}
    />
  );
};

/**
 * A row of affordances for the turn above it — copy, retry, a source. `basis-full` breaks it onto
 * its own line, which is what the root's `flex-wrap` is there for.
 *
 * Hidden until the turn is pointed at, so a transcript is words rather than a column of buttons;
 * revealed by focus as well as hover, and always present on a coarse pointer, where there is no
 * hover to reveal it with.
 */
export const MessageActions = (props: React.ComponentProps<typeof ark.div>) => {
  const { className, slot, ...rest } = props;

  return (
    <ark.div
      className={cn(
        "flex basis-full items-center gap-1",
        "opacity-0 transition-opacity motion-reduce:transition-none!",
        "group-hover/message:opacity-100 group-focus-within/message:opacity-100",
        "pointer-coarse:opacity-100",
        "group-data-[role=user]/message:justify-end",
        className
      )}
      {...rest}
      data-slot={slot ?? "message-actions"}
    />
  );
};
