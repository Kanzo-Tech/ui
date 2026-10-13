/**
 * **A catalog's name in a reader's words** — a type, an edge's label, a column: `isLocatedIn` → *is
 * located in*, `TagClass` → *tag class*, `birth_date` → *birth date*; an acronym keeps its case. Its
 * last word is made plural when `count` is not 1 — *tag classes*, *universities* — by the English
 * rules a catalog's nouns mostly follow; a host whose noun breaks them says its own (`RelationPicker`'s
 * `plural`). What `RelationPicker` says a hop with, and what an Ask answer is titled and summed up in.
 */
export function nameWords(name: string, count = 1): string {
  const w = name
    .split(/(?<=[a-z0-9])(?=[A-Z])|[_\s-]+/)
    .filter(Boolean)
    .map((s) => (s.length > 1 && s === s.toUpperCase() ? s : s.toLowerCase()));
  const last = w.pop() ?? name;
  const many = count === 1 ? last : /(s|x|z|ch|sh)$/.test(last) ? `${last}es` : /[^aeiou]y$/.test(last) ? `${last.slice(0, -1)}ies` : `${last}s`;
  return [...w, many].join(" ");
}
