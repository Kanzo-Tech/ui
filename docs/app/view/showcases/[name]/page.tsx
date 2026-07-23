import { notFound } from "next/navigation";
import { AppShellShowcase } from "@/showcases/app-shell/default";
import { MetadataFormShowcase } from "@/showcases/metadata-form/default";
import { PreferencesShowcase } from "@/showcases/preferences/default";
import { WorkspaceShowcase } from "@/showcases/workspace/default";

/**
 * Standalone, chrome-free route for a showcase, one per name.
 *
 * Showcases are whole arrangements: they claim the viewport, own their own scrolling and are judged at full
 * width. Rendering one inside the docs layout would put it in a content column and prove
 * nothing, so it gets its own page and the docs embed that page in an iframe.
 */
const BLOCKS = {
  "app-shell": AppShellShowcase,
  "metadata-form": MetadataFormShowcase,
  workspace: WorkspaceShowcase,
  // Not a shell like the other two, but it needs the same treatment: the Preferences panel is
  // Portal-ed and `position: fixed`, so it can only be shown honestly in its own viewport.
  preferences: PreferencesShowcase,
} as const;

type BlockName = keyof typeof BLOCKS;

export function generateStaticParams() {
  return Object.keys(BLOCKS).map((name) => ({ name }));
}

export default async function Page(props: { params: Promise<{ name: string }> }) {
  const { name } = await props.params;
  const Showcase = BLOCKS[name as BlockName];
  if (!Showcase) notFound();
  return <Showcase />;
}

export async function generateMetadata(props: { params: Promise<{ name: string }> }) {
  const { name } = await props.params;
  return { title: `${name} — Kanzo UI showcase` };
}
