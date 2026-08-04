import {
  Link,
  ShellAside,
  ShellBody,
  ShellHeader,
  ShellMain,
  ShellRoot,
  SkipNavContent,
  SkipNavLink,
} from "@kanzo-tech/ui";

const nav = ["Overview", "Datasets", "Queries", "Settings"];

// Tab into this frame. The first stop is the skip link — and because it is `position: fixed` it
// appears at the top-start corner of the PAGE rather than of this box, which is the component
// working: a real shell owns the viewport. Press Enter and the next Tab starts inside <main>,
// past the four navigation links.
export default function Example() {
  return (
    <ShellRoot className="h-[22rem] w-full">
      {/* First child of the shell, above the header: "first focusable element" is the whole spec. */}
      <SkipNavLink />

      <ShellHeader className="h-11 flex-row items-center bg-card px-3">
        <span className="font-medium text-sm">Atlas</span>
      </ShellHeader>

      <ShellBody>
        <ShellAside aria-label="Navigation" className="gap-1 p-2" side="start" width={176}>
          {nav.map((label) => (
            <Link className="rounded-sm px-2 py-1 text-sm" href="#" key={label} variant="subtle">
              {label}
            </Link>
          ))}
        </ShellAside>

        {/* The <main> IS the target — asChild hands it the id and tabIndex, so there is no wrapper
            element and focus lands on the landmark itself. */}
        <SkipNavContent asChild>
          <ShellMain className="gap-2 p-4">
            <h2 className="font-medium text-sm">Queries</h2>
            <p className="text-muted-foreground text-sm">
              Focus arrives here, not on the navigation column.
            </p>
            <Link className="w-fit text-sm" href="#">
              The first tab stop inside main
            </Link>
          </ShellMain>
        </SkipNavContent>
      </ShellBody>
    </ShellRoot>
  );
}
