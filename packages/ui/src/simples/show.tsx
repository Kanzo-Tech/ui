interface ShowProps {
  children: React.ReactNode;
  /** Rendered when `when` is falsy. */
  fallback?: React.ReactNode;
  /** When truthy, renders `children`; otherwise `fallback`. */
  when: boolean;
}

// Pure control-flow helper — no hooks, no DOM of its own, so no client boundary.
export const Show = (props: ShowProps) => {
  const { when, fallback, children } = props;

  return <>{when ? children : fallback}</>;
};
