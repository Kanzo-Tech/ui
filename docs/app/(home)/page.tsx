import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Button } from "@kanzo-tech/ui";
import { ServerCodeBlock } from "fumadocs-ui/components/codeblock.rsc";
import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { KanzoLogo } from "@/components/kanzo-logo";
import { FAMILIES } from "./families";
import { FamilyScope, FamilySwitch, LiveScreen, ThemeFileName, ThemeSource } from "./home-live";
import styles from "./home.module.css";

/** The declarations a reader sees change on the screen above: ground, ink, brand, line, shape. */
const SHOWN = ["--background", "--foreground", "--card", "--primary", "--primary-foreground", "--border", "--radius-box", "--radius-field"];

/** The opening of a shipped theme file, its own lines, with the rest counted rather than hidden. */
function excerpt(theme: string) {
  const css = readFileSync(join(process.cwd(), "node_modules/@kanzo-tech/theme/themes", `${theme}.css`), "utf-8");
  const lines = css.split("\n");
  const selector = lines.find((line) => line.includes(`[data-theme="${theme}"]`)) ?? `[data-theme="${theme}"] {`;
  const declarations = lines.map((line) => line.trim()).filter((line) => line.startsWith("--"));
  const shown = SHOWN.map((name) => declarations.find((line) => line.startsWith(`${name}:`))).filter(Boolean);
  const rest = declarations.length - shown.length;
  return [selector.trim().replace(/, /g, ",\n"), ...shown.map((line) => `  ${line}`), `  /* and ${rest} more */`, "}"].join("\n");
}

const CODE = { className: "my-0 text-[0.9375rem]", allowCopy: false } as const;

async function sources() {
  const out: Record<string, ReactNode> = {};
  for (const theme of FAMILIES.flatMap((f) => [f.light?.value, f.dark?.value]).filter((v): v is string => !!v)) {
    out[theme] = <ServerCodeBlock code={excerpt(theme)} codeblock={CODE} lang="css" />;
  }
  return out;
}

const ACCOUNT = [
  {
    title: "Behaviour is Ark UI's",
    body: "Focus, keyboard, ARIA and every open, closed and selected state come from Ark's state machines. A component composes Ark's parts; it does not rewrite them.",
    href: "/docs/philosophy",
    link: "The philosophy",
  },
  {
    title: "Appearance follows Shark UI",
    body: "Every component's classes are checked against a Shark reference in CI, and where one differs, the difference and its reason are written down.",
    href: "/docs/components",
    link: "The components",
  },
  {
    title: "A theme is a CSS file",
    body: "Eight hand-written files in four families. Nothing is derived, so the file you read is what paints. Wear one across this site, or write your own beside them.",
    href: "/docs/themes",
    link: "The themes",
    extra: { href: "/theme-generator", link: "The theme generator" },
  },
  {
    title: "Heavy parts wait for you",
    body: "The data table, the code editor and the charts sit on their own entry points, so importing a Button never pulls in TanStack, CodeMirror or DuckDB.",
    href: "/docs/installation",
    link: "Installation",
  },
];

const SHOWCASES = [
  {
    name: "keasy",
    body: "Kanzo's product, rebuilt on the library: the dashboard behind its rail, and Discover, where a graph is read back.",
    href: "/docs/showcases/keasy",
  },
  {
    name: "Settings",
    body: "The same preference sections on a settings page and in the drawer its trigger opens.",
    href: "/docs/showcases/settings",
  },
  {
    name: "Field notes",
    body: "Photographs of handwritten slips in, a ledger out, with the paper beside every number it became.",
    href: "/docs/showcases/field-notes",
  },
];

const FOOTER = [
  { text: "Docs", href: "/docs" },
  { text: "Components", href: "/docs/components" },
  { text: "Themes", href: "/docs/themes" },
  { text: "Theme generator", href: "/theme-generator" },
  { text: "Showcases", href: "/docs/showcases" },
];

const step = (n: number) => ({ "--step": n }) as CSSProperties;

