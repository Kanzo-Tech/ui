"use client";

import { ark } from "@ark-ui/react/factory";
import { Undo2Icon, XIcon } from "lucide-react";
import * as React from "react";
import type { LanguageModel } from "@kanzo-tech/llm";
import { Button, ButtonGroup, cn, Kbd, Spinner, Suggestion, Suggestions } from "@kanzo-tech/ui";
import { AiMark } from "./ai-mark.js";
import {
  type AssistEvent,
  MIN_CONTINUE_LENGTH,
  type Proposal,
  useCandidates,
  useContinuation,
} from "./engine.js";
import { type FieldBrief, candidates, continuation } from "./proposals.js";

// ── The words ────────────────────────────────────────────────────────────────

/** Every word `Assist` draws or announces. English by default; a host sets them once, on the provider. */
export interface AssistTranslations {
  /** The ✨ at rest. */
  assist: string;
  /** The ✨ while a continuation is on offer — pressing it takes it. */
  accept: string;
  /** The ✨ while candidates are on offer — pressing it asks for others. */
  others: string;
  /** The ✨ right after a value was taken — pressing it puts the old one back. */
  revert: string;
  /** Beside the `Tab` key, under a continuation. */
  acceptKey: string;
  /** Beside the `Esc` key. */
  dismissKey: string;
  /** Beside `Alt ]`. */
  nextKey: string;
  /** Read once, by a screen reader, when a continuation lands. */
  announcement: string;
  /** While candidates are on their way. */
  thinking: string;
  /** When the model had nothing to offer. */
  empty: string;
  /** When asking failed and what was thrown carries no message of its own. */
  failed: string;
  /** A candidate's ✕, given the candidate's text. */
  dismiss: (text: string) => string;
}

const ENGLISH: AssistTranslations = {
  assist: "AI assist",
  accept: "Accept suggestion",
  others: "Suggest different values",
  revert: "Undo AI suggestion",
  acceptKey: "accept",
  dismissKey: "dismiss",
  nextKey: "next",
  announcement: "Suggestion ready. Press Tab to accept, Escape to dismiss.",
  thinking: "Thinking…",
  empty: "Nothing to suggest.",
  failed: "Couldn’t suggest anything.",
  dismiss: (text) => `Dismiss ${text}`,
};

// ── The provider ─────────────────────────────────────────────────────────────

interface AssistSettings {
  model: LanguageModel;
  context?: () => string | undefined;
  onEvent?: (event: AssistEvent) => void;
  onFailure?: (error: unknown) => void;
  t: AssistTranslations;
}

const Settings = React.createContext<AssistSettings | null>(null);

export interface AssistProviderProps {
  /** The model every assisted field below asks — `gateway("complete")`. */
  model: LanguageModel;
  /**
   * What the rest of the form says, for every field below: read at the moment a field asks, so it
   * is never stale. A string, or a function returning one.
   */
  context?: string | (() => string | undefined);
  /** Each proposal's life — shown, accepted, partly accepted, rejected, ignored. */
  onEvent?: (event: AssistEvent) => void;
  /**
   * Called with what the model's stream threw, whole, when a field's ask fails — on the first
   * attempt, never retried. A model from `createGateway` that goes silent arrives as its `AiError`
   * coded `ai/silent`. The field also says so under itself.
   */
  onFailure?: (error: unknown) => void;
  translations?: Partial<AssistTranslations>;
  children: React.ReactNode;
}

/**
 * The one place a product decides how its fields are assisted: which model, what the form as a
 * whole is about, where the telemetry goes, and in what words. Renders no element.
 */
export function AssistProvider(props: AssistProviderProps) {
  const { model, context, onEvent, onFailure, translations, children } = props;
  const value = React.useMemo<AssistSettings>(
    () => ({
      model,
      context: typeof context === "function" ? context : () => context,
      onEvent,
      onFailure,
      t: { ...ENGLISH, ...translations },
    }),
    [context, model, onEvent, onFailure, translations],
  );
  return <Settings.Provider value={value}>{children}</Settings.Provider>;
}

// ── Reading the field ────────────────────────────────────────────────────────

type Control = HTMLTextAreaElement | HTMLInputElement;

