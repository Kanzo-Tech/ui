"use client";

import { ark } from "@ark-ui/react/factory";
import * as React from "react";
import { cn, Kbd } from "@kanzo-tech/ui";
import { AiMark, type AiMarkProps } from "./ai-mark.js";
import {
  type AiStatus,
  type InlineCompletionRequest,
  MIN_COMPLETE_LENGTH,
  useInlineCompletion,
} from "./use-ai.js";

/**
 * A `<textarea>`, and there is no `<input>` branch any more.
 *
 * **A one-line field takes candidates, not a continuation.** A continuation drawn over an
 * `<input>` can only ever show what fits in the remaining width — the field's own `scrollLeft`
 * cannot reveal text that is not in its value — so a long offer was unreadable by any gesture and
 * accepting it meant accepting blind. No reference does it either: Gmail continues a body, Copilot
 * an editor, and every single-line field in the wild offers a *list*. That is `Suggest`, and it is
 * already here. See `decisions/a-line-takes-candidates-a-paragraph-takes-a-continuation.md`.
 */
type FieldEl = HTMLTextAreaElement;

interface CompleteCtx {
  fieldRef: React.RefObject<FieldEl | null>;
  value: string;
  /** What is on offer at the caret. Empty when there is nothing. */
  ghost: string;
  /** Where the offer goes. The ghost is drawn here, not at the end of the value. */
  caret: number;
  rtl: boolean;
  status: AiStatus;
  error: string | null;
  /** The value is long enough for `complete` to be asked at all. */
  askable: boolean;
  metrics: React.CSSProperties;
  onChange: (e: React.ChangeEvent<FieldEl>) => void;
  onKeyDown: (e: React.KeyboardEvent<FieldEl>) => void;
  syncCaret: () => void;
  accept: () => void;
  request: () => void;
}

const Ctx = React.createContext<CompleteCtx | null>(null);
const useCtx = (part: string) => {
  const c = React.useContext(Ctx);
  if (!c) throw new Error(`${part} must render inside <CompleteRoot>`);
  return c;
};

const METRICS = [
  "fontFamily", "fontSize", "fontWeight", "fontStyle", "letterSpacing", "lineHeight",
  "textTransform", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
] as const;

interface FieldShape {
  metrics: React.CSSProperties;
  rtl: boolean;
}

// The overlay is positioned against the FIELD, not against the root, because the two are not the
// same box once the ✨ lives inside an `InputGroup`: the group carries the border the input no
// longer has, and a mirror pinned to the root paints a character-width off.
const px = (v: string) => Number.parseFloat(v) || 0;

const readField = (el: FieldEl, root: HTMLElement): FieldShape => {
  const cs = getComputedStyle(el);
  const rtl = cs.direction === "rtl";
  const box = el.getBoundingClientRect();
  const outer = root.getBoundingClientRect();
  // A scrolling textarea takes its scrollbar out of the text's width, and it takes it from the
  // inline-END side in both directions. Without this the mirror wraps a word earlier or later than
  // the field does wherever scrollbars are not overlays — which is not macOS, so it is exactly the
  // kind of divergence nobody sees here.
  const gutter = el.offsetWidth - el.clientWidth - px(cs.borderLeftWidth) - px(cs.borderRightWidth);
  const metrics: Record<string, string | number> = {
    borderStyle: "solid",
    borderColor: "transparent",
    insetBlockStart: box.top - outer.top,
    insetBlockEnd: outer.bottom - box.bottom,
    insetInlineStart: rtl ? outer.right - box.right : box.left - outer.left,
    insetInlineEnd:
      (rtl ? box.left - outer.left : outer.right - box.right) + (gutter > 0 ? gutter : 0),
  };
  for (const k of METRICS) metrics[k] = cs[k as keyof CSSStyleDeclaration] as string;
  return { metrics: metrics as React.CSSProperties, rtl };
};

const REST: FieldShape = { metrics: {}, rtl: false };

