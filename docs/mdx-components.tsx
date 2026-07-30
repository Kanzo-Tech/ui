import defaultMdxComponents from "fumadocs-ui/mdx";
import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import { Callout } from "fumadocs-ui/components/callout";
import { Card, Cards } from "fumadocs-ui/components/card";
import { File, Files, Folder } from "fumadocs-ui/components/files";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { TypeTable } from "fumadocs-ui/components/type-table";
import type { MDXComponents } from "mdx/types";
import { ComponentPreview } from "@/components/component-preview";
import { ComponentsList } from "@/components/components-list";
import {
  BestiaryTable,
  BoardTable,
  GradesTable,
  HallsTable,
  RolesTable,
  RosterTable,
  StatusesTable,
} from "@/components/guild";
import { PreviewIframe } from "@/components/preview-iframe";
import { ShowcasesList } from "@/components/showcases-list";

/**
 * The single MDX component map, per fumadocs convention — pages get these without importing
 * anything. `ComponentPreview` is ours; the rest are fumadocs' own, used as intended rather
 * than re-implemented in raw markdown.
 */
export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    Accordion,
    Accordions,
    Callout,
    Card,
    Cards,
    File,
    Files,
    Folder,
    Step,
    Steps,
    Tab,
    Tabs,
    TypeTable,
    ComponentPreview,
    ComponentsList,
    PreviewIframe,
    ShowcasesList,
    // The example world's own tables — `/docs/the-guild` is the one page made of them.
    BestiaryTable,
    BoardTable,
    GradesTable,
    HallsTable,
    RolesTable,
    RosterTable,
    StatusesTable,
    ...components,
  };
}
