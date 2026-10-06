"use client";

import { PencilIcon } from "lucide-react";
import { Button } from "../simples/button.js";

/** The pencil a tile opens the editor from — on the view, so it is no part of the editor's code. */
export function EditTileButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button aria-label={label} className="opacity-64 hover:opacity-100" onClick={onClick} size="icon-sm" variant="ghost">
      <PencilIcon />
    </Button>
  );
}
