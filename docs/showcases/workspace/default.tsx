"use client";

import { useState, type ComponentProps } from "react";
import {
  Badge,
  Breadcrumbs,
  Button,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  Toaster,
  Resizable,
  ResizablePanel,
  ResizableResizeTrigger,
  ShellFooter,
  ShellHeader,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TreeView,
  TreeViewBranch,
  TreeViewBranchContent,
  TreeViewBranchItem,
  TreeViewContent,
  TreeViewItem,
  TreeViewNode,
  TreeViewTree,
  createTreeCollection,
  toast,
} from "@kanzo-tech/ui";
import { CodeEditor } from "@kanzo-tech/ui/editor";
import { json } from "@codemirror/lang-json";
import {
  ArrowLeftIcon,
  CodeIcon,
  DatabaseIcon,
  FileTextIcon,
  ListIcon,
  PlayIcon,
  SearchIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { SAMPLE_MAPPING } from "./data";

interface Node {
  id: string;
  name: string;
  children?: Node[];
}

const tree = createTreeCollection<Node>({
  nodeToValue: (n) => n.id,
  nodeToString: (n) => n.name,
  rootNode: {
    id: "ROOT",
    name: "",
    children: [
      {
        id: "shapes",
        name: "shapes",
        children: [
          { id: "dataset.shex", name: "dataset.shex" },
          { id: "distribution.shex", name: "distribution.shex" },
        ],
      },
      {
        id: "mappings",
        name: "mappings",
        children: [
          { id: "aemet.fossil", name: "aemet.fossil" },
          { id: "crm.fossil", name: "crm.fossil" },
        ],
      },
      { id: "catalog.ttl", name: "catalog.ttl" },
    ],
  },
});

/**
 * The two-sided IDE at full viewport: the Sidebar as the explorer, a canvas plus resizable
 * dock built from Ark's Splitter, a real CodeMirror editor on the canvas, and a status strip
 * driving the panels.
 *
 * This used to be the `WorkspaceLayout` component. It is a SHOWCASE now, which is the point:
 * the arrangement is specific to an IDE-shaped product, and so are the things it carries —
 * panel state, the dense 11px chrome, which panel is open. The library ships the regions; this
 * file shows one way to arrange them.
 */
const PANELS = [
  { id: "outline", icon: <ListIcon />, label: "Outline" },
  { id: "issues", icon: <TriangleAlertIcon />, label: "Issues" },
  { id: "preview", icon: <DatabaseIcon />, label: "Preview" },
];

/** The dock's own header strip. Was `PanelHeader` in WorkspaceLayout, which duplicated the
 *  toolbar recipe by copy; here it is just the same classes, in the one place that uses them. */
function PanelHeader({ title }: { title: string }) {
  return (
    <ShellHeader className="h-8 flex-row items-center px-2 text-[11px] text-muted-foreground">
      <span className="font-medium">{title}</span>
    </ShellHeader>
  );
}

export function WorkspaceShowcase() {
  const [source, setSource] = useState(SAMPLE_MAPPING);
  // Panel state is the SHOWCASE's, not the library's. WorkspaceLayout used to own this plus
  // localStorage persistence, a portal into the status bar and a global Escape listener — all
  // product concerns, which is why they live here now and not behind a component API.
  const [panel, setPanel] = useState<string | null>("outline");

  return (
    // `h-svh`: SidebarProvider defaults to `min-h-svh` (right for page-scrolling apps), but a
    // shell that owns the viewport needs a RESOLVED height — the splitter sizes itself with
    // `height: 100%`, and a percentage against an auto-height parent falls back to auto,
    // collapsing the splitter and the editor to content height.
    <SidebarProvider className="h-svh">
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-1">
            <SidebarTrigger />
            <span className="font-semibold text-sm group-data-[collapsible=icon]:hidden">
              Explorer
            </span>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive tooltip="Files">
                  <FileTextIcon />
                  <span>Files</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Search">
                  <SearchIcon />
                  <span>Search</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Queries">
                  <CodeIcon />
                  <span>Queries</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>

          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <div className="px-1">
              <TreeView
                aria-label="Workspace files"
                collection={tree}
                defaultExpandedValue={["mappings"]}
              >
                <TreeViewTree>
                  {tree.rootNode.children?.map((node, index) => (
                    <TreeNode indexPath={[index]} key={node.id} node={node} />
                  ))}
                </TreeViewTree>
              </TreeView>
            </div>
          </SidebarGroup>
        </SidebarContent>
        <SidebarRail />
      </Sidebar>

      {/* `min-w-0` so the inset can shrink below its content's intrinsic width (a flex child
          defaults to `min-width:auto`), `min-h-0` so it does not grow past the viewport, and
          `overflow-hidden` so the shell scrolls internally. */}
      <SidebarInset className="min-h-0 min-w-0 overflow-hidden">
        {/* Canvas + dock, composed from Ark's Splitter directly. WorkspaceLayout used to
            wrap this; it drove the same `useResizable()` API underneath, so nothing behavioural
            is lost by composing it here — only the component that hid it. */}
        <Resizable
          className="min-h-0 flex-1"
          defaultSize={panel ? [70, 30] : [100, 0]}
          panels={[{ id: "canvas", minSize: 40 }, { id: "dock", minSize: 0 }]}
        >
          <ResizablePanel className="flex min-w-0 flex-col" id="canvas">
            <ShellHeader className="h-8 flex-row items-center gap-2 bg-card px-2 text-[11px] text-muted-foreground">
              <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                {/* Back lives here, in the chrome — legible, in the tab order, and not sitting
                    on top of the code it would otherwise cover. */}
                <Button aria-label="Back to dashboard" asChild size="icon-xs" variant="ghost">
                  <a href="#/app">
                    <ArrowLeftIcon />
                  </a>
                </Button>
                <Breadcrumbs
                  className="text-[length:var(--kanzo-font-size-small)]"
                  items={[
                    { label: "Kanzo", href: "#/app" },
                    { label: "mappings", href: "#/workspace" },
                    { label: "aemet.fossil" },
                  ]}
                />
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <span>fossil</span>
                <Button size="xs" variant="ghost">
                  Format
                </Button>
                <Button
                  onClick={() => toast.create({ title: "Run started", type: "info" })}
                  size="xs"
                >
                  <PlayIcon />
                  Run
                </Button>
              </div>
            </ShellHeader>

            {/* No `overflow-auto` here: CodeMirror's own `.cm-scroller` scrolls. Wrapping it in
                a second scroller collapses the editor to its content height and leaves the
                canvas half empty. */}
            <div className="min-h-0 min-w-0 flex-1">
              <CodeEditor
                chrome={false}
                className="h-full"
                extensions={json()}
                lineNumbers
                onChange={setSource}
                value={source}
              />
            </div>
          </ResizablePanel>

          <ResizableResizeTrigger
            className={panel ? undefined : "pointer-events-none opacity-0"}
            id="canvas:dock"
          />

          <ResizablePanel className="flex min-w-0 flex-col border-s border-border bg-card" id="dock">
            {panel === "outline" && (
              <>
                <PanelHeader title="Outline" />
                <div className="space-y-1 p-3 text-sm">
                  <p className="font-medium">Dataset</p>
                  <ul className="space-y-1 ps-3 text-muted-foreground text-xs">
                    <li>dct:title</li>
                    <li>dct:issued</li>
                    <li>dcat:keyword</li>
                  </ul>
                </div>
              </>
            )}
            {panel === "issues" && (
              <>
                <PanelHeader title="Issues" />
                <div className="space-y-2 p-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Badge size="xs" variant="warning">
                      warn
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      <code>.keywords[]</code> has no declared datatype.
                    </span>
                  </div>
                </div>
              </>
            )}
            {panel === "preview" && (
              <>
                <PanelHeader title="Preview" />
                <div className="p-3 font-mono text-muted-foreground text-xs">
                  21 vertices · 61 edges
                </div>
              </>
            )}
          </ResizablePanel>
        </Resizable>

        {/* The status strip. The IDE density is the SHOWCASE's — ShellFooter imposes no
            height, surface or typography. The panel toggles are an Ark ToggleGroup composed
            here, which is where StatusBar's `panels` prop went. */}
        <ShellFooter
          aria-label="Status"
          className="h-[1.625rem] flex-row items-center gap-2 bg-card px-1.5 text-[11px] text-muted-foreground"
          role="contentinfo"
        >
          <span className="min-w-0 flex-1 truncate">aemet.fossil · 1,204 triples</span>

          <ToggleGroup
            aria-label="Panels"
            className="shrink-0 gap-0.5 rounded-none"
            multiple
            onValueChange={({ value }) => {
              const hit = value.find((id) => id !== panel) ?? panel;
              setPanel(hit === panel ? null : (hit ?? null));
            }}
            spacing={0.5}
            value={panel ? [panel] : []}
          >
            {PANELS.map(({ id, icon, label }) => (
              // ToggleGroupItem must be OUTER and the tooltip trigger its asChild. Invert it
              // and the tooltip overwrites the item's data-scope/data-part, zag collects zero
              // items, and roving focus dies silently.
              <Tooltip key={id} positioning={{ placement: "top" }}>
                <ToggleGroupItem
                  aria-label={label}
                  asChild
                  className="h-[22px] w-[26px] min-w-0 rounded-sm px-0 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground [&_svg]:size-4"
                  value={id}
                >
                  <TooltipTrigger>{icon}</TooltipTrigger>
                </ToggleGroupItem>
                <TooltipContent>{label}</TooltipContent>
              </Tooltip>
            ))}
          </ToggleGroup>
        </ShellFooter>
      </SidebarInset>

      <Toaster />
    </SidebarProvider>
  );
}

// Recursive node renderer — the canonical TreeView composition (branch vs leaf).
const TreeNode = (props: ComponentProps<typeof TreeViewNode>) => {
  const { node, indexPath } = props;
  return (
    <TreeViewNode indexPath={indexPath} node={node}>
      {node.children ? (
        <TreeViewBranch>
          <TreeViewBranchItem>{node.name}</TreeViewBranchItem>
          <TreeViewBranchContent>
            {node.children.map((child: Node, index: number) => (
              <TreeNode indexPath={[...indexPath, index]} key={child.id} node={child} />
            ))}
          </TreeViewBranchContent>
        </TreeViewBranch>
      ) : (
        <TreeViewContent>
          <TreeViewItem>{node.name}</TreeViewItem>
        </TreeViewContent>
      )}
    </TreeViewNode>
  );
};

export default WorkspaceShowcase;
