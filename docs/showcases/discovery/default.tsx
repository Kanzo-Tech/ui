"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import {
  Badge,
  Clipboard,
  ClipboardTrigger,
  Separator,
  ShellAside,
  ShellBody,
  ShellHeader,
  ShellMain,
  ShellRoot,
  Show,
  ToggleGroup,
  ToggleGroupItem,
} from "@kanzo-tech/ui";
import {
  CompleteHint,
  CompleteRoot,
  CompleteTextarea,
  Conversation,
  ConversationContent,
  ConversationEmpty,
  ConversationScrollButton,
  Message,
  MessageContent,
  MessageList,
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
  type RunState,
  SuggestList,
  SuggestMark,
  SuggestRoot,
  Task,
  TaskList,
  TaskStatus,
  TaskTitle,
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
  useAiStream,
} from "@kanzo-tech/ai";
import { SparklesIcon } from "lucide-react";
import {
  type AskEvent,
  askStream,
  askSuggestions,
  completeQuestion,
  type Phase,
  type Recipe,
  RELATIONS,
} from "./data";
import { ResultTable } from "./result-table";

/**
 * Discovery — a question over a corpus, answered by a statement somebody can read.
 *
 * The screen this rebuilds is a text-to-SQL panel written by hand: a message type carrying `sql`,
 * `reasoning`, `explanation`, an error `code` and a `phase` string, with the phase rendered as a
 * spinner and a word, the three readings of one answer as a bare `ToggleGroup`, and the result as
 * a `<Table>` assembled in place from `Object.keys(data[0])`. Every one of those is a component
 * here: `Task` for the phases, `Tool` for the call and its four states, `ToolOutput` for the three
 * readings, `DataTableRoot` for the rows.
 *
 * What it demonstrates that a JSON prop could not: `ToolInput` and `ToolOutput` take **children**.
 * The output of this call is a result set with columns nobody knew until the statement was
 * written, so it is a real table — and the same output read as prose or as the statement itself is
 * the same slot, switched.
 */
const STEPS = [
  { phase: "generating", title: "Write a statement" },
  { phase: "executing", title: "Run it over the archive" },
  { phase: "explaining", title: "Read the rows back" },
] as const satisfies readonly { phase: Phase; title: string }[];

const ORDER: Phase[] = ["generating", "executing", "explaining", "done"];

interface Turn {
  id: number;
  question: string;
  phase: Phase;
  reasoning: string;
  recipe: Recipe | null;
  explanation: string;
  failure: string | null;
  /** The phase the run stopped in, which is the step that wears the failure. */
  failedAt: Phase | null;
}

function apply(turn: Turn, event: AskEvent): Turn {
  switch (event.kind) {
    case "phase":
      return { ...turn, phase: event.phase };
    case "reasoning":
      return { ...turn, reasoning: turn.reasoning + event.text };
    case "plan":
      return { ...turn, recipe: event.recipe };
    case "explain":
      return { ...turn, explanation: turn.explanation + event.text };
    case "failed":
      return { ...turn, failure: event.message, failedAt: turn.phase };
  }
}

function stepState(step: Phase, turn: Turn): RunState {
  const mine = ORDER.indexOf(step);
  if (turn.failedAt) {
    const broke = ORDER.indexOf(turn.failedAt);
    if (mine < broke) return "done";
    return mine === broke ? "failed" : "pending";
  }
  const at = ORDER.indexOf(turn.phase);
  if (mine < at) return "done";
  return mine === at ? "running" : "pending";
}

function toolState(turn: Turn): RunState {
  if (turn.failure) return "failed";
  if (!turn.recipe) return "pending";
  return turn.phase === "done" ? "done" : "running";
}

type View = "explanation" | "results" | "query";

