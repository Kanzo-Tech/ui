"use client";

import { useState, type ComponentProps } from "react";
import {
  Badge,
  Breadcrumbs,
  Button,
  PanelHeader,
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
  Toolbar,
  TreeView,
  TreeViewBranch,
  TreeViewBranchContent,
  TreeViewBranchItem,
  TreeViewContent,
  TreeViewItem,
  TreeViewNode,
  TreeViewTree,
  WorkspaceLayout,
  createTreeCollection,
  toast,
} from "@kanzo-tech/ui";
import { EditorShell } from "@kanzo-tech/ui/editor";
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
 * The two-sided IDE at full viewport: the Sidebar as the explorer, WorkspaceLayout as canvas
 * plus resizable dock, a real CodeMirror editor on the canvas, and the status bar driving the
 * panels. This is the arrangement WorkspaceLayout documents — and the only way to judge the
 * dock drag and the collapse-to-icons behaviour.
 */
export function WorkspaceBlock() {
  const [source, setSource] = useState(SAMPLE_MAPPING);

  return (
    // `h-svh`: SidebarProvider defaults to `min-h-svh` (right for page-scrolling apps), but a
    // shell that owns the viewport needs a RESOLVED height — WorkspaceLayout sizes itself with
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
        <WorkspaceLayout
          panels={[
            {
              id: "outline",
              icon: <ListIcon />,
              label: "Outline",
              content: (
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
              ),
            },
            {
              id: "issues",
              icon: <TriangleAlertIcon />,
              label: "Issues",
              content: (
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
              ),
            },
            {
              id: "preview",
              icon: <DatabaseIcon />,
              label: "Preview",
              content: (
                <>
                  <PanelHeader title="Preview" />
                  <div className="p-3 font-mono text-muted-foreground text-xs">
                    21 vertices · 61 edges
                  </div>
                </>
              ),
            },
          ]}
          statusLeft={<span>aemet.fossil · 1,204 triples</span>}
        >
          <div className="flex h-full flex-col">
            <Toolbar
              actions={
                <>
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
                </>
              }
              // Back lives here, in the chrome — legible, in the tab order, and not sitting on
              // top of the code it would otherwise cover.
              leading={
                <Button aria-label="Back to dashboard" asChild size="icon-xs" variant="ghost">
                  <a href="#/app">
                    <ArrowLeftIcon />
                  </a>
                </Button>
              }
              left={
                <Breadcrumbs
                  // Shrunk to the toolbar's own scale — the primitive keeps the `text-sm`
                  // default, and the thin IDE strip opts down to 11px.
                  className="text-[length:var(--kanzo-font-size-small)]"
                  items={[
                    { label: "Kanzo", href: "#/app" },
                    { label: "mappings", href: "#/workspace" },
                    { label: "aemet.fossil" },
                  ]}
                />
              }
              right={<span>fossil</span>}
            />
            {/* No `overflow-auto` here: CodeMirror's own `.cm-scroller` scrolls. Wrapping it in
                a second scroller collapses the editor to its content height and leaves the
                canvas half empty. */}
            <div className="min-h-0 min-w-0 flex-1">
              <EditorShell
                chrome={false}
                className="h-full"
                extensions={json()}
                lineNumbers
                onChange={setSource}
                value={source}
              />
            </div>
          </div>
        </WorkspaceLayout>
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

export default WorkspaceBlock;