/**
 * A safety net rather than the answer. The field grows to fit its offer, so it runs out of height
 * only where a caller has pinned a `max-height` — and there a fade beats a slice.
 *
 * There were three of these. The two horizontal ones masked a continuation that overran a
 * single-line field, which is the case that no longer exists.
 */
const GHOST_FADE =
  "[mask-image:linear-gradient(to_bottom,#000_calc(100%-0.9lh),transparent)]";

/** Leading space plus the next word — what one press of the accept-a-word key takes. */
const nextWord = (ghost: string) => /^\s*\S+/.exec(ghost)?.[0] ?? "";

export interface CompleteRootProps {
  complete: (request: InlineCompletionRequest) => AsyncIterable<string>;
  value: string;
  onValueChange: (value: string) => void;
  debounceMs?: number;
  minLength?: number;
  className?: string;
  children: React.ReactNode;
}

export function CompleteRoot(props: CompleteRootProps) {
  const { complete, value, onValueChange, debounceMs, minLength, className, children } = props;
  const completion = useInlineCompletion({ complete, debounceMs, minLength });
  const fieldRef = React.useRef<FieldEl | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [caret, setCaret] = React.useState(value.length);
  const [field, setField] = React.useState<FieldShape>(REST);

  const ghost = completion.ghost;

  // Where the caret must land after WE changed the value. The browser puts it wherever it likes
  // when React writes a new `value`, and taking a word out of the middle of a sentence is the case
  // that makes it obvious.
  const landing = React.useRef<number | null>(null);

  React.useLayoutEffect(() => {
    const el = fieldRef.current;
    const at = landing.current;
    if (!el || at === null) return;
    landing.current = null;
    el.setSelectionRange(at, at);
    setCaret(at);
  }, [value]);

  // The ghost mirror wears the field's real metrics, so it aligns whatever the size/className.
  React.useLayoutEffect(() => {
    const el = fieldRef.current;
    const root = rootRef.current;
    if (!el || !root) return;
    const sync = () => setField(readField(el, root));
    sync();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  const dismiss = completion.dismiss;

  /**
   * **A range is not an insertion point, so an offer cannot survive one.**
   *
   * `selectionStart` is the HEAD of a selection, not a caret. Selecting a sentence — or pressing
   * ⌘A — moved our caret to the start of it while the offer stayed live, and the continuation was
   * then drawn from there: on top of the words it was made to follow. Taking it with Tab spliced it
   * in at the same wrong place, because `insert` splits the value at this number too.
   *
   * The fix is not to draw it somewhere else. `InlineCompletionRequest` is explicitly the
   * degenerate range — an insertion point — so while text is selected there is no place the offer
   * *could* go, and the honest answer is to let it go. Collapsing the selection asks again, which
   * costs a debounce and no more.
   */
  const syncCaret = React.useCallback(() => {
    const el = fieldRef.current;
    if (!el || landing.current !== null) return;
    const start = el.selectionStart ?? el.value.length;
    if ((el.selectionEnd ?? start) !== start) {
      dismiss();
      return;
    }
    setCaret(start);
  }, [dismiss]);

  /**
   * The caret is where the ghost is **drawn**, so ours drifting from the field's is not a missed
   * update — it paints a continuation on top of the value. Seen live: a ghost starting at character
   * zero, over the sentence it was continuing.
   *
   * `selectionchange` is the only event that reports every way a caret moves — arrows, clicks,
   * drags, Home/End, and a script calling `setSelectionRange`. `click` and `keyup` catch most of
   * them and are kept because they fire first; this catches the rest.
   */
  React.useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    const onSelectionChange = () => {
      if (document.activeElement === el) syncCaret();
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [syncCaret]);

  const onChange = React.useCallback(
    (e: React.ChangeEvent<FieldEl>) => {
      const el = e.target;
      const at = el.selectionStart ?? el.value.length;
      setCaret(at);
      onValueChange(el.value);
      completion.setValue(el.value, at);
    },
    [completion, onValueChange],
  );

  /** Put `text` in at the caret and leave the caret after it. */
  const insert = React.useCallback(
    (text: string) => {
      const next = value.slice(0, caret) + text + value.slice(caret);
      landing.current = caret + text.length;
      onValueChange(next);
      return { next, at: caret + text.length };
    },
    [caret, onValueChange, value],
  );

  const accept = React.useCallback(() => {
    if (!ghost) return;
    insert(ghost);
    completion.dismiss();
    fieldRef.current?.focus();
  }, [completion, ghost, insert]);

  // Taking one word is not a new request and not a second machine: the word goes in, the caret
  // moves past it, and the offer survives by the same rule that keeps it alive when the reader
  // types that word themselves. There used to be a `taken` offset here doing it by hand.
  const acceptWord = React.useCallback(() => {
    const word = nextWord(ghost);
    if (!word) return;
    const { next, at } = insert(word);
    completion.setValue(next, at);
  }, [completion, ghost, insert]);

  const request = React.useCallback(() => {
    const el = fieldRef.current;
    // Where the offer goes, and the two have to agree. Focusing a field nobody has focused yet puts
    // the DOM caret at 0 while our own is still at the end, and the ghost would then be drawn in one
    // place and inserted in another.
    const at = el && el === document.activeElement ? (el.selectionStart ?? caret) : caret;
    setCaret(at);
    completion.ask(value, at);
    el?.focus();
    el?.setSelectionRange(at, at);
  }, [caret, completion, value]);

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent<FieldEl>) => {
      if (e.defaultPrevented || !ghost) return;
      // Forward, not right: the key that means "next word" is mirrored under RTL, and this is the
      // one place in the compound where a key stands for a direction.
      const forward = field.rtl ? "ArrowLeft" : "ArrowRight";
      if (e.key === "Tab") {
        e.preventDefault();
        accept();
      } else if (e.key === forward && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        acceptWord();
      } else if (e.key === "Escape") {
        completion.dismiss();
      }
    },
    [accept, acceptWord, completion, field.rtl, ghost],
  );

  const ctx: CompleteCtx = {
    fieldRef, value, ghost, caret,
    rtl: field.rtl,
    status: completion.status,
    error: completion.error,
    askable: value.trim().length >= (minLength ?? MIN_COMPLETE_LENGTH),
    metrics: field.metrics,
    onChange, onKeyDown, syncCaret, accept, request,
  };

  return (
    <Ctx.Provider value={ctx}>
      <ark.div className={cn("relative w-full min-w-0", className)} data-slot="complete" ref={rootRef}>
        {children}
        {/* The ghost itself is `aria-hidden` and streams a chunk a frame, so announcing IT would
            read the same sentence twenty times. This sentence changes once, when there is
            something to take. */}
        <ark.span aria-live="polite" className="sr-only" data-slot="complete-status">
          {ghost ? "Suggestion ready. Press Tab to accept, Escape to dismiss." : ""}
        </ark.span>
      </ark.div>
    </Ctx.Provider>
  );
}