const textOf = (ids: string | null) =>
  (ids ?? "")
    .split(/\s+/)
    .map((id) => (id ? document.getElementById(id)?.textContent?.trim() : ""))
    .filter(Boolean)
    .join(" ");

/**
 * What the field is, as a person filling it in is told: its accessible name and description. Ark's
 * `Field` wires the label and helper text to the control with `aria-labelledby`/`aria-describedby`,
 * so an accessible field needs nothing more — and a field without a name is a field a screen reader
 * cannot fill either.
 */
function describe(el: Control | null, instructions: string | undefined, context: string | undefined): FieldBrief {
  if (!el) return { name: "", instructions, context };
  const name =
    textOf(el.getAttribute("aria-labelledby")) ||
    [...(el.labels ?? [])].map((l) => l.textContent?.trim()).filter(Boolean).join(" ") ||
    el.getAttribute("aria-label") ||
    el.getAttribute("placeholder") ||
    "";
  return { name, description: textOf(el.getAttribute("aria-describedby")) || undefined, instructions, context };
}

// ── Geometry ─────────────────────────────────────────────────────────────────

const METRICS = [
  "fontFamily", "fontSize", "fontWeight", "fontStyle", "letterSpacing", "lineHeight",
  "textTransform", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
] as const;

const px = (v: string) => Number.parseFloat(v) || 0;

/** The box `el` occupies inside `root`, as logical insets. */
function insets(el: HTMLElement, root: HTMLElement, rtl: boolean) {
  const box = el.getBoundingClientRect();
  const outer = root.getBoundingClientRect();
  return {
    insetBlockStart: box.top - outer.top,
    insetBlockEnd: outer.bottom - box.bottom,
    insetInlineStart: rtl ? outer.right - box.right : box.left - outer.left,
    insetInlineEnd: rtl ? box.left - outer.left : outer.right - box.right,
  };
}

/** The ghost mirror wears the field's real metrics, so it aligns whatever the size or className. */
function mirror(el: Control, root: HTMLElement) {
  const cs = getComputedStyle(el);
  const rtl = cs.direction === "rtl";
  // A scrolling textarea takes its scrollbar from the inline-end side in both directions.
  const gutter = el.offsetWidth - el.clientWidth - px(cs.borderLeftWidth) - px(cs.borderRightWidth);
  const box = insets(el, root, rtl);
  const metrics: Record<string, string | number> = {
    ...box,
    insetInlineEnd: box.insetInlineEnd + (gutter > 0 ? gutter : 0),
    borderStyle: "solid",
    borderColor: "transparent",
  };
  for (const k of METRICS) metrics[k] = cs[k as keyof CSSStyleDeclaration] as string;
  return { metrics: metrics as React.CSSProperties, rtl };
}

/** Room for the ✨ inside the control's box, so typed text never runs under it. */
const MARK_ROOM = "2.25rem";

/** Leading space plus the next word — what one press of the accept-a-word key takes. */
const nextWord = (ghost: string) => /^\s*\S+/.exec(ghost)?.[0] ?? "";

const merge =
  <E,>(...handlers: (((e: E) => void) | undefined)[]) =>
  (e: E) => {
    for (const h of handlers) h?.(e);
  };

const mergeRefs =
  <T,>(...refs: (React.Ref<T> | undefined)[]) =>
  (node: T | null) => {
    for (const ref of refs) {
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.RefObject<T | null>).current = node;
    }
  };

// ── Assist ───────────────────────────────────────────────────────────────────

export interface AssistProps<V extends string | string[]> {
  /**
   * The field's value. A string is a text field — a `Textarea` gets a continuation at the caret, an
   * `Input` gets whole values to replace it with; a list is a tags field, and gets values to add.
   */
  value: V;
  onValueChange: (value: V) => void;
  /** One sentence for the model about this field, beyond its label and description. */
  instructions?: string;
  /** The control, from `@kanzo-tech/ui`: `Textarea`, `Input` or `TagsInput`. `Assist` wires it. */
  children: React.ReactElement;
  className?: string;
}

