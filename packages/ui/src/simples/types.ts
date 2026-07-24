/** A selectable option for {@link Combobox} — deliberately domain-free. */
export interface ComboboxOption {
  value: string;
  label: string;
}

/** A streamed value candidate produced by `useSuggestions`. */
export interface Suggestion {
  /** Primitive value committed when the row is picked. */
  value: string;
  /** Human label; defaults to `value`. */
  label?: string;
  /** Optional rationale shown under the label. */
  rationale?: string;
}
