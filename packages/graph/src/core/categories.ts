import type { Corpus } from "@fossil-lang/corpus";
import type { Binding } from "./channels";

/**
 * **The categorical domain, fixed before a tile arrives.** A column the manifest's `channels:`
 * declares as categorical ranks by its own ordinal, `0` to `domain − 1`; otherwise the host's
 * `categories` keys are the order. Only a value neither names is ranked as it is seen, after them —
 * which is what a legend whose colours moved as tiles arrived was doing for every value.
 */
export function domainOf(
  corpus: Corpus | null,
  typeIndex: number,
  binding: Binding,
  categories: Readonly<Record<string, string>> | undefined,
): readonly unknown[] {
  if (binding.category === undefined) return [];
  const declared = corpus?.types.vertices[typeIndex]?.channels.find(
    (channel) => channel.column === binding.category && channel.scale === "categorical" && channel.domain !== null,
  );
  if (declared?.domain) return Array.from({ length: declared.domain }, (_, ordinal) => ordinal);
  return categories ? Object.keys(categories) : [];
}

/** What a legend, a card or an inspector calls a category value. */
export const nameOf = (value: unknown, categories: Readonly<Record<string, string>> | undefined): string =>
  categories?.[String(value)] ?? String(value ?? "—");
