import Link from "next/link";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@kanzo-tech/ui";

/**
 * The landing page is itself a demo: everything below the nav is built from the library's own
 * components. A design system whose marketing page is hand-rolled markup is not eating its
 * own cooking.
 */
export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-20 sm:py-28">
      <section className="flex max-w-2xl flex-col items-center gap-6 text-center">
        <Badge size="sm" variant="outline">
          Ark UI · Tailwind v4 · React 19
        </Badge>

        <h1 className="font-semibold text-4xl tracking-tight sm:text-5xl">
          The design system behind Kanzo
        </h1>

        <p className="text-balance text-lg text-muted-foreground">
          Accessible behaviour from Ark UI, appearance from design tokens, and one recipe every
          component follows — so a single token change re-skins the whole surface.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/docs">Get started</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/docs/components">Browse components</Link>
          </Button>
        </div>
      </section>

      <section className="mt-20 grid w-full max-w-4xl gap-4 sm:grid-cols-3">
        <Feature
          title="Themed by tokens"
          body="Six axes as data-* attributes on <html>. Change one and every component follows, overlays included."
        />
        <Feature
          title="Server-ready"
          body="Every component is prerendered inside a real App Router tree in CI, so the client boundary is verified, not assumed."
        />
        <Feature
          title="No hidden cost"
          body="Optional peers live on their own subpaths. The base bundle never pays for a table grid or a code editor."
        />
      </section>
    </main>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{body}</CardDescription>
      </CardHeader>
      <CardContent />
    </Card>
  );
}
