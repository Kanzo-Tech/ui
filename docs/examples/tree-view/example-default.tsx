"use client";

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
  createTreeCollection,
} from "@kanzo-tech/ui";

const collection = createTreeCollection({
  rootNode: {
    id: "ROOT",
    name: "",
    children: [
      {
        id: "shapes",
        name: "shapes",
        children: [
          { id: "customer.ttl", name: "customer.ttl" },
          { id: "order.ttl", name: "order.ttl" },
        ],
      },
      {
        id: "queries",
        name: "queries",
        children: [{ id: "recent.rq", name: "recent.rq" }],
      },
      { id: "README.md", name: "README.md" },
    ],
  },
});

// Recursive: a node is a branch when it has children, a leaf otherwise.
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
      aria-label="Project files"
      className="max-w-xs"
      collection={collection}
      defaultExpandedValue={["shapes"]}
    >
      <TreeViewTree>
        {collection.rootNode.children?.map((node, index) => (
          <Node indexPath={[index]} key={node.id} node={node} />
        ))}
      </TreeViewTree>
    </TreeView>
  );
}
