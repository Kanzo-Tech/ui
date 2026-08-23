import { notFound } from "next/navigation";
import { AppShellShowcase } from "@/showcases/app-shell/default";
import { DiscoveryShowcase } from "@/showcases/discovery/default";
import { GraphBenchShowcase } from "@/showcases/graph-bench/default";
import { JobStudioShowcase } from "@/showcases/job-studio/default";
import { MetadataFormShowcase } from "@/showcases/metadata-form/default";
import { PreferencesShowcase } from "@/showcases/preferences/default";
import { FieldNotesShowcase } from "@/showcases/field-notes/default";
import { SettingsShowcase } from "@/showcases/settings/default";
import { PreferencesExtendedShowcase } from "@/showcases/preferences/extended";
import { PreferencesFontsShowcase } from "@/showcases/preferences/fonts";
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
  "metadata-form": MetadataFormShowcase,
  workspace: WorkspaceShowcase,
  // Not an arrangement to copy but an instrument: it builds graphs off-screen to time them, and
  // shows one on screen because the legibility ceiling arrives before the performance one.
  "graph-bench": GraphBenchShowcase,
  // A wizard whose editor never leaves the screen: `Steps` drives the aside, not the whole
  // page. It is also the library's first real consumer of `CodeEditor`'s `extensions` slot.
  "job-studio": JobStudioShowcase,
  // Not a shell like the other two, but it needs the same treatment: the Preferences panel is
  // Portal-ed and `position: fixed`, so it can only be shown honestly in its own viewport. The
  // -fonts and -extended variants are the doc's other two examples, each a real panel with a
  // custom `PreferencesPanel` child set rather than loose sections in a box.
  preferences: PreferencesShowcase,
  "preferences-fonts": PreferencesFontsShowcase,
  "preferences-extended": PreferencesExtendedShowcase,
  // The same sections as `preferences`, rendered as a PAGE rather than a drawer — a sub-sidebar and
  // one scrolling pane, GitHub's Appearance shape. It exists to demonstrate that a section is
  // independent of its surface: not one component below is a settings-page variant of anything.
  settings: SettingsShowcase,
  // No theme-studio and no theme-gallery here any more. Both left `showcases/` entirely: the
  // studio is the route `/theme-generator` and the gallery is the page `/docs/themes`. Neither was
  // an arrangement the documentation exhibits — one is an instrument it offers and the other is a
  // catalogue — and an iframe was costing them a URL, a title and their place in the nav.
  // Photos of fuel tickets in, a spreadsheet out. The only showcase whose columns are not written
  // here at all: rudof parses one SHACL document in wasm and the table, the validation and the CSV
  // are three readings of it. Also `useAiStream`'s second consumer.
  "field-notes": FieldNotesShowcase,
  // A question over the archive, answered by a statement somebody can read: `Task` for the phases,
  // `Tool` for the call, and `ToolOutput` holding a real `DataTableRoot` rather than JSON. The
  // second consumer of `@kanzo-tech/ai`, and the one that pays for the io parts taking children.
  discovery: DiscoveryShowcase,
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
  return { title: `${name} — Kanzo UI showcase` };
}
