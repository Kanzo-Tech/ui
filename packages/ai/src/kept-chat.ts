"use client";

import { safeValidateUIMessages, type UIMessage, type validateUIMessages } from "ai";
import * as React from "react";

/** What of a part is stored: the part as kept — rewritten, or as it is — or `undefined` to drop it. */
export type KeepPart<M extends UIMessage> = (part: M["parts"][number], message: M) => M["parts"][number] | undefined;

/**
 * A chat kept as the AI SDK keeps one: the `UIMessage[]` of a chat id, read by `load` and written by
 * `save` — the host's two functions, over whatever store it has.
 */
export interface KeptChatOptions<M extends UIMessage> {
  /** The chat's id: what `load` reads and `save` writes. A new id is a new chat. */
  id: string;
  /**
   * The chat's messages as they were saved — `[]` for a chat never saved — read once per `id`,
   * before the first turn. What it answers is untrusted: it is validated before anything draws it.
   */
  load: (id: string, options: { signal: AbortSignal }) => Promise<unknown>;
  /** Writes the chat's messages, all of them, as `keep` left them. One save at a time per `id`. */
  save: (id: string, messages: M[]) => Promise<unknown> | void;
  /** What of each part is stored: drop reasoning, keep an answer's spec and not its rows. Every part, by default. */
  keep?: KeepPart<M>;
}

type Validation<M extends UIMessage> = Parameters<typeof validateUIMessages<M>>[0];

/** What a kept chat is validated with: the schemas `useChat` takes, and the tools its parts call. */
export type KeptChatSchemas<M extends UIMessage> = {
  dataPartSchemas?: Validation<M>["dataSchemas"];
  messageMetadataSchema?: Validation<M>["metadataSchema"];
  tools?: Validation<M>["tools"];
};

/**
 * Where a kept chat stands: read (`loading`), open (`ready`), unreadable (`failed`) — `load` threw or
 * what it answered did not validate — or open with its last save refused (`unsaved`).
 */
export type KeptState = "loading" | "ready" | "failed" | "unsaved";

export interface KeptChat<M extends UIMessage> {
  state: KeptState;
  /** The messages `load` answered, validated; `undefined` until they are, and when they were not. */
  messages: M[] | undefined;
  /** Why the chat could not be read, or its last save refused — the value thrown, whole. */
  error: unknown;
  /**
   * Writes `messages` through `keep`, validated as a load is, after every save before it. It
   * settles when this one is written, and never writes over a chat that could not be read.
   */
  save: (messages: M[]) => Promise<void>;
}

type Read<M extends UIMessage> =
  | { id: string; state: "loading" }
  | { id: string; state: "ready"; messages: M[] }
  | { id: string; state: "failed"; error: unknown };

/** The mechanism under `useKeptChat` and the chat hooks; nothing at all when the chat is not kept. */
export function useKept<M extends UIMessage>(options: (KeptChatOptions<M> & KeptChatSchemas<M>) | undefined): KeptChat<M> | undefined {
  const id = options?.id;
  const latest = React.useRef(options);
  latest.current = options;
  const [read, setRead] = React.useState<Read<M> | undefined>(undefined);
  const [saved, setSaved] = React.useState<{ id: string; error?: unknown } | undefined>(undefined);
  // Saves go one after the other, behind the load: the first waits for the chat to be read, and a
  // chat that could not be read is never written over. The load is the effect's, so a second run of
  // it (React's strict mode) replaces the first.
  const queue = React.useRef<{ loaded: Promise<unknown>; tail: Promise<unknown> }>({ loaded: Promise.resolve(), tail: Promise.resolve() });

  React.useEffect(() => {
    const current = latest.current;
    if (id === undefined || current === undefined) return;
    const controller = new AbortController();
    setRead({ id, state: "loading" });
    const loading = (async () => {
      return validated<M>(await current.load(id, { signal: controller.signal }), current);
    })();
    queue.current = { loaded: loading, tail: Promise.resolve() };
    loading.then(
      (messages) => !controller.signal.aborted && setRead({ id, state: "ready", messages }),
      (error: unknown) => !controller.signal.aborted && setRead({ id, state: "failed", error }),
    );
    return () => controller.abort();
  }, [id]);

  const save = React.useCallback(
    (messages: M[]) => {
      const { loaded, tail } = queue.current;
      const write = tail.then(async () => {
        await loaded;
        const current = latest.current;
        if (current === undefined || id === undefined) return;
        const keep = current.keep;
        // A message `keep` leaves no part of is not stored: the AI SDK reads none back.
        const kept = keep
          ? messages.flatMap((m) => {
              const parts = m.parts.flatMap((p) => keep(p, m) ?? []);
              return parts.length > 0 ? [{ ...m, parts }] : [];
            })
          : messages;
        // What `keep` left must still read back: refused here, not on the next load.
        await current.save(id, await validated<M>(kept, current));
      });
      queue.current.tail = write.catch(() => undefined); // The caller hears this failure; the next save still goes.
      write.then(
        () => id !== undefined && setSaved({ id }),
        (error: unknown) => id !== undefined && setSaved({ id, error }),
      );
      return write;
    },
    [id],
  );

  if (id === undefined) return undefined;
  if (read === undefined || read.id !== id || read.state === "loading") return { state: "loading", messages: undefined, error: undefined, save };
  if (read.state === "failed") return { state: "failed", messages: undefined, error: read.error, save };
  const refused = saved?.id === id && "error" in saved;
  return { state: refused ? "unsaved" : "ready", messages: read.messages, error: refused ? saved.error : undefined, save };
}

/**
 * `messages` as the AI SDK validates them — `validateUIMessages`, with the data parts' schemas — but a
 * chat never saved, `[]`, which the AI SDK refuses as a list to send, is a chat with no messages yet.
 */
async function validated<M extends UIMessage>(messages: unknown, schemas: KeptChatSchemas<M>): Promise<M[]> {
  if (Array.isArray(messages) && messages.length === 0) return [];
  const valid = await safeValidateUIMessages<M>({ messages, ...schemasOf(schemas) });
  if (!valid.success) throw valid.error;
  return valid.data;
}

const schemasOf = <M extends UIMessage>({ dataPartSchemas, messageMetadataSchema, tools }: KeptChatSchemas<M>): Partial<Validation<M>> => ({
  ...(dataPartSchemas ? { dataSchemas: dataPartSchemas } : {}),
  ...(messageMetadataSchema ? { metadataSchema: messageMetadataSchema } : {}),
  ...(tools ? { tools } : {}),
});

/**
 * A chat kept as the AI SDK keeps one, for a transcript the host draws itself: `load` read once per
 * `id` and validated with the data parts' schemas, `save` one at a time through `keep`. The chat
 * hooks take the same `load`, `save` and `keep` and do this for `useChat`; this is the same thing for
 * a conversation whose messages are not `useChat`'s.
 *
 * A chat whose stored messages do not validate is `failed`, with what was thrown: it is never
 * opened empty in their place, and never saved over.
 */
export function useKeptChat<M extends UIMessage>(options: KeptChatOptions<M> & KeptChatSchemas<M>): KeptChat<M> {
  return useKept(options)!;
}
