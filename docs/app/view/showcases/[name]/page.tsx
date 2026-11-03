import { notFound } from "next/navigation";
import { AppShellShowcase } from "@/showcases/app-shell/default";
import { JobStudioShowcase } from "@/showcases/job-studio/default";
import { FieldNotesShowcase } from "@/showcases/field-notes/default";
import { SettingsShowcase } from "@/showcases/settings/default";
import { WorkspaceShowcase } from "@/showcases/workspace/default";

/**
 * Standalone, chrome-free route for a showcase, one per name.
 *
 * Showcases are whole arrangements: they claim the viewport, own their own scrolling and are judged at full
 * width. Rendering one inside the docs layout would put it in a content column and prove
 * nothing, so it gets its own page and the docs embed that page in an iframe.
 */
const SHOWCASES = {
  "app-shell": AppShellShowcase,
  workspace: WorkspaceShowcase,
  // A wizard whose editor never leaves the screen: `Steps` drives the aside, not the whole
  // page. It is also the library's first real consumer of `CodeEditor`'s `extensions` slot.
  "job-studio": JobStudioShowcase,
  // The preference sections on both surfaces: a settings page, and the drawer its trigger opens.
  // The drawer is Portal-ed and `position: fixed`, so it can only be shown honestly in its own
  // viewport — which is also why `/docs/layout/preferences` embeds this rather than a preview box.
  settings: SettingsShowcase,
  // No theme-studio and no theme-gallery here any more. Both left `showcases/` entirely: the
  // studio is the route `/theme-generator` and the gallery is the page `/docs/themes`. Neither was
  // an arrangement the documentation exhibits — one is an instrument it offers and the other is a
  // catalogue — and an iframe was costing them a URL, a title and their place in the nav.
  // Photos of fuel tickets in, a spreadsheet out. The only showcase whose columns are not written
  // here at all: rudof parses one SHACL document in wasm and the table, the validation and the CSV
  // are three readings of it.
  "field-notes": FieldNotesShowcase,
} as const;

type ShowcaseName = keyof typeof SHOWCASES;

export function generateStaticParams() {
  return Object.keys(SHOWCASES).map((name) => ({ name }));
}

export default async function Page(props: { params: Promise<{ name: string }> }) {
  const { name } = await props.params;
  const Showcase = SHOWCASES[name as ShowcaseName];
  if (!Showcase) notFound();
  return <Showcase />;
}

export async function generateMetadata(props: { params: Promise<{ name: string }> }) {
  const { name } = await props.params;
  return { title: `${name} showcase` };
}