/**
 * A model-assisted field. Wrap the control; that is all.
 *
 * What it offers is one thing — a **proposal** for the field's value — drawn the way the control
 * calls for: a `Textarea` holds prose, so the proposal is a continuation drawn as ghost text at the
 * caret (Tab takes it, Ctrl/⌘+→ a word, Alt+] / Alt+[ the alternatives, Esc lets it go); a one-line
 * `Input` cannot show text beyond its width, so it gets whole values as a strip of candidates under
 * it; a `TagsInput` gets candidates to add. The ✨ inside the control marks it as assisted, asks,
 * takes, and — right after something was taken — puts the old value back.
 */
export function Assist<V extends string | string[]>(props: AssistProps<V>) {
  const settings = React.useContext(Settings);
  if (!settings) throw new Error("<Assist> must render inside <AssistProvider>");
  if (Array.isArray(props.value)) {
    return <ListAssist {...(props as unknown as AssistProps<string[]>)} settings={settings} />;
  }
  return <TextAssist {...(props as unknown as AssistProps<string>)} settings={settings} />;
}

type Inner<V extends string | string[]> = AssistProps<V> & { settings: AssistSettings };

/** The control the field reads and writes — the child itself, or the input inside a compound. */
const controlIn = (root: HTMLElement | null) =>
  root?.querySelector<Control>("textarea, input:not([type=hidden])") ?? null;

function useEvents(settings: AssistSettings, control: () => Control | null) {
  return React.useCallback(
    (kind: AssistEvent["kind"], proposal: Proposal) =>
      settings.onEvent?.({ kind, proposal, field: describe(control(), undefined, undefined).name }),
    [control, settings],
  );
}

// ── A text field: continuation (Textarea) or candidates (Input) ──────────────