export function CompleteTextarea({ children }: { children: React.ReactElement }) {
  const ctx = useCtx("CompleteTextarea");
  return (
    <ark.textarea
      aria-keyshortcuts={ctx.ghost ? "Tab Escape" : undefined}
      asChild
      data-slot="complete-textarea"
      onChange={ctx.onChange}
      onClick={ctx.syncCaret}
      onKeyDown={ctx.onKeyDown}
      onKeyUp={ctx.syncCaret}
      onSelect={ctx.syncCaret}
      ref={ctx.fieldRef as React.Ref<HTMLTextAreaElement>}
      value={ctx.value}
    >
      {children}
    </ark.textarea>
  );
}

/**
 * The ✨, bound to the stream — the same mark `SuggestTrigger` wears, so an assisted field looks
 * assisted whichever of the two it has.
 *
 * Pressing it **takes what is on offer and asks when there is nothing**. That is one gesture with
 * two readings on purpose: it is the only way to accept without a keyboard, and the only way back
 * after Escape, which otherwise ends the field's assistance until the next keystroke.
 */
export function CompleteMark(props: Omit<AiMarkProps, "busy" | "offering">) {
  const { label = "AI assist", ...rest } = props;
  const ctx = useCtx("CompleteMark");
  const offering = ctx.ghost.length > 0;

  return (
    <AiMark
      busy={ctx.status === "loading" && !offering}
      // The one binding that legitimately differs from `SuggestMark`, and it is domain and not
      // taste: there is nothing to continue below `minLength`, while a candidate source can answer
      // from an empty field. Everything else about the two marks is bound identically.
      disabled={!offering && !ctx.askable}
      label={offering ? "Accept suggestion" : label}
      offering={offering}
      onClick={offering ? ctx.accept : ctx.request}
      {...rest}
    />
  );
}

