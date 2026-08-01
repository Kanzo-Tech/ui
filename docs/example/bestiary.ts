// The bestiary, as a tree — the hierarchy fixture.
//
// A tree needs uneven depth to be worth rendering: a uniform three-level tree makes an expander
// look decorative and never shows a leaf beside a branch at the same level. This one runs two to
// four deep, and the entries at the bottom are the eight beasts the board and the charts share.

import { BEASTS, type BeastId } from "./world";

export interface TreeNode {
  id: string;
  /** `name`, not `label` — this is the key `createTreeCollection` reads. */
  name: string;
  /** Set on the leaves that are a beast the rest of the world knows about. */
  beast?: BeastId;
  /** Field notes, for a tree that shows a description or a tooltip. */
  note?: string;
  children?: TreeNode[];
}

const habit = (id: BeastId) => BEASTS.find((entry) => entry.id === id)?.habit;

export const BESTIARY: TreeNode[] = [
  {
    id: "warm",
    name: "Warm-blooded",
    children: [
      {
        id: "warm.flying",
        name: "Flying",
        children: [
          { id: "harpy", name: "Harpy", beast: "harpy", note: habit("harpy") },
          {
            id: "warm.flying.lesser",
            name: "Lesser",
            children: [
              { id: "grimalkin", name: "Grimalkin", beast: "grimalkin", note: habit("grimalkin") },
            ],
          },
        ],
      },
      {
        id: "warm.pack",
        name: "Pack",
        children: [{ id: "boghound", name: "Bog-hound", beast: "boghound", note: habit("boghound") }],
      },
    ],
  },
  {
    id: "cold",
    name: "Cold-blooded",
    children: [
      { id: "wyrm", name: "Wyrm", beast: "wyrm", note: habit("wyrm") },
      { id: "basilisk", name: "Basilisk", beast: "basilisk", note: habit("basilisk") },
      { id: "stoneback", name: "Stoneback", beast: "stoneback", note: habit("stoneback") },
    ],
  },
  {
    id: "unclassed",
    name: "Unclassed",
    note: "The archivists argue about this branch every winter",
    children: [
      { id: "revenant", name: "Revenant", beast: "revenant", note: habit("revenant") },
      { id: "mimic", name: "Mimic", beast: "mimic", note: habit("mimic") },
      {
        id: "unclassed.disputed",
        name: "Disputed",
        children: [
          { id: "unclassed.disputed.lantern", name: "The lantern that walks", note: "Three sightings, no body" },
          { id: "unclassed.disputed.hedge", name: "The moving hedge", note: "Greenhollow only. Probably surveying error." },
        ],
      },
    ],
  },
];

/** Depth-first walk, for a fixture that wants a flat list of every node. */
export function flattenBestiary(nodes: readonly TreeNode[] = BESTIARY): TreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenBestiary(node.children ?? [])]);
}
