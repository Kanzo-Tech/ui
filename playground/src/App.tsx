import { useEffect, useState } from "react";
import { Kbd, Preferences, Toaster } from "@kanzo-tech/ui";
import { ErrorBoundary } from "./ErrorScreen.js";
import { Gallery } from "./Gallery.js";
import { AppScene } from "./scenes/AppScene.js";
import { WorkspaceScene } from "./scenes/WorkspaceScene.js";

/**
 * Scene router.
 *
 * Component-level pieces live in one scrollable gallery, but a SHELL cannot be judged
 * in a box: a sidebar that collapses to icons, a dock you drag, a status bar pinned to
 * the viewport bottom — all of it only tells the truth at full height. So each complex
 * context gets its own screen, assembled the way a product actually assembles it.
 */
const SCENES = [
  { id: "components", label: "Components", full: false },
  // App shell uses natural page scroll (full: false) — the h-svh + nested-overflow variant
  // is under suspicion for a layout thrash that freezes overlays, so keep it simple here.
  { id: "app", label: "App shell", full: false },
  { id: "workspace", label: "Workspace", full: true },
] as const;

type SceneId = (typeof SCENES)[number]["id"];

function currentScene(): SceneId {
  const raw = window.location.hash.replace(/^#\/?/, "").split("/")[0];
  return (SCENES.find((s) => s.id === raw)?.id ?? "components") as SceneId;
}

export function App() {
  const [scene, setScene] = useState<SceneId>(currentScene);

  useEffect(() => {
    const onHash = () => setScene(currentScene());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Cycle scenes with ⌘/Ctrl+J. NOT ⌘K (the gallery's command palette) and NOT ⌘\
  // (WorkspaceLayout's dock toggle) — the scenes have to coexist with what they demo.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        const i = SCENES.findIndex((s) => s.id === currentScene());
        window.location.hash = `#/${SCENES[(i + 1) % SCENES.length].id}`;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const meta = SCENES.find((s) => s.id === scene)!;

  return (
    <>
      <SceneSwitcher active={scene} />
      {/* Full-height scenes own the viewport: no page scroll, no wrapper padding, so the
          shell's own overflow and sticky regions behave exactly as they will in keasy. */}
      <ErrorBoundary key={scene}>
        <div className={meta.full ? "h-svh overflow-hidden" : undefined}>
          {scene === "components" && <Gallery />}
          {scene === "app" && <AppScene />}
          {scene === "workspace" && <WorkspaceScene />}
        </div>
        {/* Inside the boundary too: a toast or the theme panel that throws on open would
            otherwise white-screen without being caught. */}
        {/* `hotkey` is opt-in now — the library no longer claims a bare key in a host's
            global keymap. The playground is a dev harness, so `t` is free here. */}
        <Preferences hotkey="t" />
        <Toaster />
      </ErrorBoundary>
    </>
  );
}

function SceneSwitcher({ active }: { active: SceneId }) {
  return (
    <nav
      aria-label="Playground scenes"
      className="fixed top-3 right-3 z-50 flex items-center gap-1 rounded-lg border border-border bg-[color-mix(in_srgb,var(--card)_88%,transparent)] p-1 shadow-sm backdrop-blur-sm"
    >
      {SCENES.map((s) => (
        <a
          className={`rounded-md px-2 py-1 text-xs transition-colors ${
            active === s.id
              ? "bg-accent font-medium text-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
          href={`#/${s.id}`}
          key={s.id}
        >
          {s.label}
        </a>
      ))}
      <Kbd className="ms-1">⌘J</Kbd>
    </nav>
  );
}
