"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Resizable, ResizablePanel, ResizableResizeTrigger, useResizable } from "../simples/resizable.js";
import { XIcon } from "lucide-react";
import { Button } from "../simples/button.js";
import { cn } from "../lib/cn.js";
import { StatusBar, StatusBarStart, type StatusBarPanelButton } from "./StatusBar.js";

/** A dockable side panel: an icon toggle in the status bar + its content. */
export interface PanelDef {
  id: string;
  /** Pre-rendered icon (icon-library agnostic). */
  icon: ReactNode;
  label: string;
  content: ReactNode;
}

export interface WorkspaceLayoutProps {
  /**
   * The canvas (editor, graph, map …). Shrinks side-by-side when the dock opens.
   * Put {@link WorkspaceFloatingControls} and {@link WorkspaceStatusStart} in here too — they
   * used to be the `floatingControls` / `statusLeft` slot props.
   */
  children: ReactNode;
  /** Right dock panels — toggled from the status bar. DATA + behaviour, not a slot. */
  panels: PanelDef[];
  defaultPanel?: string;
  /** Initial dock width as a % of the workspace (Splitter remembers it across toggles). */
  defaultDockSize?: number;
  /** Max dock width as a % (the canvas keeps the remainder as its minimum). */
  maxDockSize?: number;
  /** localStorage key for persisting which panel is open (domain-free default). */
  storageKey?: string;
  onActivePanelChange?: (id: string | null) => void;
}

// ── PanelHeader (reads the close action from context) ─────────────────────
const WorkspaceCtx = createContext<{
  closePanel: () => void;
  /** The status bar's start cluster, once mounted — {@link WorkspaceStatusStart} portals into it. */
  statusStartEl: HTMLElement | null;
}>({ closePanel: () => {}, statusStartEl: null });
export function useWorkspacePanel() {
  return useContext(WorkspaceCtx);
}

/**
 * Canvas-anchored controls (zoom, fit-to-screen, a run action for a graph view). Reserved for
 * things that act ON the canvas — navigation belongs in the page chrome, not floating over
 * the content. Was the `floatingControls` slot prop; write it as a child of the canvas
 * instead, which is the box it anchors to.
 *
 * `end-3` (logical), not `right-3`: the controls hug the inline end, so they mirror in RTL.
 */
export function WorkspaceFloatingControls({ className, ...rest }: ComponentProps<"div">) {
  return (
    <div
      className={cn("absolute bottom-3 end-3 z-30", className)}
      data-slot="workspace-floating-controls"
      {...rest}
    />
  );
}
WorkspaceFloatingControls.displayName = "WorkspaceFloatingControls";

/**
 * Content for the start cluster of the workspace's {@link StatusBar} (was the `statusLeft`
 * slot prop). The bar is owned by {@link WorkspaceLayout} — it has to be, since it renders
 * the panel toggles from `panels` — so this is written as a child anywhere inside the layout
 * and portals into the bar. Renders nothing until the bar is mounted, so keep it to status
 * text, not content that must be in the server-rendered HTML.
 */
export function WorkspaceStatusStart({ children }: { children: ReactNode }) {
  const { statusStartEl } = useWorkspacePanel();
  return statusStartEl ? createPortal(children, statusStartEl) : null;
}
WorkspaceStatusStart.displayName = "WorkspaceStatusStart";

export function PanelHeader({ title }: { title: ReactNode }) {
  const { closePanel } = useWorkspacePanel();
  return (
    <header className="flex h-8 shrink-0 items-center justify-between border-b border-border bg-card px-2">
      <span className="text-xs font-medium text-muted-foreground">{title}</span>
      <Button size="icon-xs" variant="ghost" aria-label="Close panel" onClick={closePanel}>
        <XIcon />
      </Button>
    </header>
  );
}

// ── Persistence (which panel is open — the Splitter owns the sizing) ──────────
function loadPanel(storageKey: string, defaultPanel?: string): string | null {
  if (typeof window === "undefined") return defaultPanel ?? null;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return defaultPanel ?? null;
    const p = JSON.parse(raw) as { panel?: unknown };
    return typeof p.panel === "string" ? p.panel : defaultPanel ?? null;
  } catch {
    return defaultPanel ?? null;
  }
}

/**
 * The one bit of glue: lets a control OUTSIDE the Splitter (the status-bar icons, ⌘\)
 * drive the dock's native collapse. Ark's `ResizableResizeTrigger` already collapses the
 * dock when dragged to the edge (`collapsible` + `collapsedSize: 0`); this just calls the
 * same machine from a button. `expandPanel` restores the pre-collapse width (falling back
 * to `openSize`); `collapsePanel` snaps to 0. Rendered inside `<Resizable>` to read
 * `useResizable()`. Runs only on the open toggle, so it never fights a live drag.
 */
