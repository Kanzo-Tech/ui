import * as React from "react";

/**
 * The routing seam for every navigating composite. Products inject their router's
 * link (keasy → `next/link`, metadata-form / fossil → a plain `<a>`); the design
 * system never imports `next/*`. A `LinkComponent` must accept at least `href` +
 * `children` and spread the rest (`className`, `style`, `onClick`, …) onto the
 * anchor it renders.
 */
export type LinkComponent = React.ComponentType<
  { href: string; children?: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>
>;

/** Default link: a plain anchor. Used when a composite gets no `linkComponent`.
 * Forwards its ref so it works as an `asChild` target for menu / tooltip triggers. */
export const DefaultLink: LinkComponent = React.forwardRef<HTMLAnchorElement, { href: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>>(
  function DefaultLink({ href, children, ...rest }, ref) {
    return (
      <a ref={ref} data-slot="link" href={href} {...rest}>
        {children}
      </a>
    );
  },
);
