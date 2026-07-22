"use client";

import { FileCodeIcon, FileJsonIcon, FileTextIcon } from "lucide-react";
import type { ComponentProps } from "react";
import {
  TreeView,
  TreeViewBranch,
  TreeViewBranchContent,
  TreeViewBranchItem,
  TreeViewContent,
  TreeViewItem,
  TreeViewNode,
  TreeViewTree,
  createFileIcons,
  createTreeCollection,
} from "@kanzo-tech/ui";

// Keyed by extension — the icon is resolved from the leaf's own name, so a node never
// has to carry its icon.
const fileIcons = createFileIcons({
  ".json": FileJsonIcon,
  ".md": FileTextIcon,
  ".ttl": FileCodeIcon,
});

const collection = createTreeCollection({
  rootNode: {
    id: "ROOT",
    name: "",
    children: [
      {
        id: "workspace",
        name: "workspace",
        children: [
          { id: "shapes.ttl", name: "shapes.ttl" },
          { id: "manifest.json", name: "manifest.json" },
          { id: "README.md", name: "README.md" },
        ],
      },
    ],
  },
});

const Node = (props: ComponentProps<typeof TreeViewNode>) => {
  const { node, indexPath } = props;

  return (
    <TreeViewNode indexPath={indexPath} node={node}>
      {node.children ? (
        <TreeViewBranch>
          <TreeViewBranchItem>{node.name}</TreeViewBranchItem>
          <TreeViewBranchContent>
            {node.children.map((child, index) => (
              <Node
                indexPath={[...indexPath, index]}
                key={child.id}
                node={child}
              />
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

export default function Example() {
  return (
    <TreeView
      aria-label="Workspace"
      className="max-w-xs"
      collection={collection}
      defaultExpandedValue={["workspace"]}
      fileIcons={fileIcons}
    >
      <TreeViewTree>
        {collection.rootNode.children?.map((node, index) => (
          <Node indexPath={[index]} key={node.id} node={node} />
        ))}
      </TreeViewTree>
    </TreeView>
  );
}
