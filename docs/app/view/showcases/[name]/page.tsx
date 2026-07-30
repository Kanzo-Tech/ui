import { notFound } from "next/navigation";
import { AppShellShowcase } from "@/showcases/app-shell/default";
import { MetadataFormShowcase } from "@/showcases/metadata-form/default";
import { Base16Showcase } from "@/showcases/palette-onboarding/base16";
import { PaletteOnboardingShowcase } from "@/showcases/palette-onboarding/default";
import { PreferencesShowcase } from "@/showcases/preferences/default";
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
  // Not a shell like the other two, but it needs the same treatment: the Preferences panel is
  // Portal-ed and `position: fixed`, so it can only be shown honestly in its own viewport. The
  // -fonts and -extended variants are the doc's other two examples, each a real panel with a
  // custom `PreferencesPanel` child set rather than loose sections in a box.
  preferences: PreferencesShowcase,
  "preferences-fonts": PreferencesFontsShowcase,
  "preferences-extended": PreferencesExtendedShowcase,
  // The colour half of the theme, which is not a panel at all. Both are SERVER components: they
  // run `derivePalette` at build time, which is where that cost belongs.
  "palette-onboarding": PaletteOnboardingShowcase,
  "palette-base16": Base16Showcase,
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