function TextAssist(props: Inner<string>) {
  const { value, onValueChange, instructions, children, className, settings } = props;
  const { t } = settings;
  const rootRef = React.useRef<HTMLDivElement>(null);
  const fieldRef = React.useRef<Control | null>(null);
  const [multiline, setMultiline] = React.useState(false);
  const [shape, setShape] = React.useState<{ metrics: React.CSSProperties; rtl: boolean; mark: React.CSSProperties }>(
    { metrics: {}, rtl: false, mark: {} },
  );
  const [caret, setCaret] = React.useState(value.length);
  const [active, setActive] = React.useState(false);
  /** The value before the last proposal was taken; the ✨ puts it back until the reader edits. */
  const [before, setBefore] = React.useState<string | null>(null);
  const landing = React.useRef<number | null>(null);

  const control = React.useCallback(() => fieldRef.current, []);
  const report = useEvents(settings, control);
  const brief = () => describe(fieldRef.current, instructions, settings.context?.());

  const completion = useContinuation({
    source: (request) => continuation(settings.model, brief(), request),
    onEvent: report,
  });
  const list = useCandidates({
    source: ({ signal }) => candidates(settings.model, brief(), { value, existing: [value], signal, count: 6, list: false }),
    existing: [value],
    onEvent: report,
  });
  useReported(settings, completion);
  useReported(settings, list);
  const ghost = multiline ? completion.ghost : "";

  React.useLayoutEffect(() => {
    const el = fieldRef.current;
    const root = rootRef.current;
    if (!el || !root) return;
    setMultiline(el instanceof HTMLTextAreaElement);
    el.style.paddingInlineEnd = MARK_ROOM;
    const sync = () => {
      const m = mirror(el, root);
      const box = insets(el, root, m.rtl);
      // Bottom-end in a textarea, where the eye lands after a paragraph; vertically centred in a
      // one-line field, as an input's own addons are.
      const mark: React.CSSProperties =
        el instanceof HTMLTextAreaElement
          ? { insetInlineEnd: box.insetInlineEnd + 4, insetBlockEnd: box.insetBlockEnd + 4 }
          : { insetInlineEnd: box.insetInlineEnd + 2, insetBlockStart: box.insetBlockStart, height: el.offsetHeight };
      setShape({ ...m, mark });
    };
    sync();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  // Where the caret must land after WE changed the value; the browser puts it anywhere otherwise.
  React.useLayoutEffect(() => {
    const el = fieldRef.current;
    const at = landing.current;
    if (!el || at === null) return;
    landing.current = null;
    el.setSelectionRange(at, at);
    setCaret(at);
  }, [value]);

  /** A selection is not an insertion point, so an offer cannot survive one. */
  const syncCaret = React.useCallback(() => {
    const el = fieldRef.current;
    if (!el || landing.current !== null) return;
    const start = el.selectionStart ?? el.value.length;
    if ((el.selectionEnd ?? start) !== start) {
      completion.dismiss("ignored");
      return;
    }
    setCaret(start);
  }, [completion]);

  React.useEffect(() => {
    const onSelectionChange = () => {
      if (document.activeElement === fieldRef.current) syncCaret();
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [syncCaret]);

  const put = (next: string, at: number) => {
    landing.current = at;
    onValueChange(next);
  };

  const accept = () => {
    if (!ghost) return;
    setBefore(value);
    put(value.slice(0, caret) + ghost + value.slice(caret), caret + ghost.length);
    completion.settle("accepted", ghost);
    fieldRef.current?.focus();
  };

  const acceptWord = () => {
    const word = nextWord(ghost);
    if (!word) return;
    const next = value.slice(0, caret) + word + value.slice(caret);
    put(next, caret + word.length);
    completion.settle("partial", word);
    completion.setValue(next, caret + word.length);
  };

  const pick = (text: string) => {
    setBefore(value);
    put(text, text.length);
    list.take(text);
  };

  const revert = () => {
    if (before === null) return;
    put(before, before.length);
    setBefore(null);
    fieldRef.current?.focus();
  };

  const request = () => {
    const el = fieldRef.current;
    const at = el && el === document.activeElement ? (el.selectionStart ?? caret) : caret;
    setCaret(at);
    completion.ask(value, at);
    el?.focus();
    el?.setSelectionRange(at, at);
  };

  const onChange = (e: React.ChangeEvent<Control>) => {
    const el = e.target;
    const at = el.selectionStart ?? el.value.length;
    setCaret(at);
    setBefore(null);
    onValueChange(el.value);
    if (multiline) completion.setValue(el.value, at);
  };

  const onKeyDown = (e: React.KeyboardEvent<Control>) => {
    if (e.defaultPrevented) return;
    if (!multiline) {
      if (e.key === "Escape" && list.items.length > 0) list.cancel();
      return;
    }
    // Forward, not right: "next word" is mirrored under RTL.
    const forward = shape.rtl ? "ArrowLeft" : "ArrowRight";
    if (e.altKey && (e.key === "]" || e.key === "[" || e.code === "BracketRight" || e.code === "BracketLeft")) {
      e.preventDefault();
      completion.cycle(e.key === "]" || e.code === "BracketRight" ? 1 : -1);
      return;
    }
    if (!ghost) return;
    if (e.key === "Tab") {
      e.preventDefault();
      accept();
    } else if (e.key === forward && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      acceptWord();
    } else if (e.key === "Escape") {
      completion.dismiss("rejected");
    }
  };

  const child = children as React.ReactElement<Record<string, unknown>>;
  const own = child.props;
  const field = React.cloneElement(child, {
    value,
    onChange: merge(own.onChange as never, onChange),
    onKeyDown: merge(own.onKeyDown as never, onKeyDown),
    onClick: merge(own.onClick as never, syncCaret),
    onKeyUp: merge(own.onKeyUp as never, syncCaret),
    onSelect: merge(own.onSelect as never, syncCaret),
    ref: mergeRefs(own.ref as React.Ref<Control>, fieldRef),
    "aria-keyshortcuts": ghost ? "Tab Escape Alt+]" : undefined,
  });

  const offering = multiline ? ghost.length > 0 : list.items.length > 0;
  const busy = (multiline ? completion.status : list.status) === "loading" && !offering;
  const reverting = before !== null && !offering;
  const askable = !multiline || value.trim().length >= MIN_CONTINUE_LENGTH;

  return (
    <ark.div
      className={cn("relative flex w-full min-w-0 flex-col gap-2", className)}
      data-slot="assist"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setActive(false);
      }}
      onFocus={() => setActive(true)}
      ref={rootRef}
    >
      {field}
      {multiline && <Ghost caret={caret} field={fieldRef} ghost={ghost} metrics={shape.metrics} value={value} />}
      <ark.span
        className={cn("absolute flex items-center", shape.mark.insetInlineEnd === undefined && "invisible")}
        data-slot="assist-mark"
        style={shape.mark}
      >
        {reverting ? (
          <AiMark label={t.revert} onClick={revert}>
            <Undo2Icon />
          </AiMark>
        ) : (
          <AiMark
            busy={busy}
            disabled={!offering && !askable}
            label={offering ? (multiline ? t.accept : t.others) : t.assist}
            offering={offering}
            onClick={multiline ? (offering ? accept : request) : list.press}
          />
        )}
      </ark.span>
      {multiline ? (
        <>
          {ghost && <Keys t={t} />}
          <span aria-live="polite" className="sr-only" data-slot="assist-status">
            {ghost ? t.announcement : ""}
          </span>
          <Failure error={completion.error} status={completion.status} t={t} />
        </>
      ) : (
        active && <Candidates list={list} onPick={pick} t={t} />
      )}
    </ark.div>
  );
}

/** The continuation drawn where it lands, over the field; the field grows to hold it. */
function Ghost(props: {
  field: React.RefObject<Control | null>;
  ghost: string;
  value: string;
  caret: number;
  metrics: React.CSSProperties;
}) {
  const { field, ghost, value, caret, metrics } = props;
  const boxRef = React.useRef<HTMLDivElement>(null);

  // `rows` is a floor: while an offer is on the table the field takes the height it needs, and
  // gives it back when there is none — what a textarea does anyway when you type into it.
  React.useLayoutEffect(() => {
    const el = field.current;
    const box = boxRef.current;
    if (!el || !box) return;
    if (!ghost) {
      el.style.removeProperty("min-height");
      return;
    }
    const cs = getComputedStyle(el);
    const needed = box.scrollHeight + px(cs.borderTopWidth) + px(cs.borderBottomWidth);
    if (needed > el.getBoundingClientRect().height + 1) el.style.setProperty("min-height", `${needed}px`);
  }, [field, ghost, value]);

  React.useLayoutEffect(() => {
    const el = field.current;
    const box = boxRef.current;
    if (!el || !box) return;
    const sync = () => {
      box.scrollLeft = el.scrollLeft;
      box.scrollTop = el.scrollTop;
    };
    sync();
    el.addEventListener("scroll", sync);
    return () => el.removeEventListener("scroll", sync);
  }, [caret, field, ghost, value]);

  const at = Math.min(caret, value.length);
  return (
    <ark.div
      aria-hidden
      className={cn(
        "pointer-events-none absolute overflow-hidden whitespace-pre-wrap break-words text-transparent",
        !ghost && "invisible",
      )}
      data-slot="assist-ghost"
      ref={boxRef}
      style={metrics}
    >
      <span className="invisible">{value.slice(0, at)}</span>
      <span className="text-faint">{ghost}</span>
      <span className="invisible">{value.slice(at)}</span>
    </ark.div>
  );
}

/** The keys, while there is something to take: the visible twin of the screen-reader announcement. */
function Keys({ t }: { t: AssistTranslations }) {
  return (
    <ark.span className="inline-flex flex-wrap items-center gap-3 text-muted-foreground text-xs" data-slot="assist-keys">
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        <Kbd>Tab</Kbd> {t.acceptKey}
      </span>
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        <Kbd>Alt ]</Kbd> {t.nextKey}
      </span>
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        <Kbd>Esc</Kbd> {t.dismissKey}
      </span>
    </ark.span>
  );
}

/** Hands the provider's `onFailure` each failure once, whether or not the field is showing it. */
function useReported(settings: AssistSettings, stream: { status: string; error: unknown }) {
  const { onFailure } = settings;
  const { status, error } = stream;
  React.useEffect(() => {
    if (status === "error") onFailure?.(error);
  }, [status, error, onFailure]);
}

function Failure(props: { error: unknown; status: string; t: AssistTranslations }) {
  const { error, status, t } = props;
  if (status !== "error") return null;
  return (
    <ark.p className="text-destructive-foreground text-sm" data-slot="assist-error" role="alert">
      {error instanceof Error && error.message ? error.message : t.failed}
    </ark.p>
  );
}

/**
 * The strip, in the flow under the field, while it has focus. Two buttons per candidate in a group —
 * a `<button>` cannot hold a button — and the ✕ always drawn: a hover-only control is unreachable by
 * keyboard and absent on touch. The rationale is the pill's `title`: it reaches the keyboard through
 * focus and costs no box.
 */
function Candidates(props: {
  list: ReturnType<typeof useCandidates>;
  onPick: (text: string) => void;
  t: AssistTranslations;
}) {
  const { list, onPick, t } = props;
  const body =
    list.status === "error" ? (
      <Failure error={list.error} status={list.status} t={t} />
    ) : list.items.length > 0 ? (
      list.items.map((item) => (
        <ButtonGroup aria-label={item.text} key={item.text} slot="assist-candidate">
          <Suggestion onSelect={onPick} title={item.rationale} value={item.text}>
            {item.text}
          </Suggestion>
          <Button
            aria-label={t.dismiss(item.text)}
            className="h-auto min-h-[24px] self-stretch px-2 py-1"
            onClick={() => list.dismiss(item.text)}
            pill
            size="sm"
            slot="assist-dismiss"
            variant="outline"
          >
            <XIcon />
          </Button>
        </ButtonGroup>
      ))
    ) : list.status === "loading" ? (
      <span className="inline-flex items-center gap-2 text-muted-foreground text-sm" data-slot="assist-pending">
        <Spinner aria-hidden />
        {t.thinking}
      </span>
    ) : list.status === "ready" ? (
      <span className="text-muted-foreground text-sm" data-slot="assist-empty">
        {t.empty}
      </span>
    ) : null;

  if (body === null) return null;
  return (
    <Suggestions className="min-h-8" slot="assist-candidates">
      {body}
    </Suggestions>
  );
}

// ── A list field: candidates to add ──────────────────────────────────────────

function ListAssist(props: Inner<string[]>) {
  const { value, onValueChange, instructions, children, className, settings } = props;
  const { t } = settings;
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [active, setActive] = React.useState(false);
  const [mark, setMark] = React.useState<React.CSSProperties>({});

  const control = React.useCallback(() => controlIn(rootRef.current), []);
  const report = useEvents(settings, control);
  const list = useCandidates({
    source: ({ signal }) =>
      candidates(settings.model, describe(control(), instructions, settings.context?.()), {
        value: "",
        existing: value,
        signal,
        count: 6,
        list: true,
      }),
    existing: value,
    onEvent: report,
  });
  useReported(settings, list);

  // The ✨ sits at the end of the control's own box — Ark marks it `data-part="control"`.
  React.useLayoutEffect(() => {
    const root = rootRef.current;
    const box = root?.querySelector<HTMLElement>("[data-part=control]") ?? (root?.firstElementChild as HTMLElement | null);
    if (!root || !box) return;
    box.style.paddingInlineEnd = MARK_ROOM;
    const sync = () => {
      const rtl = getComputedStyle(box).direction === "rtl";
      const b = insets(box, root, rtl);
      setMark({ insetInlineEnd: b.insetInlineEnd + 2, insetBlockStart: b.insetBlockStart, height: box.offsetHeight });
    };
    sync();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(sync);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  const child = children as React.ReactElement<Record<string, unknown>>;
  const own = child.props;
  const field = React.cloneElement(child, {
    value,
    onValueChange: merge(own.onValueChange as never, (details: { value: string[] }) => onValueChange(details.value)),
  });

  const offering = list.items.length > 0;
  return (
    <ark.div
      className={cn("relative flex w-full min-w-0 flex-col gap-2", className)}
      data-slot="assist"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setActive(false);
      }}
      onFocus={() => setActive(true)}
      ref={rootRef}
    >
      {field}
      <ark.span
        className={cn("absolute flex items-center", mark.insetInlineEnd === undefined && "invisible")}
        data-slot="assist-mark"
        style={mark}
      >
        <AiMark
          busy={list.status === "loading" && !offering}
          label={offering ? t.others : t.assist}
          offering={offering}
          onClick={list.press}
        />
      </ark.span>
      {active && (
        <Candidates
          list={list}
          onPick={(text) => {
            onValueChange([...value, text]);
            list.take(text);
          }}
          t={t}
        />
      )}
    </ark.div>
  );
}
