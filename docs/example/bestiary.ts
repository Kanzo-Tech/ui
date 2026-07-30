// The bestiary, as a tree — the hierarchy fixture.
//
// A tree needs uneven depth to be worth rendering: a uniform three-level tree makes an expander
// look decorative and never shows a leaf beside a branch at the same level. This one runs two to
// four deep, and the entries at the bottom are the eight beasts the board and the charts share.

import { BEASTS, type BeastId } from "./world";

export interface TreeNode {
  id: string;
  label: string;
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
    label: "Warm-blooded",
    children: [
      {
        id: "warm.flying",
        label: "Flying",
        children: [
          { id: "harpy", label: "Harpy", beast: "harpy", note: habit("harpy") },
          {
            id: "warm.flying.lesser",
            label: "Lesser",
            children: [
              { id: "grimalkin", label: "Grimalkin", beast: "grimalkin", note: habit("grimalkin") },
            ],
          },
        ],
      },
      {
        id: "warm.pack",
        label: "Pack",
        children: [{ id: "boghound", label: "Bog-hound", beast: "boghound", note: habit("boghound") }],
      },
    ],
  },
  {
    id: "cold",
    label: "Cold-blooded",
    children: [
      { id: "wyrm", label: "Wyrm", beast: "wyrm", note: habit("wyrm") },
      { id: "basilisk", label: "Basilisk", beast: "basilisk", note: habit("basilisk") },
      { id: "stoneback", label: "Stoneback", beast: "stoneback", note: habit("stoneback") },
    ],
  },
  {
    id: "unclassed",
    label: "Unclassed",
    note: "The archivists argue about this branch every winter",
    children: [
      { id: "revenant", label: "Revenant", beast: "revenant", note: habit("revenant") },
      { id: "mimic", label: "Mimic", beast: "mimic", note: habit("mimic") },
      {
        id: "unclassed.disputed",
        label: "Disputed",
        children: [
          { id: "unclassed.disputed.lantern", label: "The lantern that walks", note: "Three sightings, no body" },
          { id: "unclassed.disputed.hedge", label: "The moving hedge", note: "Greenhollow only. Probably surveying error." },
        ],
      },
    ],
  },
];

/** Depth-first walk, for a fixture that wants a flat list of every node. */
export function flattenBestiary(nodes: readonly TreeNode[] = BESTIARY): TreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenBestiary(node.children ?? [])]);
}
