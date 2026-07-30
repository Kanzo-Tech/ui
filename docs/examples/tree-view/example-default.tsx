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
import { BESTIARY, type TreeNode } from "@/example/bestiary";

interface BeastNode {
  id: string;
  name: string;
  children?: BeastNode[];
}

// The bestiary calls it `label`; the collection wants `name`.
function toNode(node: TreeNode): BeastNode {
  return {
    id: node.id,
    name: node.label,
    ...(node.children ? { children: node.children.map(toNode) } : {}),
  };
}

const collection = createTreeCollection<BeastNode>({
  rootNode: { id: "ROOT", name: "", children: BESTIARY.map(toNode) },
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
      aria-label="The bestiary"
      className="max-w-xs"
      collection={collection}
      defaultExpandedValue={["warm", "warm.flying"]}
    >
      <TreeViewTree>
        {collection.rootNode.children?.map((node, index) => (
          <Node indexPath={[index]} key={node.id} node={node} />
        ))}
      </TreeViewTree>
    </TreeView>
  );
}
