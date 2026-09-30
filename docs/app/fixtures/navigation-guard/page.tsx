import { GuardedForm } from "./guarded-form";

/**
 * The end-to-end fixture for `@kanzo-tech/navigation`, not a page anybody reads.
 *
 * A server page rendering the client half, so the docs build is also what evaluates the package's
 * client boundary. `docs/scripts/navigation-guard.e2e.mjs` drives it: every row of the coverage
 * table on `/docs/navigation-guard` is one navigation from here with the form dirty.
 */
export default function Page() {
  return <GuardedForm />;
}

export const metadata = { title: "Navigation guard fixture", robots: { index: false } };