/** The call, and the one answer read three ways. */
function ToolCall(props: { turn: Turn; recipe: Recipe }) {
  const { turn, recipe } = props;
  const [view, setView] = useState<View>("explanation");
  const [open, setOpen] = useState<boolean | null>(null);
  const rows = useMemo(() => recipe.run(), [recipe]);
  const state = toolState(turn);

  // `Tool`'s self-opening is a `defaultOpen`, read once at mount — and this call is mounted the
  // moment the agent plans it, while it is still running, so the open it promises on `done` never
  // fires. Controlled here, and a reader's own toggle wins from then on.
  return (
    <Tool
      onOpenChange={(details) => setOpen(details.open)}
      open={open ?? (state === "done" || state === "failed")}
      state={state}
    >
      <ToolHeader>query · {recipe.relation}</ToolHeader>
      <ToolContent>
        <ToolInput>
          <p className="text-muted-foreground text-xs">Asked of the archive</p>
          <p className="text-sm leading-relaxed">{turn.question}</p>
        </ToolInput>

        <ToolOutput>
          {/* `&&`, not `Show`: the branch dereferences a message that is usually absent. */}
          {turn.failure && (
            <p className="text-sm leading-relaxed">{turn.failure}</p>
          )}

          <Show when={turn.failure === null}>
            <div className="flex flex-col gap-2">
              {/* Single-select and never empty: three readings of one answer, and dropping the
                  last one would leave the panel showing nothing at all. */}
              <ToggleGroup
                aria-label="How to read the answer"
                multiple={false}
                onValueChange={(details) => {
                  const next = details.value[0] as View | undefined;
                  if (next) setView(next);
                }}
                size="sm"
                value={[view]}
                variant="outline"
              >
                <ToggleGroupItem value="explanation">Explain</ToggleGroupItem>
                <ToggleGroupItem value="results">Results</ToggleGroupItem>
                <ToggleGroupItem value="query">SQL</ToggleGroupItem>
              </ToggleGroup>

              <Show when={view === "explanation"}>
                <Show
                  fallback={
                    <p className="text-muted-foreground text-sm">
                      Reading the rows…
                    </p>
                  }
                  when={turn.explanation.length > 0}
                >
                  <p className="text-sm leading-relaxed">{turn.explanation}</p>
                </Show>
              </Show>

              <Show when={view === "results"}>
                <ResultTable columns={recipe.columns} rows={rows} />
              </Show>

              <Show when={view === "query"}>
                <div className="relative">
                  <pre className="overflow-x-auto rounded-md bg-muted p-3 pe-10 font-mono text-xs leading-relaxed">
                    {recipe.sql}
                  </pre>
                  <Clipboard
                    className="absolute end-1 top-1"
                    value={recipe.sql}
                  >
                    <ClipboardTrigger aria-label="Copy the statement" />
                  </Clipboard>
                </div>
              </Show>
            </div>
          </Show>
        </ToolOutput>
      </ToolContent>
    </Tool>
  );
}

function Answer(props: { turn: Turn }) {
  const { turn } = props;

  return (
    <>
      <TaskList>
        {STEPS.map((step) => (
          <Task key={step.phase} state={stepState(step.phase, turn)}>
            <TaskStatus />
            <TaskTitle>{step.title}</TaskTitle>
          </Task>
        ))}
      </TaskList>

      <Show when={turn.reasoning.length > 0}>
        <Reasoning streaming={turn.phase === "generating"}>
          <ReasoningTrigger />
          <ReasoningContent>{turn.reasoning}</ReasoningContent>
        </Reasoning>
      </Show>

      {turn.recipe && <ToolCall recipe={turn.recipe} turn={turn} />}

      {/* Nothing matched at all, so there is no call to fold the message into. */}
      {turn.recipe === null && turn.failure && (
        <p className="text-warning text-sm leading-relaxed">{turn.failure}</p>
      )}
    </>
  );
}