export default async function HomePage() {
  const code = await sources();

  return (
    <main className="flex flex-1 flex-col">
      <FamilyScope>
        <section className="mx-auto w-full max-w-[1400px] px-4 pt-12 sm:px-8 sm:pt-16 lg:pt-20">
          <h1
            className={`${styles.rise} text-balance font-heading font-medium text-[clamp(2.75rem,1rem+5.6vw,6.25rem)] leading-[0.95] tracking-[-0.035em]`}
          >
            The parts keasy is built from
          </h1>

          <div className="mt-10 grid gap-12 lg:mt-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
            <div className="flex flex-col gap-8">
              <p className={`${styles.rise} max-w-[36ch] text-[1.25rem] leading-normal sm:text-[1.375rem]`} style={step(1)}>
                Kanzo UI is the React component library behind Kanzo's products: behaviour from Ark UI,
                appearance from Shark UI, and themes you can read as plain CSS.
              </p>
              <div className={`${styles.rise} flex flex-wrap items-center gap-x-6 gap-y-3`} style={step(2)}>
                <Button asChild size="lg">
                  <Link href="/docs">
                    Read the docs
                    <ArrowRightIcon />
                  </Link>
                </Button>
                <Link className="font-medium underline underline-offset-4 hover:no-underline" href="/docs/components">
                  Browse the components
                </Link>
              </div>
              <pre className={`${styles.rise} w-fit rounded-field bg-muted px-4 py-3 font-mono text-sm lg:order-last`} style={step(3)}>
                <code>npm install @kanzo-tech/ui</code>
              </pre>
              <div className={`${styles.rise} flex flex-col gap-3 lg:mt-8`} style={step(3)}>
                <FamilySwitch className="w-full sm:w-fit" />
                <p className="max-w-[44ch] text-muted-foreground" id="home-screen-caption">
                  The screen is painted by <ThemeFileName side="light" /> by day and{" "}
                  <ThemeFileName side="dark" /> by night. Stat, Badge, Table, InputGroup and Button are
                  unchanged.
                </p>
              </div>
            </div>

            <figure aria-describedby="home-screen-caption" className={`${styles.rise} min-w-0`} style={step(2)}>
              <LiveScreen />
            </figure>
          </div>
        </section>

        <section className="mx-auto mt-32 w-full max-w-[1400px] px-4 sm:px-8 lg:mt-48">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
            <div className="flex flex-col gap-12">
              <h2 className={`${styles.reveal} font-heading font-medium text-[clamp(2rem,1rem+2.6vw,3.25rem)] leading-none tracking-[-0.03em]`}>
                What it is made of
              </h2>
              <dl className="flex flex-col gap-10">
                {ACCOUNT.map((item) => (
                  <div className={`${styles.reveal} flex flex-col gap-2`} key={item.title}>
                    <dt className="font-heading font-medium text-2xl tracking-[-0.02em]">{item.title}</dt>
                    <dd className="max-w-[52ch] text-[1.0625rem] leading-relaxed">{item.body}</dd>
                    <dd className="flex flex-wrap gap-x-5 font-medium">
                      <Link className="underline underline-offset-4 hover:no-underline" href={item.href}>
                        {item.link}
                      </Link>
                      {item.extra && (
                        <Link className="underline underline-offset-4 hover:no-underline" href={item.extra.href}>
                          {item.extra.link}
                        </Link>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <figure className={`${styles.reveal} flex min-w-0 flex-col gap-4 lg:sticky lg:top-24 lg:self-start`}>
              <ThemeSource sources={code} />
              <figcaption className="text-muted-foreground text-sm">
                The opening of <ThemeFileName side="light" /> and <ThemeFileName side="dark" />, as
                shipped in <code className="font-mono">@kanzo-tech/theme</code>. They follow the family
                chosen above, with the screen.
              </figcaption>
            </figure>
          </div>
        </section>
      </FamilyScope>

      <section className="mx-auto mt-32 w-full max-w-[1400px] px-4 sm:px-8 lg:mt-48">
        <h2 className={`${styles.reveal} font-heading font-medium text-[clamp(2rem,1rem+2.6vw,3.25rem)] leading-none tracking-[-0.03em]`}>
          Whole screens, not samples
        </h2>
        <ul className="mt-10 flex flex-col gap-2 lg:mt-14">
          {SHOWCASES.map((s) => (
            <li className={styles.reveal} key={s.name}>
              <Link
                className="group grid gap-2 py-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-baseline lg:gap-16"
                href={s.href}
              >
                <span className="font-heading underline-offset-[0.15em] group-hover:underline font-medium text-[clamp(1.75rem,1rem+2vw,2.75rem)] tracking-[-0.03em]">
                  {s.name}
                  <ArrowRightIcon className="ms-3 inline size-[0.7em] align-[-0.05em] transition-transform group-hover:translate-x-1" />
                </span>
                <span className="max-w-[52ch] text-[1.0625rem] leading-relaxed">{s.body}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <footer className="mx-auto mt-32 w-full max-w-[1400px] px-4 pb-8 sm:px-8 lg:mt-48">
        <div className="flex flex-col gap-10">
          <nav aria-label="Footer" className="flex flex-wrap justify-between gap-x-8 gap-y-4 font-medium">
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              {FOOTER.map((l) => (
                <Link className="underline-offset-4 hover:underline" href={l.href} key={l.href}>
                  {l.text}
                </Link>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <a className="underline-offset-4 hover:underline" href="https://kanzo.tech/">
                Kanzo Tech
              </a>
              <a className="underline-offset-4 hover:underline" href="https://kanzo-tech.github.io/keasy.github.io/">
                keasy
              </a>
            </div>
          </nav>
          <KanzoLogo className={`${styles.reveal} h-auto w-full text-primary`} />
        </div>
      </footer>
    </main>
  );
}
