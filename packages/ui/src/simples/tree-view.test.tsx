import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  createTreeCollection,
  TreeView,
  TreeViewBranch,
  TreeViewBranchContent,
  TreeViewBranchItem,
  TreeViewContent,
  TreeViewItem,
  TreeViewNode,
  TreeViewTree,
  type TreeNodeType,
} from "./tree-view.js";

const collection = createTreeCollection({
  rootNode: {
    id: "root",
    name: "",
    children: [
      { id: "src", name: "src", children: [{ id: "index.ts", name: "index.ts" }] },
      { id: "README.md", name: "README.md" },
    ],
  },
});

const Node = ({ node, indexPath }: { node: TreeNodeType; indexPath: number[] }) => (
  <TreeViewNode indexPath={indexPath} node={node}>
    {node.children ? (
      <TreeViewBranch>
        <TreeViewBranchItem>{node.name}</TreeViewBranchItem>
        <TreeViewBranchContent>
          {node.children.map((child, i) => (
            <Node indexPath={[...indexPath, i]} key={child.id} node={child} />
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

describe("TreeView", () => {
  it("paints a row's focus for the keyboard only, not the tab stop Ark marks at rest", () => {
    const { container } = render(
      <TreeView collection={collection}>
        <TreeViewTree>
          {collection.rootNode.children?.map((node, i) => (
            <Node indexPath={[i]} key={node.id} node={node} />
          ))}
        </TreeViewTree>
      </TreeView>
    );

    // Nothing has been focused, and Ark still marks the first node as its tab stop.
    const atRest = container.querySelector("[data-slot=tree-view-branch-control]");
    expect(atRest?.hasAttribute("data-focus")).toBe(true);
    expect(document.activeElement).toBe(document.body);

    const rows = container.querySelectorAll("[data-slot=tree-view-branch-control], [data-slot=tree-view-item]");
    expect(rows.length).toBeGreaterThan(1);
    for (const row of rows) {
      const classes = row.className.split(/\s+/);
      expect(classes.filter((c) => c.startsWith("data-focus:"))).toEqual([]);
      expect(classes).toContain("focus-visible:bg-muted");
    }
  });
});
