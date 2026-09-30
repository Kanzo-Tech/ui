"use client";

import { createListCollection } from "@ark-ui/react/collection";
import { useFilter } from "@ark-ui/react/locale";
import { useId, useMemo, useState } from "react";
import { tv } from "tailwind-variants";
import { cn } from "../lib/cn";
import {
  Combobox,
  ComboboxContent,
  ComboboxControl,
  ComboboxEmpty,
  ComboboxFieldInput,
  ComboboxInput,
  ComboboxItem,
} from "../simples/combobox";

/**
 * A broad default set of language subtags, offered when the host does not pin `languages`. The
 * search filters it, so its length is not a cost.
 */
const COMMON_LANGUAGES = [
  "en", "es", "fr", "de", "it", "pt", "nl", "ca", "gl", "eu", "ast", "oc",
  "ga", "cy", "sv", "da", "nb", "nn", "fi", "is", "pl", "cs", "sk", "sl",
  "hr", "sr", "bg", "ro", "hu", "el", "tr", "ru", "uk", "ar", "he", "fa",
  "hi", "bn", "ur", "zh", "ja", "ko", "th", "vi", "id", "ms", "sw", "af",
] as const;

/**
 * The language's name in its own language, `es` → "Español", so a reader recognises theirs
 * without knowing its code. Falls back to the tag when the runtime cannot name it, which is also
 * what `Intl.DisplayNames` reports by echoing the code back.
 */
function endonym(tag: string): string {
  try {
    const base = tag.split("-")[0] ?? tag;
    const name = new Intl.DisplayNames([tag], { type: "language" }).of(base);
    if (!name || name.toLowerCase() === base.toLowerCase()) return tag;
    return name.charAt(0).toLocaleUpperCase(tag) + name.slice(1);
  } catch {
    return tag;
  }
}

/**
 * The canonical spelling of a well-formed BCP 47 tag (`ES-mx` → `es-MX`), or `null` when the
 * string is not one. The runtime is the parser: a hand-written pattern accepts what the grammar
 * refuses and refuses what it accepts.
 */
function canonicalTag(text: string): string | null {
  try {
    return Intl.getCanonicalLocales(text.trim())[0] ?? null;
  } catch {
    return null;
  }
}

interface Language {
  code: string;
  name: string;
}

const languagePickerInputVariants = tv({
  variants: {
    // A slot inside another field's control — a trailing addon of a text input — is not a control of
    // its own, so it draws no box, no ring and no chevron of its own: the field around it does.
    inline: {
      true: "w-24 min-w-0 border-0 bg-transparent text-inherit outline-none [font:inherit]",
    },
  },
});

/** The words this control draws, for a product that is not in English. */
export interface LanguagePickerTranslations {
  placeholder: string;
  filterPlaceholder: string;
  noMatches: string;
}

const ENGLISH: LanguagePickerTranslations = {
  placeholder: "Search or type a tag…",
  filterPlaceholder: "Filter…",
  noMatches: "No matches",
};

export interface LanguagePickerProps {
  /** A BCP 47 tag, or `""` for none. */
  value: string;
  /** Called with the tag picked or typed, canonically spelled: `es-mx` arrives as `es-MX`. */
  onValueChange: (tag: string) => void;
  /**
   * The tags on offer. When given, the list is exactly these and a tag outside it cannot be
   * entered; when omitted, a broad default set is offered and any well-formed tag can be typed.
   */
  languages?: readonly string[];
  /**
   * Draw only the input, for a slot inside another field's control — the trailing addon of a text
   * input — rather than a bordered control of its own.
   */
  inline?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  invalid?: boolean;
  className?: string;
  "aria-label"?: string;
  translations?: Partial<LanguagePickerTranslations>;
}

/**
 * A searchable picker for BCP 47 language tags — the `lang` of a string, a page or a document.
 *
 * Each row shows the language's name in its own language beside its tag, "Español · es", and the
 * search matches either, so "spa", "es" and "español" all find it. With `languages` the list is a
 * closed set and an input that matches nothing reverts on blur; without it the list is a set of
 * suggestions, and a well-formed tag nobody listed stands.
 *
 * The list, the roving focus and the popover are `Combobox`'s; what this owns is the vocabulary —
 * the names, the default set and what counts as a tag.
 *
 * ARIA: a `combobox` with a `listbox` popup, as `Combobox` is. Give it an `aria-label` when there
 * is no `FieldLabel` around it.
 */
export const LanguagePicker = (props: LanguagePickerProps) => {
  const {
    value,
    onValueChange,
    languages,
    inline = false,
    disabled,
    readOnly,
    invalid,
    className,
    translations,
    "aria-label": ariaLabel,
  } = props;

  const t = { ...ENGLISH, ...translations };
  const constrained = !!languages?.length;
  const { contains } = useFilter({ sensitivity: "base" });
  const [query, setQuery] = useState("");
  // Inside a `Field` the machine takes its input id from the field, which is right for the
  // field's own control and wrong for a second control in the same field: the text input has
  // already claimed it, and two elements would share it.
  const inputId = useId();

  const items = useMemo<Language[]>(
    () => (languages?.length ? languages : COMMON_LANGUAGES).map((code) => ({ code, name: endonym(code) })),
    [languages]
  );

  // Filtering is ours to own — the machine never mutates a collection. Both the tag and the name
  // match.
  const collection = useMemo(() => {
    const q = query.trim();
    const shown = q ? items.filter((i) => contains(i.code, q) || contains(i.name, q)) : items;
    return createListCollection({
      items: shown,
      itemToValue: (i) => i.code,
      itemToString: (i) => `${i.name} · ${i.code}`,
    });
  }, [items, query, contains]);

  // Memoised because the machine compares by identity: a fresh array per render reads as a value
  // change on every keystroke and resets the text being typed.
  const selected = useMemo(() => (value ? [value] : []), [value]);

  const placeholder = constrained ? t.filterPlaceholder : t.placeholder;

  // A typed tag is committed when the input is left, not per keystroke: "es" is a tag on the way to
  // "es-MX", and committing it there makes the machine swap the text for the name of the language
  // the user was still spelling. A pick has already been reported by `onValueChange`.
  const commitTyped = () => {
    const tag = constrained ? null : canonicalTag(query);
    if (tag && tag !== value) onValueChange(tag);
  };

  return (
    <Combobox
      aria-label={ariaLabel}
      // A tag the host did not list is only admissible when the host listed none.
      allowCustomValue={!constrained}
      collection={collection}
      disabled={disabled}
      ids={inline ? { input: inputId } : undefined}
      invalid={invalid}
      onInputValueChange={(details) => setQuery(details.inputValue)}
      onValueChange={(details) => {
        const picked = details.value[0];
        if (picked) onValueChange(picked);
      }}
      readOnly={readOnly}
      value={selected}
    >
      {inline ? (
        // `ComboboxControl` stays because the popover positions against it.
        <ComboboxControl>
          <ComboboxFieldInput
            className={cn(languagePickerInputVariants({ inline }), className)}
            onBlur={commitTyped}
            placeholder={placeholder}
          />
        </ComboboxControl>
      ) : (
        <ComboboxInput
          className={className}
          onBlur={commitTyped}
          placeholder={placeholder}
          showTrigger={constrained}
        />
      )}
      <ComboboxContent>
        <ComboboxEmpty>{t.noMatches}</ComboboxEmpty>
        {collection.items.map((item) => (
          <ComboboxItem item={item} key={item.code}>
            {item.name} · {item.code}
          </ComboboxItem>
        ))}
      </ComboboxContent>
    </Combobox>
  );
};