/** The schema the agent is given before it writes anything — the reader gets the same thing. */
function Schema() {
  return (
    <ShellAside
      aria-label="The archive"
      className="hidden overflow-y-auto bg-card p-3 md:flex"
      side="start"
      width={288}
    >
      <p className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
        The archive
      </p>
      <div className="flex flex-col gap-4">
        {RELATIONS.map((relation) => (
          <section key={relation.name}>
            <h2 className="flex items-center gap-2 font-mono text-sm">
              {relation.name}
              <Badge size="sm" variant="outline">
                {relation.rows} rows
              </Badge>
            </h2>
            <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
              {relation.note}
            </p>
            <Separator className="my-2" />
            <ul className="flex flex-col gap-0.5 font-mono text-[11px] text-muted-foreground">
              {relation.columns.map((column) => (
                <li key={column}>{column}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </ShellAside>
  );
}

export function DiscoveryShowcase() {
  const engine = useAiStream<AskEvent>("The agent stopped answering");
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const nextTurn = useRef(0);
  const live = useRef<number | null>(null);

  const patch = (id: number, event: AskEvent) =>
    setTurns((prev) =>
      prev.map((turn) => (turn.id === id ? apply(turn, event) : turn))
    );

  const submit = (asked: string) => {
    const text = asked.trim();
    if (text.length === 0) return;
    const id = nextTurn.current++;
    live.current = id;
    setQuestion("");
    setTurns((prev) => [
      ...prev,
      {
        id,
        question: text,
        phase: "generating",
        reasoning: "",
        recipe: null,
        explanation: "",
        failure: null,
        failedAt: null,
      },
    ]);

    // No loop, no captured signal, no double abort check: `run` owns the iterator and a superseded
    // run cannot reach `patch`, because the controller it is checking is a local of that run.
    void engine.run(
      (signal) => askStream(text, signal),
      (event) => patch(id, event),
    );
  };

  const stop = () => {
    engine.cancel();
    const id = live.current;
    if (id !== null) patch(id, { kind: "failed", message: "Stopped." });
  };

  return (
    <ShellRoot className="bg-background">
      <ShellHeader className="gap-1 px-4 py-3">
        <h1 className="font-semibold text-lg">Discovery</h1>
        <p className="text-muted-foreground text-sm">
          Ask the Guild&rsquo;s archive a question. The phrasing is canned; the
          statement, the rows and every number in the answer are not.
        </p>
      </ShellHeader>

      <ShellBody>
        <Schema />

        <ShellMain className="min-h-0 overflow-hidden">
          <Conversation>
            <ConversationContent className="mx-auto w-full max-w-3xl">
              <Show when={turns.length === 0}>
                <ConversationEmpty>
                  <SparklesIcon />
                  <p className="max-w-sm">
                    Ask about the contracts or the roster. The ✨ button lists
                    the questions this agent can answer; anything else it
                    refuses rather than guesses.
                  </p>
                </ConversationEmpty>
              </Show>

              <MessageList>
                {turns.map((turn) => (
                  <Fragment key={turn.id}>
                    <Message role="user">
                      <MessageContent>{turn.question}</MessageContent>
                    </Message>
                    <Message role="assistant">
                      <MessageContent>
                        <Answer turn={turn} />
                      </MessageContent>
                    </Message>
                  </Fragment>
                ))}
              </MessageList>
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          {/* `CompleteRoot` wraps the composer rather than sitting inside it: `PromptInput` IS the
              `InputGroup`, whose recipe selects its own direct children, and the root's `<div>`
              between the two silently unsets half of it. */}
          <div className="shrink-0 border-t border-border p-3">
            <div className="mx-auto w-full max-w-3xl">
              {/* `SuggestRoot` outside the composer and `CompleteRoot` inside it, and that order
                  is not arbitrary: the strip belongs under the whole composer, while `PromptInput`
                  IS the `InputGroup` whose recipe selects its own direct children. */}
              <SuggestRoot
                onPick={(value) => {
                  setQuestion(value);
                  submit(value);
                }}
                suggest={askSuggestions}
              >
                <CompleteRoot
                  complete={completeQuestion}
                  onValueChange={setQuestion}
                  value={question}
                >
                  <PromptInput
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (engine.status === "loading") {
                        stop();
                        return;
                      }
                      submit(question);
                    }}
                  >
                    <CompleteTextarea>
                      <PromptInputTextarea
                        className="resize-none"
                        placeholder="Ask about the archive…"
                      />
                    </CompleteTextarea>
                    <PromptInputToolbar>
                      <SuggestMark label="Suggest a question" />
                      <PromptInputSubmit
                        disabled={
                          engine.status !== "loading" &&
                          question.trim().length === 0
                        }
                        status={engine.status}
                      />
                    </PromptInputToolbar>
                  </PromptInput>
                  <CompleteHint />
                </CompleteRoot>
                <SuggestList />
              </SuggestRoot>
            </div>
          </div>
        </ShellMain>
      </ShellBody>
    </ShellRoot>
  );
}
