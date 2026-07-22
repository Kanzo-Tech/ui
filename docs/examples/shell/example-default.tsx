import { PanelLeftIcon, PanelRightIcon } from "lucide-react";
import {
  Button,
  ShellAside,
  ShellBody,
  ShellFooter,
  ShellHeader,
  ShellMain,
  ShellRoot,
} from "@kanzo-tech/ui";

/**
 * All six regions at once, each labelled with what it is — the page documents the vocabulary,
 * so the example has to show the whole vocabulary rather than one strip of it.
 *
 * Every visible style here (heights, the surfaces, the type) is applied at THIS call site. The
 * regions themselves impose none of it: they place their children and draw the border that
 * separates them from their neighbour, and nothing else.
 */
export default function Example() {
  return (
    // `h-[26rem]` rather than ShellRoot's own `h-dvh`: this is a framed demo inside a docs
    // page, not a shell that owns the viewport. A real one keeps `h-dvh`.
    <ShellRoot className="h-[26rem] w-full rounded-lg border">
      <ShellHeader className="h-11 flex-row items-center justify-between gap-2 bg-card px-3">
        <span className="font-medium text-sm">ShellHeader</span>
        <div className="flex items-center gap-1">
          <Button aria-label="Toggle navigation" size="icon-sm" variant="ghost">
            <PanelLeftIcon />
          </Button>
          <Button aria-label="Toggle inspector" size="icon-sm" variant="ghost">
            <PanelRightIcon />
          </Button>
        </div>
      </ShellHeader>

      <ShellBody>
        <ShellAside
          aria-label="Navigation"
          className="justify-center p-3 text-center"
          side="start"
          width={180}
        >
          <span className="font-medium text-muted-foreground text-xs">
            ShellAside
            <br />
            side=&quot;start&quot;
          </span>
        </ShellAside>

        {/* The one <main> on the page. Nested containers use <section> — see Section. */}
        <ShellMain className="items-center justify-center bg-muted/24 p-4">
          <span className="font-medium text-sm">ShellMain</span>
          <span className="mt-1 text-muted-foreground text-xs">
            the single &lt;main&gt; landmark
          </span>
        </ShellMain>

        <ShellAside
          aria-label="Inspector"
          className="justify-center p-3 text-center"
          side="end"
          width={180}
        >
          <span className="font-medium text-muted-foreground text-xs">
            ShellAside
            <br />
            side=&quot;end&quot;
          </span>
        </ShellAside>
      </ShellBody>

      <ShellFooter className="h-7 flex-row items-center bg-card px-3">
        <span className="text-[11px] text-muted-foreground">ShellFooter</span>
      </ShellFooter>
    </ShellRoot>
  );
}