function DockSync({ open, openSize }: { open: boolean; openSize: number }) {
  const api = useResizable();
  useEffect(() => {
    if (open) api.expandPanel("dock", openSize);
    else api.collapsePanel("dock");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return null;
}

/**
 * WorkspaceLayout — the pseudo-IDE shell: a canvas that shrinks side-by-side with a
 * resizable right dock (Ark `Splitter` — keyboard + a11y), optional canvas-anchored
 * controls, and a bottom {@link StatusBar} whose icons toggle dock panels.
 * Domain-free: panel icons are slots and the persistence key is a prop.
 *
 * The shell owns no navigation. A LEFT sidebar is not baked in — compose our `Sidebar`
 * (`SidebarProvider` + `SidebarInset`) around it — and neither is a back control: put
 * it in the page chrome (a `Toolbar` above the canvas, breadcrumbs in the header) where
 * it can be read and reached, rather than floating over the content it obscures.
 *
 * Toggle the dock with ⌘/Ctrl+\, close with Escape; drag the divider to resize, or
 * drag it to the edge to collapse the dock fully.
 */
export function WorkspaceLayout({
  children,
  panels,
  defaultPanel = panels[0]?.id,
  defaultDockSize = 28,
  maxDockSize = 55,
  storageKey = "kz:workspace",
  onActivePanelChange,
}: WorkspaceLayoutProps) {
  const [activePanel, setActivePanel] = useState<string | null>(() =>
    loadPanel(storageKey, defaultPanel),
  );
  const [statusStartEl, setStatusStartEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ panel: activePanel }));
    } catch {
      /* storage unavailable — non-fatal */
    }
  }, [activePanel, storageKey]);

  const setPanel = useCallback(
    (next: string | null) => {
      setActivePanel(next);
      onActivePanelChange?.(next);
    },
    [onActivePanelChange],
  );

  const togglePanel = useCallback((id: string) => setPanel(activePanel === id ? null : id), [activePanel, setPanel]);
  const closePanel = useCallback(() => setPanel(null), [setPanel]);

  // Latest values for the keydown handler, so the listener subscribes once instead of
  // re-binding every render (`panels` is a fresh array from the parent each time).
  const kbd = useRef({ activePanel, defaultPanel, firstPanel: panels[0]?.id });
  kbd.current = { activePanel, defaultPanel, firstPanel: panels[0]?.id };
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const { activePanel, defaultPanel, firstPanel } = kbd.current;
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        setPanel(activePanel ? null : defaultPanel ?? firstPanel ?? null);
      }
      if (e.key === "Escape" && activePanel) closePanel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setPanel, closePanel]);

  const statusPanels: StatusBarPanelButton[] = panels.map(({ id, icon, label }) => ({ id, icon, label }));
  const activePanelContent = panels.find((p) => p.id === activePanel)?.content ?? null;
  const dockOpen = activePanel != null && activePanelContent != null;

  // `<section>` (not `<main>`): this shell is designed to sit inside a `SidebarInset`, which
  // already provides the page's single `<main>` landmark.
  const canvas = (
    <section aria-label="Canvas" className="relative size-full min-w-0 overflow-hidden">
      {/* `absolute inset-0`: the canvas content fills the section without needing to know its
          size. `WorkspaceFloatingControls` sits in here too and anchors to the same box. */}
      <div className="absolute inset-0 z-0">{children}</div>
    </section>
  );

  return (
    <WorkspaceCtx.Provider value={{ closePanel, statusStartEl }}>
      {/* `min-w-0`: as a flex child this box defaults to `min-width:auto`, so the canvas
          content sets a floor the shell cannot shrink below — on a narrowing viewport the
          layout keeps its old width and overflows instead of reflowing. */}
      <div className="relative flex size-full min-w-0 flex-col overflow-hidden bg-background">
        <div className="relative min-h-0 min-w-0 flex-1">
          {/* One Splitter, always mounted. The dock collapses to width 0 (Ark
              `collapsible`/`collapsedSize`) instead of the tree being swapped, so the
              canvas panel — and the live editor inside it — is never remounted. */}
          <Resizable
            panels={[
              { id: "canvas", minSize: 100 - maxDockSize },
              { id: "dock", maxSize: maxDockSize, collapsible: true, collapsedSize: 0 },
            ]}
            defaultSize={[100 - defaultDockSize, defaultDockSize]}
            onCollapse={() => closePanel()}
          >
            <DockSync open={dockOpen} openSize={defaultDockSize} />
            <ResizablePanel id="canvas" className="relative min-w-0">
              {canvas}
            </ResizablePanel>
            {/* A plain divider — the draggable 1px bar with its hit-area, no visible grip
                widget (the dock resizes on hover/drag without the extra chrome). */}
            <ResizableResizeTrigger
              id="canvas:dock"
              className={dockOpen ? undefined : "pointer-events-none opacity-0"}
            />
            <ResizablePanel id="dock" className="flex min-w-0 flex-col overflow-hidden bg-card">
              <aside aria-label="Dock" className="flex h-full min-h-0 flex-col">
                {activePanelContent}
              </aside>
            </ResizablePanel>
          </Resizable>
        </div>

        <StatusBar panels={statusPanels} activePanel={activePanel} onPanelToggle={togglePanel}>
          {/* Always rendered (even empty) so it keeps the start cluster's flex-1 width and
              gives `WorkspaceStatusStart` a stable portal target. */}
          <StatusBarStart ref={setStatusStartEl} />
        </StatusBar>
      </div>
    </WorkspaceCtx.Provider>
  );
}