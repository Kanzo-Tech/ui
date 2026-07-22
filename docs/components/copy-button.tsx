"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { Button, Tooltip, TooltipContent, TooltipTrigger, cn } from "@kanzo-tech/ui";

export const CopyButton = ({ value, className }: { value: string; className?: string }) => {
  const [copied, setCopied] = useState(false);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label="Copy to clipboard"
          className={cn("opacity-64 hover:opacity-100", className)}
          onClick={() => {
            navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          size="icon-sm"
          variant="ghost"
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{copied ? "Copied" : "Copy to clipboard"}</TooltipContent>
    </Tooltip>
  );
};