/**
 * The continuation drawn where it will land, over the field itself. It wraps and scrolls with the
 * field rather than measuring whether a line of it fits.
 */
export function CompleteGhost({ className }: { className?: string }) {
  const ctx = useCtx("CompleteGhost");
  const boxRef = React.useRef<HTMLDivElement>(null);
  const [clipped, setClipped] = React.useState(false);

  /**
   * **A continuation that does not fit makes the field taller. It is not cut.**
   *
   * The fade below was the old answer and it was the wrong one: a wrapping field runs out of
   * *height*, and a mask on the last line still reads as a sentence sliced through the middle of a
   * line of type — with, on a `block-end` addon, the ✨ and the keys painted over the slice. Seen on
   * `docs/ai/fields`. An editor gets away with clipping because it can push the following lines
   * down; a `<textarea>` cannot, because the ghost is not in its value. So the field takes the
   * height the offer needs while the offer is on the table, and gives it back when it is not — which
   * is what a textarea does anyway when you type into it. `rows` becomes a floor rather than a fixed
   * size, which is what `rows` already means.
   *
   * **It grows and never shrinks while one offer is live.** Taking a word makes the ghost shorter,
   * and re-measuring down on every word would make the box jitter under the reader mid-sentence for
   * no gain — somebody taking a word is about to take another. It resets the moment there is no
   * ghost, which is every accept, every dismiss and every keystroke that kills the offer.
   *
   */
  React.useLayoutEffect(() => {
    const el = ctx.fieldRef.current;
    const box = boxRef.current;
    if (!el || !box) return;
    if (!ctx.ghost) {
      el.style.removeProperty("min-height");
      return;
    }
    // `minHeight` and not `height`, measured: a `block-end` addon turns the group into a column
    // flex container and the field is `flex: 1 1 0%` in it, so the flex algorithm computes the used
    // height and an explicit `height` is ignored outright — the inline `104px` was on the element
    // and the box stayed 64. Raising the floor is what the flex algorithm does honour, and it is
    // also what this means: `rows` is a floor, and the offer asks for a taller one.
    const cs = getComputedStyle(el);
    const needed = box.scrollHeight + px(cs.borderTopWidth) + px(cs.borderBottomWidth);
    if (needed > el.getBoundingClientRect().height + 1)
      el.style.setProperty("min-height", `${needed}px`);
  }, [ctx.fieldRef, ctx.ghost, ctx.value]);

  // An `overflow: hidden` box is still scrollable from script, so the mirror can be parked exactly
  // where the field parked its own text — which is what lets a ghost longer than the remaining
  // line be clipped at the edge instead of hidden entirely.
  React.useLayoutEffect(() => {
    const el = ctx.fieldRef.current;
    const box = boxRef.current;
    if (!el || !box) return;
    const sync = () => {
      box.scrollLeft = el.scrollLeft;
      box.scrollTop = el.scrollTop;
    };
    sync();
    // Does the continuation fit in the space the field actually has? Measured rather than
    // assumed, because the answer changes with the field's size, with the value, and with every
    // chunk that arrives — and after the effect above it should be `false` unless a caller pinned
    // the height.
    setClipped(box.scrollHeight > box.clientHeight);
    el.addEventListener("scroll", sync);
    return () => el.removeEventListener("scroll", sync);
  }, [ctx.caret, ctx.fieldRef, ctx.value, ctx.ghost]);


  const show = ctx.ghost.length > 0;
  // A caret past the end of the value would split it in the wrong place; the value is the authority.
  const at = Math.min(ctx.caret, ctx.value.length);

  return (
    <ark.div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden text-transparent",
        "whitespace-pre-wrap break-words",
        // **A continuation that does not fit fades; it is not guillotined.** The box is
        // `overflow: hidden`, so without this a too-long ghost ends on a hard edge — mid-letter
        // against the ✨. Applied only when the measurement above says it is genuinely cut, which
        // is now only when a caller has pinned the field's height.
        clipped && GHOST_FADE,
        !show && "invisible",
        className,
      )}
      data-slot="complete-ghost"
      ref={boxRef}
      style={ctx.metrics}
    >
      {/* The value holds its own space so the ghost starts exactly at the caret — `hidden` would
          collapse it. Split in two rather than one leading run: an offer is made *at* the caret,
          and what comes after it has to keep its place or the tail of the sentence shifts. */}
      <ark.span className="invisible">{ctx.value.slice(0, at)}</ark.span>
      <ark.span className="text-faint">{ctx.ghost}</ark.span>
      <ark.span className="invisible">{ctx.value.slice(at)}</ark.span>
    </ark.div>
  );
}

