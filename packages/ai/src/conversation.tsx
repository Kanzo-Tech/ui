"use client";

import { ark } from "@ark-ui/react/factory";
import { ArrowDownIcon } from "lucide-react";
import * as React from "react";
import { Button, cn } from "@kanzo-tech/ui";

interface ConversationCtx {
  viewportRef: (el: HTMLDivElement | null) => void;
  contentRef: (el: HTMLDivElement | null) => void;
  pinned: boolean;
  scrollToEnd: () => void;
}

const Ctx = React.createContext<ConversationCtx | null>(null);
const useCtx = (part: string) => {
  const c = React.useContext(Ctx);
  if (!c) throw new Error(`${part} must render inside <Conversation>`);
  return c;
};

/** A scroll position is fractional and rarely lands on the end exactly; this is the allowance. */
const AT_END = 24;

/**
 * The transcript's scroll container, and the pin is the whole component.
 *
 * **The naive version, which both real consumers wrote:** an effect on the message array calling
 * `scrollTo({ top: scrollHeight, behavior: "smooth" })`. It follows the tail unconditionally, so a
 * reader who scrolled up to re-read something is dragged back down by the next token, every token,
 * for as long as the answer is streaming. Following is only correct while the reader is *already*
 * at the tail: scrolling up releases the pin, and `ConversationScrollButton` is how they take it
 * back. Roughly forty lines of listener and observer, and no dependency.
 */
export const Conversation = (props: React.ComponentProps<typeof ark.div>) => {
  const { className, children, slot, ...rest } = props;
  const [viewport, setViewport] = React.useState<HTMLDivElement | null>(null);
  const [content, setContent] = React.useState<HTMLDivElement | null>(null);
  const [pinned, setPinned] = React.useState(true);
  const pinnedRef = React.useRef(true);

  const scrollToEnd = React.useCallback(() => {
    if (!viewport) return;
    pinnedRef.current = true;
    setPinned(true);
    viewport.scrollTop = viewport.scrollHeight;
  }, [viewport]);

  React.useEffect(() => {
    if (!viewport) return;

    const sync = () => {
      const atEnd = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= AT_END;
      pinnedRef.current = atEnd;
      setPinned(atEnd);
    };
    sync();
    viewport.addEventListener("scroll", sync, { passive: true });

    // A stream produces *growth*, not scrolling: the content gets taller under a stationary
    // `scrollTop`, and no scroll event is fired for that. Observing the viewport alone never sees
    // it either — its own box did not change — which is why the inner element is observed too.
    const follow = () => {
      if (pinnedRef.current) viewport.scrollTop = viewport.scrollHeight;
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(follow);
    observer?.observe(viewport);
    if (content) observer?.observe(content);

    return () => {
      viewport.removeEventListener("scroll", sync);
      observer?.disconnect();
    };
  }, [viewport, content]);

  return (
    <Ctx.Provider
      value={{ viewportRef: setViewport, contentRef: setContent, pinned, scrollToEnd }}
    >
      <ark.div
        className={cn("relative flex min-h-0 flex-1 flex-col", className)}
        {...rest}
        data-slot={slot ?? "conversation"}
      >
        {children}
      </ark.div>
    </Ctx.Provider>
  );
};

/**
 * The scrolling region.
 *
 * ARIA: `role="log"` carries an implicit `aria-live="polite"`, so a message appended while the
 * reader is somewhere else is announced after what they are on rather than over it. Nothing inside
 * declares a role — a message is content, not a widget — so there is no keyboard contract to owe.
 */
export const ConversationContent = (props: React.ComponentProps<typeof ark.div>) => {
  const { className, children, slot, ...rest } = props;
  const ctx = useCtx("ConversationContent");

  return (
    <ark.div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain",
        "px-4 py-6",
        className
      )}
      ref={ctx.viewportRef}
      role="log"
      {...rest}
      data-slot={slot ?? "conversation-content"}
    >
      {/* `flex-1` gives the inner element the viewport's height when the transcript is short, which
          is what lets `ConversationEmpty` centre itself in the panel rather than sit at the top. */}
      <ark.div
        className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6"
        ref={ctx.contentRef}
      >
        {children}
      </ark.div>
    </ark.div>
  );
};

/**
 * The stage for the zero state, not the zero state itself: a centred column with a reading measure,
 * which `Item` and its parts are then composed into. There is deliberately no `title` / `description`
 * / `icon` prop — `EmptyState` was exactly that and it is a tombstone in `@kanzo-tech/ui`.
 */
export const ConversationEmpty = (props: React.ComponentProps<typeof ark.div>) => {
  const { className, slot, ...rest } = props;

  return (
    <ark.div
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-3",
        "mx-auto max-w-md px-4 py-12",
        "text-balance text-center text-muted-foreground text-sm",
        "[&_svg:not([class*='size-'])]:size-6",
        className
      )}
      {...rest}
      data-slot={slot ?? "conversation-empty"}
    />
  );
};

/**
 * Present only while the pin is released, and pressing it takes the pin back.
 *
 * It floats *over* a transcript that is still growing underneath it, which is why it enters rather
 * than appears and why it paints its own ground: `variant="outline"` is `bg-transparent` in light
 * mode, so without `bg-background` the message it covers reads straight through it. Dark keeps the
 * variant's own `bg-field`.
 */
export const ConversationScrollButton = (props: React.ComponentProps<typeof Button>) => {
  const { className, children, onClick, slot, ...rest } = props;
  const ctx = useCtx("ConversationScrollButton");

  if (ctx.pinned) return null;

  return (
    <Button
      aria-label={children === undefined ? "Scroll to the latest message" : undefined}
      className={cn(
        "absolute inset-x-0 bottom-4 z-10 mx-auto w-fit",
        "bg-background shadow-lg/5",
        "fade-in-0 zoom-in-95 slide-in-from-bottom-2 animate-in",
        "motion-reduce:animate-none!",
        className
      )}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) ctx.scrollToEnd();
      }}
      pill
      // Icon-only by default; give it words and it becomes a pill wide enough to hold them, the way
      // `PromptInputSubmit` does.
      size={children === undefined ? "icon-sm" : "sm"}
      variant="outline"
      {...rest}
      slot={slot ?? "conversation-scroll-button"}
    >
      {children ?? <ArrowDownIcon />}
    </Button>
  );
};
