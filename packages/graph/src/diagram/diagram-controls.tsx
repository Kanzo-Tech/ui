"use client";

import type { ark } from "@ark-ui/react/factory";
import { Button, ButtonGroup, ButtonGroupSeparator, cn } from "@kanzo-tech/ui";
import { useReactFlow } from "@xyflow/react";
import { MinusIcon, PlusIcon, ScanIcon } from "lucide-react";
import { tv } from "tailwind-variants";

/** The group's name and each button's. */
export interface DiagramControlsTranslations {
  camera: string;
  zoomIn: string;
  zoomOut: string;
  fit: string;
}

const ENGLISH: DiagramControlsTranslations = {
  camera: "Camera",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  fit: "Fit the diagram",
};

/** `ButtonGroup`'s props: the controls are one group, named by `translations.camera`. */
export interface DiagramControlsProps extends Omit<React.ComponentProps<typeof ark.div>, "children" | "aria-label" | "aria-labelledby"> {
  /** @default "horizontal" */
  orientation?: "horizontal" | "vertical";
  translations?: Partial<DiagramControlsTranslations>;
}

/** `GraphToolbar`'s cluster, for the same reason: solid, and the group carries the surface. */
const diagramControls = tv({
  base: "rounded-lg border bg-card shadow-sm",
});

/**
 * **Zoom in, zoom out and fit**, on the camera of the `DiagramRoot` it sits under — anywhere under
 * it, not only inside the canvas, so the host places it. React Flow's own `Controls` draws the same
 * three in its stylesheet's colours; this draws them as `GraphToolbar`'s camera cluster does, with
 * `@kanzo-tech/ui`'s buttons. A `ButtonGroup` and no `toolbar` role: each button is its own tab stop,
 * and a toolbar promises roving focus.
 */
export function DiagramControls({ className, slot, translations, ...rest }: DiagramControlsProps) {
  const t = { ...ENGLISH, ...translations };
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  return (
    <ButtonGroup {...rest} aria-label={t.camera} className={cn(diagramControls(), className)} slot={slot ?? "diagram-controls"}>
      <Button aria-label={t.zoomIn} onClick={() => void zoomIn()} size="icon-sm" variant="ghost">
        <PlusIcon />
      </Button>
      <ButtonGroupSeparator />
      <Button aria-label={t.zoomOut} onClick={() => void zoomOut()} size="icon-sm" variant="ghost">
        <MinusIcon />
      </Button>
      <ButtonGroupSeparator />
      <Button aria-label={t.fit} onClick={() => void fitView()} size="icon-sm" title={t.fit} variant="ghost">
        <ScanIcon />
      </Button>
    </ButtonGroup>
  );
}
