"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@kanzo-tech/ui";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@kanzo-tech/ai";
import { CodeEditor } from "@kanzo-tech/ui/editor";
import { StreamLanguage } from "@codemirror/language";
import { standardSQL } from "@codemirror/legacy-modes/mode/sql";
import { daysOverdue, dueOn, FEATURED, overdueQuests } from "@/example/quests";
import { withRole } from "@/example/roster";
import { hall, isoDay } from "@/example/world";

const SQL = `select id, title, region, due
from board
where status = 'afield'
  and due < date '${isoDay(0)}'
order by due;`;

// The house has code chrome twice already — `.kanzo-prose`'s `--tw-prose-pre-*` and the whole
// tokenised CodeMirror theme — so this composes the second rather than hand-rolling a third
// `<pre>`. `decisions/a-tool-panel-composes-its-snippet.md`.
//
// **`"use client"` above is load-bearing and its absence broke the production build**, not the
// preview. A CodeMirror `Extension` is a cyclic object graph, and without the directive this module
// is a Server Component handing one to a client component as a prop — which the RSC serializer
// walks until it runs out of stack. `RangeError: Maximum call stack size exceeded` while
// prerendering `/docs/ai/tool`, with nothing naming the prop, the module or CodeMirror. Vite
// ignores the directive entirely and `pnpm dev` never evaluated the boundary, so the page looked
// right for as long as nobody ran `next build`.
const SQL_MODE = StreamLanguage.define(standardSQL);

const late = overdueQuests();
const cantors = withRole("cantor");
const readyAtHome = cantors.filter((e) => e.hall === "amber" && e.availability === "ready");
const readyElsewhere = cantors.filter((e) => e.hall !== "amber" && e.availability === "ready");

export default function Example() {
  return (
    <div className="flex w-full max-w-2xl flex-col gap-3">
      <Tool state="done">
        <ToolHeader>board.query</ToolHeader>
        <ToolContent>
          <ToolInput>
            {/* `readOnly`, and the panel's own surface: an editor is a legal way to draw a snippet,
                and it is the only one that carries the palette's `--syntax-*` tokens. `ai` imports
                no CodeMirror — the host opened that door, which is what the subpath is for. */}
            <CodeEditor extensions={[SQL_MODE]} readOnly value={SQL} wrap={false} />
          </ToolInput>
          <ToolOutput>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contract</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-end">Days late</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {late.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell>{contract.title}</TableCell>
                    <TableCell>{contract.region}</TableCell>
                    <TableCell>{dueOn(contract)}</TableCell>
                    <TableCell className="text-end tabular-nums">
                      {daysOverdue(contract)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ToolOutput>
        </ToolContent>
      </Tool>

      <Tool state="failed">
        <ToolHeader>roster.assign</ToolHeader>
        <ToolContent>
          <ToolInput data={{ contract: FEATURED.overdue.id, hall: "amber", duty: "cantor" }} />
          <ToolOutput>
            A duty is filled from the posting hall first, and {readyAtHome.length} of{" "}
            {hall("amber").short}'s cantors are ready. Free elsewhere:{" "}
            {readyElsewhere.map((entry) => entry.name).join(", ")}.
          </ToolOutput>
        </ToolContent>
      </Tool>
    </div>
  );
}