/**
 * The keys, while there is something to take.
 *
 * The compound already told one class of reader: the `sr-only` region announces *Press Tab to
 * accept, Escape to dismiss* the moment an offer lands. A sighted keyboard user got nothing —
 * `CompleteHint` carries the keys too, so a composition that uses the ghost taught the gesture
 * nowhere. This is the visible twin of that sentence, and it is a part rather than a fixture
 * because only the caller knows where it fits: beside the ✨ in a `block-end` addon, under the
 * field, nowhere at all on a form of eleven where one line of instruction beats eleven.
 *
 * There is no reference to copy. Gmail taught Tab with a popup shown once ever; Copilot puts a
 * toolbar under the pointer, which is a gesture a keyboard cannot make. Naming the key next to the
 * offer is the version that works for both.
 */
export function CompleteKeys({ className }: { className?: string }) {
  const ctx = useCtx("CompleteKeys");
  if (!ctx.ghost) return null;
  return (
    <ark.span
      className={cn("inline-flex items-center gap-2 text-muted-foreground text-xs", className)}
      data-slot="complete-keys"
    >
      <ark.span className="inline-flex items-center gap-1 whitespace-nowrap">
        <Kbd>Tab</Kbd> accept
      </ark.span>
      <ark.span className="inline-flex items-center gap-1 whitespace-nowrap">
        <Kbd>Esc</Kbd> dismiss
      </ark.span>
    </ark.span>
  );
}

/** Below-field alternative to `CompleteGhost`, for a field the overlay cannot sit over. */
export function CompleteHint({ className }: { className?: string }) {
  const ctx = useCtx("CompleteHint");
  if (!ctx.ghost) return null;
  return (
    <ark.p
      className={cn("mt-1.5 whitespace-pre-wrap break-words text-muted-foreground text-sm", className)}
      data-slot="complete-hint"
    >
      <ark.span className="text-faint">{ctx.ghost.replace(/^\s+/, "")}</ark.span>{" "}
      <CompleteKeys />
    </ark.p>
  );
}


/**
 * What went wrong, in place. Renders nothing when nothing did.
 *
 * `Suggest` has always shown its failures — the strip prints them where the candidates would be —
 * and this side showed none at all: the ✨ stopped spinning and the field said nothing, because
 * `error` was on the hook and no part read it. It is a separate part rather than a line inside
 * `CompleteHint` because the ghost surface is usually `CompleteGhost`, an overlay with no room
 * under it, and a failure has to be readable in both.
 */
export function CompleteError({ className }: { className?: string }) {
  const ctx = useCtx("CompleteError");
  if (ctx.error === null) return null;
  return (
    <ark.p
      className={cn("mt-1.5 text-destructive-foreground text-sm", className)}
      data-slot="complete-error"
      role="alert"
    >
      {ctx.error}
    </ark.p>
  );
}
