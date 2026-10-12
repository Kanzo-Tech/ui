"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Collapsible,
  CollapsibleContent,
  CollapsibleIndicator,
  CollapsibleTrigger,
  Field,
  FieldLabel,
  FormatNumber,
  Input,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
  ShellAside,
  ShellBody,
  ShellFooter,
  ShellHeader,
  ShellMain,
  ShellRoot,
  Show,
  Spinner,
  StatDescription,
  StatLabel,
  StatRoot,
  StatValue,
  Steps,
  StepsContent,
  StepsIndicator,
  StepsItem,
  StepsList,
  StepsNext,
  StepsPrevious,
  StepsSeparator,
  StepsTitle,
  StepsTrigger,
  Switch,
} from "@kanzo-tech/ui";
import { useTask, type TaskList } from "@kanzo-tech/ai";
import { runTask, type Diagnostic } from "@kanzo-tech/ai/task";
import { CheckIcon, CircleAlertIcon, FileTextIcon, LinkIcon, SparklesIcon, XIcon } from "lucide-react";
import { ANSWERS, LINKS, SOURCES, say } from "./data";
import { fossilOf, modelOf, type Shape } from "./model";
import { grounding, grounds, model, questions, type Question } from "./tasks";

/** "a laureate", "an institution". */
const article = (noun: string) => `${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;

const STEPS = ["Questions", "Model", "Result"] as const;

/**
 * The assistant — from a few files to a graph, without the person meeting ShEx or Fossil.
 *
 * Three screens, one Task each: the questions are the requirements Task (`useTask` proposes them,
 * and a typed one goes through the same oracle), the model is computed from the questions and the
 * profile, and the result runs the questions against what was built. The model writes nothing the
 * data cannot back: a question that needs a column no file has is dropped before it is shown, or
 * — when the person typed it — kept on screen saying why.
 */
export function AssistantShowcase() {
  const [step, setStep] = useState(0);
  const [domain, setDomain] = useState("The Nobel prizes: who won them, in what, when, and from which institution");
  const offered = useTask(questions, { domain }, { model, count: 5 });
  const [kept, setKept] = useState<Question[]>([]);
  // A property's switch: what the person set, else on when a kept question needs it.
  const [overrides, setOverrides] = useState<ReadonlyMap<string, boolean>>(new Map());

  // The domain is already written, so the screen asks once when it opens: in a product the person
  // presses Propose after describing their data.
  useEffect(() => offered.propose(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const shapes = useMemo(() => modelOf(kept), [kept]);
  const on = useMemo(() => {
    const set = new Set<string>();
    for (const s of shapes)
      for (const p of s.properties) {
        const key = `${s.type}.${p.name}`;
        if (overrides.get(key) ?? p.neededBy.length > 0) set.add(key);
      }
    return set;
  }, [shapes, overrides]);

  const include = (q: Question, id?: string) => {
    setKept((current) => (current.some((k) => k.question === q.question) ? current : [...current, q]));
    if (id) offered.dismiss(id);
  };

  return (
    <ShellRoot className="bg-background">
      <Steps
        className="flex min-h-0 flex-1 flex-col gap-0"
        count={STEPS.length}
        onStepChange={(d) => setStep(Math.min(d.step, STEPS.length - 1))}
        step={step}
      >
        <ShellHeader className="@container grid h-14 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-4">
          <p className="truncate font-medium text-sm">
            New graph <span className="text-muted-foreground">· Nobel prizes</span>
          </p>
          <StepsList className="w-auto min-w-0 @3xl:w-[22rem]">
            {STEPS.map((title, index) => (
              <StepsItem index={index} key={title}>
                <StepsTrigger disabled={index > 0 && kept.length === 0}>
                  <StepsIndicator>{index + 1}</StepsIndicator>
                  <StepsTitle className="hidden @3xl:inline">{title}</StepsTitle>
                </StepsTrigger>
                <StepsSeparator />
              </StepsItem>
            ))}
          </StepsList>
          <span />
        </ShellHeader>

        <ShellBody className="min-h-0">
          <YourData />
          <ShellMain className="min-h-0 overflow-y-auto">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
              <StepsContent className="flex flex-col gap-6" index={0}>
                <QuestionsPage
                  domain={domain}
                  kept={kept}
                  offered={offered}
                  onDomain={setDomain}
                  onInclude={include}
                  onRemove={(q) => setKept((current) => current.filter((k) => k !== q))}
                />
              </StepsContent>
              <StepsContent className="flex flex-col gap-6" index={1}>
                <ModelPage
                  on={on}
                  onToggle={(key, value) => setOverrides((current) => new Map(current).set(key, value))}
                  shapes={shapes}
                />
              </StepsContent>
              <StepsContent className="flex flex-col gap-6" index={2}>
                <ResultPage kept={kept} on={on} shapes={shapes} />
              </StepsContent>
            </div>
          </ShellMain>
        </ShellBody>

        <ShellFooter className="border-t px-4 py-2 text-muted-foreground text-xs">
          <div className="flex w-full items-center justify-between gap-3">
          <span>
            {SOURCES.length} files · read in your browser, nothing leaves it · {kept.length}{" "}
            {kept.length === 1 ? "question" : "questions"} kept
          </span>
          <div className="flex gap-2">
            <StepsPrevious asChild>
              <Button size="sm" variant="outline">
                Back
              </Button>
            </StepsPrevious>
            <Show when={step < STEPS.length - 1}>
              <StepsNext asChild>
                <Button disabled={kept.length === 0} size="sm">
                  Next: {STEPS[step + 1]?.toLowerCase()}
                </Button>
              </StepsNext>
            </Show>
          </div>
          </div>
        </ShellFooter>
      </Steps>
    </ShellRoot>
  );
}

/** The files, as the profile read them, and the links it found between them. */
function YourData() {
  return (
    <ShellAside aria-label="Your data" className="hidden overflow-y-auto bg-card p-4 md:flex" side="start" width={300}>
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-2">
          <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">Your data</h2>
          <ItemGroup className="gap-2">
            {SOURCES.map((s) => (
              <Item key={s.file} variant="outline">
                <ItemMedia>
                  <FileTextIcon />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{s.file}</ItemTitle>
                  <ItemDescription>
                    <FormatNumber value={s.rows} /> rows · {s.columns.length} columns · one per {s.key}
                  </ItemDescription>
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">Found in the data</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {LINKS.map((l) => (
              <li className="flex gap-2" key={`${l.from}.${l.column}`}>
                <LinkIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>
                  Every {say(l.from).toLowerCase()} names its {l.column}, and each one is {article(say(l.to))} you have.
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </ShellAside>
  );
}

function QuestionsPage(props: {
  domain: string;
  onDomain: (value: string) => void;
  offered: TaskList<Question>;
  kept: Question[];
  onInclude: (q: Question, id?: string) => void;
  onRemove: (q: Question) => void;
}) {
  const { offered, kept } = props;
  const [typed, setTyped] = useState("");
  const [refused, setRefused] = useState<{ question: string; diagnostics: readonly Diagnostic[] } | null>(null);
  const [grounding_, setGrounding] = useState(false);

  const add = async () => {
    const question = typed.trim();
    if (!question) return;
    setGrounding(true);
    const proposal = await runTask(grounding, { question }, { model });
    setGrounding(false);
    if (proposal.verdict.ok) {
      props.onInclude(proposal.value);
      setTyped("");
      setRefused(null);
    } else if ("diagnostics" in proposal.verdict) {
      setRefused({ question, diagnostics: proposal.verdict.diagnostics });
    }
  };

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="font-semibold text-2xl">What should this data be able to answer?</h1>
        <p className="text-muted-foreground">
          The questions decide what goes into the graph. At the end they are asked of it, for real.
        </p>
      </header>

      <Field>
        <FieldLabel>What it is about, in a sentence</FieldLabel>
        <Input onChange={(e) => props.onDomain(e.target.value)} value={props.domain} />
      </Field>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Proposed</h2>
          <Button disabled={offered.state === "proposing"} onClick={() => offered.propose()} size="sm" variant="outline">
            <Show fallback={<SparklesIcon />} when={offered.state === "proposing"}>
              <Spinner />
            </Show>
            Propose others
          </Button>
        </div>
        <Show when={offered.state === "ready" && offered.proposals.length === 0}>
          <p className="text-muted-foreground text-sm">Nothing more to propose. Write your own below.</p>
        </Show>
        <ItemGroup className="gap-2">
          {offered.proposals.map((p) => (
            <Item key={p.id} variant="outline">
              <ItemContent>
                <ItemTitle>{p.value.question}</ItemTitle>
                <ItemDescription>Answered by {grounds(p.value)}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button onClick={() => props.onInclude(p.value, p.id)} size="sm">
                  Keep
                </Button>
                <Button aria-label="Dismiss" onClick={() => offered.dismiss(p.id)} size="icon-sm" variant="ghost">
                  <XIcon />
                </Button>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      </section>

      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <Field className="flex-1">
          <FieldLabel>Your own question</FieldLabel>
          <Input onChange={(e) => setTyped(e.target.value)} placeholder="How much prize money did each laureate receive?" value={typed} />
        </Field>
        <Button disabled={grounding_ || !typed.trim()} type="submit" variant="outline">
          <Show when={grounding_}>
            <Spinner />
          </Show>
          Add
        </Button>
      </form>
      {/* `&&`, not `Show`: the alert dereferences what may be absent. */}
      {refused && (
        <Alert variant="warning">
          <CircleAlertIcon />
          <AlertTitle>Your data cannot answer “{refused.question}”</AlertTitle>
          <AlertDescription>
            {refused.diagnostics.map((d) => d.message).join(" ")} Reword it, or bring the file that holds it.
          </AlertDescription>
        </Alert>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Kept</h2>
        <Show fallback={<p className="text-muted-foreground text-sm">Keep at least one question to build a graph for it.</p>} when={kept.length > 0}>
          <ItemGroup className="gap-2">
            {kept.map((q) => (
              <Item key={q.question} variant="muted">
                <ItemMedia>
                  <CheckIcon className="text-success" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{q.question}</ItemTitle>
                  <ItemDescription>Answered by {grounds(q)}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button aria-label={`Remove “${q.question}”`} onClick={() => props.onRemove(q)} size="icon-sm" variant="ghost">
                    <XIcon />
                  </Button>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        </Show>
      </section>
    </>
  );
}

function ModelPage(props: { shapes: Shape[]; on: ReadonlySet<string>; onToggle: (key: string, value: boolean) => void }) {
  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="font-semibold text-2xl">What the graph holds</h1>
        <p className="text-muted-foreground">
          One kind of thing per file, and what each one says about it. What your questions need is on; the rest is yours to add.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {props.shapes.map((s) => (
          <Card key={s.type}>
            <CardHeader>
              <CardTitle>{say(s.type).replace(/^\w/, (c) => c.toUpperCase())}s</CardTitle>
              <CardDescription>
                <FormatNumber value={s.source.rows} />, one per row of {s.source.file}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {s.properties.map((p) => {
                const key = `${s.type}.${p.name}`;
                const reachable = p.kind !== "link" || props.shapes.some((t) => t.type === p.to);
                return (
                  <div className="flex items-center justify-between gap-3" key={key}>
                    <Switch
                      checked={props.on.has(key) && reachable}
                      disabled={!reachable}
                      onCheckedChange={(d) => props.onToggle(key, d.checked)}
                    >
                      <span className="flex flex-col">
                        <span>{p.name}</span>
                        <span className="text-muted-foreground text-xs">
                          {p.kind === "link" ? article(say(p.to!)) : p.kind}
                        </span>
                      </span>
                    </Switch>
                    <Show when={p.neededBy.length > 0}>
                      <Badge size="sm" title={p.neededBy.join("\n")} variant="info">
                        {p.neededBy.length} {p.neededBy.length === 1 ? "question" : "questions"}
                      </Badge>
                    </Show>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

function ResultPage(props: { kept: Question[]; shapes: Shape[]; on: ReadonlySet<string> }) {
  const { kept, shapes, on } = props;
  const missing = (q: Question) =>
    q.uses.filter((concept) => {
      const link = LINKS.find((l) => `${l.from}→${l.to}` === concept);
      return !on.has(link ? `${link.from}.${link.column}` : concept);
    });
  const answered = kept.filter((q) => missing(q).length === 0);
  const things = shapes.reduce((n, s) => n + s.source.rows, 0);
  const links = LINKS.filter((l) => on.has(`${l.from}.${l.column}`) && shapes.some((s) => s.type === l.to)).reduce((n, l) => n + l.found, 0);

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="font-semibold text-2xl">Your graph</h1>
        <p className="text-muted-foreground">Built from your files, and every question asked of it.</p>
      </header>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatRoot>
          <StatLabel>Things</StatLabel>
          <StatValue>
            <FormatNumber value={things} />
          </StatValue>
          <StatDescription>{shapes.map((s) => `${say(s.type)}s`).join(", ")}</StatDescription>
        </StatRoot>
        <StatRoot>
          <StatLabel>Links between them</StatLabel>
          <StatValue>
            <FormatNumber value={links} />
          </StatValue>
          <StatDescription>every one found in your data</StatDescription>
        </StatRoot>
        <StatRoot>
          <StatLabel>Questions answered</StatLabel>
          <StatValue>
            {answered.length} of {kept.length}
          </StatValue>
          <StatDescription>asked of the graph, not of the model</StatDescription>
        </StatRoot>
      </div>

      <ItemGroup className="gap-2">
        {kept.map((q) => {
          const gaps = missing(q);
          return (
            <Item key={q.question} variant="outline">
              <ItemMedia>
                <Show fallback={<CircleAlertIcon className="text-warning" />} when={gaps.length === 0}>
                  <CheckIcon className="text-success" />
                </Show>
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{q.question}</ItemTitle>
                <ItemDescription>
                  {gaps.length === 0
                    ? (ANSWERS[q.question] ?? "Answered: 12 rows")
                    : `Not answered: it needs ${gaps.map(say).join(", ")}, which the model leaves out.`}
                </ItemDescription>
              </ItemContent>
            </Item>
          );
        })}
      </ItemGroup>

      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button className="self-start" size="sm" variant="ghost">
            <CollapsibleIndicator />
            Advanced: the mapping, in Fossil
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <pre className="mt-2 overflow-x-auto rounded-md border bg-muted p-4 font-mono text-xs leading-relaxed">{fossilOf(shapes, on)}</pre>
        </CollapsibleContent>
      </Collapsible>
    </>
  );
}
