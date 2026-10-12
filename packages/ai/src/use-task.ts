"use client";

import type { LanguageModel } from "ai";
import * as React from "react";
import { propose, verify, type Proposal, type TaskDefinition } from "./task/index.js";

/** Where a list of proposals is: never asked, being asked, answered, or failed. */
export type TaskListState = "idle" | "proposing" | "ready" | "failed";

export interface UseTaskOptions {
  model: LanguageModel;
  /** How many to ask for. Default 5. */
  count?: number;
}

export interface TaskList<A> {
  /** The proposals on offer, each accepted by the Task's oracles — or edited, and checked again. */
  proposals: readonly Proposal<A>[];
  state: TaskListState;
  /** What stopped the last request, whole. */
  error: unknown;
  /** Ask for a fresh list, replacing the one on offer. */
  propose(): void;
  /** Take a proposal off the list: the person turned it down. */
  dismiss(id: string): void;
  /**
   * A proposal, as the person changed it: checked by the oracles with no model (`verify`), and kept
   * with that verdict — an edit the oracles refuse stays, saying why, for the person to fix.
   */
  edit(id: string, value: A): Promise<void>;
}

/**
 * A screen's list of what a Task offers: `propose` behind React state. The proposals are asked for
 * when the screen says (`propose()`), never on mount, because a model call is the expensive part
 * and the input is usually still being filled. Taking one is the screen's: its `target` says where
 * it lands, and the screen owns that document.
 */
export function useTask<I, A, C>(task: TaskDefinition<I, A, C>, input: I, options: UseTaskOptions): TaskList<A> {
  const [proposals, setProposals] = React.useState<readonly Proposal<A>[]>([]);
  const [state, setState] = React.useState<TaskListState>("idle");
  const [error, setError] = React.useState<unknown>(undefined);
  const asked = React.useRef<AbortController | null>(null);
  // The latest of each, read when called: a screen re-renders with a new input object every time.
  const latest = React.useRef({ task, input, options });
  latest.current = { task, input, options };

  React.useEffect(() => () => asked.current?.abort(), []);

  return {
    proposals,
    state,
    error,
    propose() {
      asked.current?.abort();
      const controller = new AbortController();
      asked.current = controller;
      const { task, input, options } = latest.current;
      setState("proposing");
      setError(undefined);
      propose(task, input, { model: options.model, count: options.count ?? 5, signal: controller.signal }).then(
        (offered) => {
          if (controller.signal.aborted) return;
          setProposals(offered);
          setState("ready");
        },
        (reason: unknown) => {
          if (controller.signal.aborted) return;
          setError(reason);
          setState("failed");
        },
      );
    },
    dismiss(id) {
      setProposals((current) => current.filter((p) => p.id !== id));
    },
    async edit(id, value) {
      const { task, input } = latest.current;
      const verdict = await verify(task, value, input);
      setProposals((current) => current.map((p) => (p.id === id ? { ...p, value, verdict } : p)));
    },
  };
}
