"use client";

import {
  SearchQuery,
  closeSearchPanel,
  findNext,
  findPrevious,
  getSearchQuery,
  replaceAll,
  replaceNext,
  search,
  selectMatches,
  setSearchQuery,
} from "@codemirror/search";
import type { Extension } from "@codemirror/state";
import { type EditorView, type Panel, runScopeHandlers } from "@codemirror/view";
import {
  CaseSensitiveIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  RegexIcon,
  ReplaceAllIcon,
  ReplaceIcon,
  TextSelectIcon,
  WholeWordIcon,
  XIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../simples/button";
import { ButtonGroup } from "../simples/button-group";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "../simples/input-group";
import { Toggle } from "../simples/toggle";

/**
 * The find/replace panel, built from this library's own controls.
 *
 * `@codemirror/search` lets the panel be replaced wholesale — `search({ createPanel })`, where a
 * `Panel` is an object with a `dom` — so the editor hands CodeMirror an empty element and renders
 * into it with `createPortal`. **The search itself is not reimplemented:** `setSearchQuery`,
 * `findNext`, `findPrevious`, `replaceNext`, `replaceAll` and `getSearchQuery` are all public, and
 * they are the whole of the behaviour here. What changes is who draws the form.
 *
 * It buys the one thing a CSS override could not: the panel stops being the piece of the editor
 * with its own typography, its own buttons and its own focus ring. Six selectors went with it —
 * `.cm-panel.cm-search`, its font-size reset, the two `.cm-textfield` rules and the two for
 * `button[name=close]`. **`.cm-textfield` and `.cm-button` themselves stay**, unscoped, because
 * `gotoLine`'s dialog is still CodeMirror's own and because `codemirror-dark-parity.test.ts` reads
 * that list: they are what stands between a dark page and CodeMirror's `&light` white box.
 */

/**
 * How a `Panel` is opened as React. `CodeEditor` owns the implementation because the portals have
 * to be children of its tree — a panel rendered from anywhere else loses the theme context, the
 * error boundary and every provider above it.
 */
export interface ReactPanelHost {
  panel: (node: ReactNode, opts?: { top?: boolean }) => Panel;
}

interface CodeSearchPanelProps {
  view: EditorView;
  /** Fires when the query or `readOnly` changed under us — see `kanzoSearch`. */
  subscribe: (fn: () => void) => () => void;
}

const CodeSearchPanel = (props: CodeSearchPanelProps) => {
  const { view, subscribe } = props;

  const [query, setQuery] = useState(() => getSearchQuery(view.state));
  const [readOnly, setReadOnly] = useState(() => view.state.readOnly);
  const searchField = useRef<HTMLInputElement>(null);
  const replaceField = useRef<HTMLInputElement>(null);

  // The query is not ours alone: Mod-F over a selection seeds it while the panel is already open,
  // and `selectSelectionMatches` writes it too. Both arrive as a `setSearchQuery` effect.
  useEffect(
    () =>
      subscribe(() => {
        setQuery(getSearchQuery(view.state));
        setReadOnly(view.state.readOnly);
      }),
    [subscribe, view]
  );

  // CodeMirror focuses the field itself only when the panel is REOPENED (it looks for
  // `[main-field]`). On the first open it calls the panel's `mount()`, which runs before React has
  // rendered anything into the element — so the first focus is ours.
  useEffect(() => {
    searchField.current?.select();
  }, []);

  const commit = (patch: Partial<ConstructorParameters<typeof SearchQuery>[0]>) => {
    const next = new SearchQuery({
      search: query.search,
      caseSensitive: query.caseSensitive,
      literal: query.literal,
      regexp: query.regexp,
      replace: query.replace,
      wholeWord: query.wholeWord,
      ...patch,
    });
    if (next.eq(query)) return;
    setQuery(next);
    view.dispatch({ effects: setSearchQuery.of(next) });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // The panel is inside the editor but outside its `contenteditable`, so the editor's own key
    // handling never sees these. `search-panel` is the scope `searchKeymap` registers for exactly
    // this: Escape closes, Mod-G and F3 step, Mod-F refocuses.
    if (runScopeHandlers(view, e.nativeEvent, "search-panel")) {
      e.preventDefault();
      return;
    }
    if (e.key !== "Enter") return;
    if (e.target === searchField.current) {
      e.preventDefault();
      (e.shiftKey ? findPrevious : findNext)(view);
    } else if (e.target === replaceField.current) {
      e.preventDefault();
      replaceNext(view);
    }
  };

  return (
    // Two rows on ONE grid, not two flex rows. The fields have to end on the same line and the
    // clusters beside them have to start on it, and the two clusters are a different number of
    // buttons — so that column has to be sized by the wider of them, which is what a shared grid
    // track does and what a pair of flex rows cannot.
    //
    // `font-sans` is the point of the file: everything inside `.cm-editor` inherits the monospace
    // stack, so a panel that says nothing renders its labels in code type.
    <div
      className="grid grid-cols-[1fr_auto_auto] items-center gap-1.5 p-1.5 font-sans"
      data-slot="code-editor-search"
      onKeyDown={onKeyDown}
    >
      <InputGroup size="sm">
        <InputGroupInput
          aria-label="Find"
          main-field="true"
          onChange={(e) => commit({ search: e.currentTarget.value })}
          placeholder="Find"
          ref={searchField}
          size="sm"
          value={query.search}
        />
        <InputGroupAddon align="inline-end">
          <Toggle
            aria-label="Match case"
            onPressedChange={(pressed) => commit({ caseSensitive: pressed })}
            pressed={query.caseSensitive}
            size="sm"
          >
            <CaseSensitiveIcon />
          </Toggle>
          <Toggle
            aria-label="Whole word"
            onPressedChange={(pressed) => commit({ wholeWord: pressed })}
            pressed={query.wholeWord}
            size="sm"
          >
            <WholeWordIcon />
          </Toggle>
          <Toggle
            aria-label="Regular expression"
            onPressedChange={(pressed) => commit({ regexp: pressed })}
            pressed={query.regexp}
            size="sm"
          >
            <RegexIcon />
          </Toggle>
        </InputGroupAddon>
      </InputGroup>
      <ButtonGroup aria-label="Find">
        <Button
          aria-label="Previous match"
          onClick={() => findPrevious(view)}
          size="icon-lg"
          variant="outline"
        >
          <ChevronUpIcon />
        </Button>
        <Button
          aria-label="Next match"
          onClick={() => findNext(view)}
          size="icon-lg"
          variant="outline"
        >
          <ChevronDownIcon />
        </Button>
        <Button
          aria-label="Select all matches"
          onClick={() => selectMatches(view)}
          size="icon-lg"
          variant="outline"
        >
          <TextSelectIcon />
        </Button>
      </ButtonGroup>
      <Button
        aria-label="Close"
        onClick={() => closeSearchPanel(view)}
        size="icon-lg"
        variant="ghost"
      >
        <XIcon />
      </Button>
      {/* A read-only document has nothing to replace, and CodeMirror's own panel drops the row
          for the same reason. The third column stays empty on this row. */}
      {!readOnly && (
        <>
          <InputGroup size="sm">
            <InputGroupInput
              aria-label="Replace"
              onChange={(e) => commit({ replace: e.currentTarget.value })}
              placeholder="Replace"
              ref={replaceField}
              size="sm"
              value={query.replace}
            />
          </InputGroup>
          <ButtonGroup aria-label="Replace">
            <Button
              aria-label="Replace"
              onClick={() => replaceNext(view)}
              size="icon-lg"
              variant="outline"
            >
              <ReplaceIcon />
            </Button>
            <Button
              aria-label="Replace all"
              onClick={() => replaceAll(view)}
              size="icon-lg"
              variant="outline"
            >
              <ReplaceAllIcon />
            </Button>
          </ButtonGroup>
        </>
      )}
    </div>
  );
};

/**
 * `@codemirror/search`, drawn by `CodeSearchPanel`.
 *
 * The `update` hook is the panel's only channel back into React: CodeMirror gives a `Panel` a
 * `ViewUpdate` on every transaction, and re-rendering the form on each keystroke of the document
 * would be absurd — so it compares the query and `readOnly` and notifies only when one of them
 * moved. `SearchQuery.eq` is what makes that cheap, and it is also what keeps our own
 * `setSearchQuery` from looping back through the component.
 */
export const kanzoSearch = (host: ReactPanelHost): Extension =>
  search({
    createPanel: (view) => {
      const listeners = new Set<() => void>();
      let query = getSearchQuery(view.state);
      let readOnly = view.state.readOnly;

      const panel = host.panel(
        <CodeSearchPanel
          subscribe={(fn) => {
            listeners.add(fn);
            return () => {
              listeners.delete(fn);
            };
          }}
          view={view}
        />,
        { top: true }
      );

      return {
        ...panel,
        update: (u) => {
          const next = getSearchQuery(u.state);
          if (next.eq(query) && u.state.readOnly === readOnly) return;
          query = next;
          readOnly = u.state.readOnly;
          for (const fn of listeners) fn();
        },
      };
    },
  });
