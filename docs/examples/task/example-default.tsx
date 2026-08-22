import { type RunState, Task, TaskList, TaskStatus, TaskTitle } from "@kanzo-tech/ai";
import { FEATURED } from "@/example/quests";
import { breaches } from "@/example/rules";

const late = FEATURED.overdue;
const firstBreach = breaches().find((entry) => entry.quest.id === late.id);

const STEPS: { title: string; state: RunState }[] = [
  { title: `Read ${late.id} off the board`, state: "done" },
  { title: "Resolve the party through the roster", state: "done" },
  {
    // The rule that actually fails on this contract, quoted from `rules.ts` rather than retyped.
    title: firstBreach ? `Check “${firstBreach.rule}”` : "Check the standing orders",
    state: "failed",
  },
  { title: "Find a cantor who is ready today", state: "running" },
  { title: "Draft the quartermaster's note", state: "pending" },
];

export default function Example() {
  return (
    <TaskList className="max-w-md">
      {STEPS.map((step) => (
        <Task key={step.title} state={step.state}>
          <TaskStatus />
          <TaskTitle>{step.title}</TaskTitle>
        </Task>
      ))}
    </TaskList>
  );
}
