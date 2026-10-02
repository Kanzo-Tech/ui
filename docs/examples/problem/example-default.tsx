"use client";

import { Button, DiagnosticList, Problem, type ProblemCopy } from "@kanzo-tech/ui";
import { useState } from "react";

/** A library's coded error, in the shape every one of them shares. */
class HallError extends Error {
  constructor(
    readonly code: string,
    readonly title: string,
    message: string,
    readonly data?: Record<string, unknown>,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "HallError";
  }
}

/** The ledger refused a writ, because the archive under it did not answer — and why it did not. */
const FAILURE = new HallError(
  "writ/unsealed",
  "The writ was not sealed",
  "The ledger refused writ Q-1058: its party could not be checked against the roster.",
  { writ: "Q-1058" },
  {
    cause: new HallError("archive/silent", "The archive did not answer", "No answer after 5000 ms.", { after: 5000 }, {
      cause: new TypeError("Failed to fetch"),
    }),
  },
);

/** The host's words: the clerk reads "the archive is closed", not the library's own phrasing. */
const copy = (code: string, data: unknown): ProblemCopy | undefined => {
  if (code === "archive/silent") {
    const after = (data as { after?: number } | undefined)?.after;
    return {
      title: "The archive is closed",
      detail: `It did not answer within ${after ? after / 1000 : "a few"} seconds. The night clerk opens it at dusk.`,
      link: { label: "See the hours", href: "#hours" },
    };
  }
  return undefined;
};

export default function Example() {
  const [tries, setTries] = useState(1);
  return (
    <DiagnosticList className="max-w-xl">
      <Problem copy={copy} error={FAILURE}>
        <Button onClick={() => setTries((n) => n + 1)} size="sm" variant="outline">
          Try again{tries > 1 ? ` (${tries})` : ""}
        </Button>
      </Problem>
    </DiagnosticList>
  );
}
