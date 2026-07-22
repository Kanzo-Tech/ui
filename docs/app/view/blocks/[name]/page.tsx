import { notFound } from "next/navigation";
import { AppShellBlock } from "@/blocks/app-shell/default";
import { WorkspaceBlock } from "@/blocks/workspace/default";

/**
 * Standalone, chrome-free route for a block, one per name.
 *
 * Blocks are shells: they claim the viewport, own their own scrolling and are judged at full
 * width. Rendering one inside the docs layout would put it in a content column and prove
 * nothing, so it gets its own page and the docs embed that page in an iframe.
 */
const BLOCKS = {
  "app-shell": AppShellBlock,
  workspace: WorkspaceBlock,
} as const;

type BlockName = keyof typeof BLOCKS;

export function generateStaticParams() {
  return Object.keys(BLOCKS).map((name) => ({ name }));
}

export default async function Page(props: { params: Promise<{ name: string }> }) {
  const { name } = await props.params;
  const Block = BLOCKS[name as BlockName];
  if (!Block) notFound();
  return <Block />;
}

export async function generateMetadata(props: { params: Promise<{ name: string }> }) {
  const { name } = await props.params;
  return { title: `${name} — Kanzo UI block` };
}
