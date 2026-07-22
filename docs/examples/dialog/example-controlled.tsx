"use client";

import { useState } from "react";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@kanzo-tech/ui";

export default function Example() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col items-center gap-3">
      <Button onClick={() => setOpen(true)} variant="outline">
        Open dialog
      </Button>

      <p className="text-muted-foreground text-sm">open: {String(open)}</p>

      <Dialog onOpenChange={(details) => setOpen(details.open)} open={open}>
        <DialogContent>
          <DialogHeader
            description="The trigger lives outside the Dialog — state drives it instead."
            title="Controlled"
          />

          <DialogBody>Escape and the backdrop still call onOpenChange, so the state stays in sync.</DialogBody>

          <DialogFooter>
            <Button onClick={() => setOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
