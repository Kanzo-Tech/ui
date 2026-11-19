"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import {
	Button,
	Resizable,
	ResizablePanel,
	ResizableResizeTrigger,
	ShellAside,
	ShellBody,
	ShellDockItem,
	ShellDockSwitcher,
	ShellFooter,
	ShellMain,
	Show,
	Skeleton,
	ToggleGroup,
	ToggleGroupItem,
	useSidebar,
} from "@kanzo-tech/ui";
import {
	BarChart3Icon,
	InfoIcon,
	MessageCircleIcon,
	NetworkIcon,
	Settings2Icon,
	ShieldCheckIcon,
	XIcon,
} from "lucide-react";
import { ScreenHeader } from "./header";
import { GraphCanvas, GraphLegend, GraphToolbar, useGraphState } from "@kanzo-tech/graph";
import { TileEditorAside, useTileEditorOpen } from "@kanzo-tech/ui/analytics";
import {
	ArchiveFooter,
	ArchiveGraph,
	GraphAsk,
	GraphInfo,
	GraphOrders,
	GraphSettings,
} from "./graph-view";

/**
 * Discover: the archive graph read back, at full width and end-to-end in one vocabulary. The whole
 * point is the mapping: it is an IDE-docked layout, not a floating overlay, so every region is one
 * of ours. It draws inside the frame's `SidebarInset`, full screen with no rail:
 *
 *   ShellHeader     trail (Dashboard › Discover) + view switcher
 *   ShellBody       Resizable: ShellMain view  ⟷  docked ShellAside inspector, and
 *                   the Format aside at the end edge while a dashboard tile is edited
 *   ShellFooter     status bar: node/edge count at start, panel-tab icons at end
 *
 * The dock is drag-resizable, and resizing is composed rather than a prop: the main region and
 * the aside are the two panels of a `Resizable` (our Ark Splitter wrapper), so the drag, keyboard
 * resize and ARIA all come from the machine.
 *
 * Two orthogonal switches, which is the IDE shape: the **header** picks what `ShellMain` shows
 * (Graph · Sightings), the **footer strip**'s `ShellDockSwitcher` picks which inspector the dock
 * holds (Info · Ask · Orders · Settings) and collapses it when you click the active icon again — a
 * state Tabs cannot express.
 *
 * Both regions are live and both read the same DuckDB: **Graph** is `@kanzo-tech/graph` drawing the
 * archive's 1,543 contracts, reports, members, beasts, tags and regions as a GPU force layout, one
 * Mosaic client on the page's engine that greys out what the crossfilter drops and publishes the
 * reader's pick into it, and **Sightings** is
 * a full crossfilter dashboard built from the `@kanzo-tech/ui/analytics` subpath. The dashboard loads
 * client-only, because evaluating vgplot during the RSC prerender is a TDZ.
 */

/**
 * The Sightings view is the showcase's other region: a real crossfilter dashboard over a real DuckDB
 * relation — the world's own `sightings`, the same rows every chart in these docs reads — built
 * entirely from the `@kanzo-tech/ui/analytics` subpath. It occupies `ShellMain` rather than the dock
 * because a dashboard needs the width — a KPI row, five plots and a table do not fit in a 320px
 * inspector.
 *
 * It stays client-only: importing `@kanzo-tech/ui/analytics` at the top of this file would evaluate
 * vgplot during the RSC prerender (a TDZ), so it lives behind `ssr: false` — the boundary
 * `docs/examples/charts/mosaic-demo.tsx` documents.
 */
const SightingsView = dynamic(() => import("./sightings-charts"), {
	ssr: false,
	loading: () => <Skeleton className="h-full w-full" />,
});

const PANELS = [
	{ id: "info", label: "Info", icon: InfoIcon },
	{ id: "ask", label: "Ask", icon: MessageCircleIcon },
	{ id: "orders", label: "Orders", icon: ShieldCheckIcon },
	{ id: "settings", label: "Settings", icon: Settings2Icon },
] as const;

type PanelId = (typeof PANELS)[number]["id"];

const PANEL_BODY: Record<PanelId, React.ComponentType> = {
	info: GraphInfo,
	ask: GraphAsk,
	orders: GraphOrders,
	settings: GraphSettings,
};

/** What `ShellMain` shows. The dock's panels are orthogonal to it — they inspect either one. */
const VIEWS = [
	{ id: "graph", label: "Graph", icon: NetworkIcon },
	{ id: "sightings", label: "Sightings", icon: BarChart3Icon },
] as const;

type ViewId = (typeof VIEWS)[number]["id"];

/** The graph region — one `<main>`, filling whichever box holds it (a splitter panel, or the whole
 *  body when the dock is collapsed). The package's parts, placed at the corners. */
function ArchiveCanvas() {
	const failed = useGraphState((s) => s.status === "failed");
	return (
		<ShellMain className="relative size-full bg-background">
			<GraphCanvas className="absolute inset-0">
				<GraphToolbar className="absolute end-2 top-2 z-10" />
				<GraphLegend className="absolute start-2 bottom-2 z-10" />
				<Show when={failed}>
					<p className="absolute inset-0 grid place-items-center p-6 text-center text-muted-foreground text-sm">
						The archive could not be drawn here — the corpus would not read, or this browser offers no
						WebGL context.
					</p>
				</Show>
			</GraphCanvas>
		</ShellMain>
	);
}

/** The sightings region — the other `<main>`; only ever one of the two is mounted. */
function SightingsRegion() {
	return (
		<ShellMain className="min-h-0 bg-background">
			<SightingsView />
		</ShellMain>
	);
}

/**
 * The page's aside for the dashboard's tile editor, at the body's end edge — draw.io's Format panel,
 * shown while a tile is edited. It stays mounted, hidden, because a page without a
 * `TileEditorAside` offers no editing; a phone draws it over the view.
 */
function FormatAside() {
	const { isMobile } = useSidebar();
	return (
		// `z-10` over the overlay's `z-5`: a table's sticky header in the view is `z-10` too, and the
		// aside comes after it.
		<ShellAside aria-label="Format" className="z-10 bg-card" hidden={!useTileEditorOpen()} overlay={isMobile} side="end" width={352}>
			<TileEditorAside />
		</ShellAside>
	);
}

function ArchiveShell() {
	const [active, setActive] = useState<PanelId>("info");
	const [panelOpen, setPanelOpen] = useState(true);
	const [view, setView] = useState<ViewId>("graph");

	const ActiveBody = PANEL_BODY[active];
	const activeLabel = PANELS.find((p) => p.id === active)?.label ?? "";
	const MainRegion = view === "graph" ? ArchiveCanvas : SightingsRegion;
	const { isMobile } = useSidebar();
	// A phone lands on the view; `isMobile` settles after mount, so this cannot be the initial state.
	useEffect(() => {
		if (isMobile) setPanelOpen(false);
	}, [isMobile]);

	const dock = (
		<ShellAside
			aria-label={`${activeLabel} panel`}
			// Over the view on a phone, `z-10` like the Format aside: the graph toolbar is `z-10` too.
			className="z-10 size-full min-h-0 border-s-0 bg-card"
			overlay={isMobile}
			side="end"
		>
			<div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
				<span className="font-medium text-sm">{activeLabel}</span>
				<div className="ms-auto flex items-center gap-1">
					{/* No "Run": the orders panel publishes into the crossfilter as each order is focused,
						    so the graph is already showing the answer. A button promising to apply
						    what is applied is a worse lie than no button. */}
					<Button
						aria-label="Close panel"
						className="-me-1"
						onClick={() => setPanelOpen(false)}
						size="icon-sm"
						variant="ghost"
					>
						<XIcon />
					</Button>
				</div>
			</div>
			<div className="min-h-0 flex-1">
				<ActiveBody />
			</div>
		</ShellAside>
	);

	return (
		<>
			{/* Full screen with no rail: the trail is the way back. */}
			<ScreenHeader crumbs={[{ label: "Discover" }]} rail={false}>
				{/* Switching to Sightings closes the dock: a dashboard is judged at full width, and the
				    inspector has nothing to inspect there. Reopen it from the footer strip. */}
				<ToggleGroup
					aria-label="View"
					multiple={false}
					onValueChange={(d) => {
						const next = d.value[0] as ViewId | undefined;
						if (!next) return;
						setView(next);
						if (next === "sightings") setPanelOpen(false);
					}}
					size="sm"
					spacing={2}
					value={[view]}
				>
					{VIEWS.map((v) => (
						<ToggleGroupItem key={v.id} value={v.id}>
							<v.icon />
							{v.label}
						</ToggleGroupItem>
					))}
				</ToggleGroup>
			</ScreenHeader>

			<ShellBody className="min-w-0">
				{/* A phone has no width to split, so there the dock draws over the view. */}
				<Show
					fallback={
						<>
							<MainRegion />
							<Show when={panelOpen}>{dock}</Show>
						</>
					}
					when={panelOpen && !isMobile}
				>
					<Resizable
						className="min-h-0"
						defaultSize={[72, 28]}
						panels={[
							{ id: "canvas", minSize: 40 },
							{ id: "dock", minSize: 18 },
						]}
					>
						<ResizablePanel
							className="relative min-w-0 overflow-hidden"
							id="canvas"
						>
							<MainRegion />
						</ResizablePanel>
						<ResizableResizeTrigger id="canvas:dock" withHandle />
						<ResizablePanel
							className="flex min-h-0 min-w-0 flex-col"
							id="dock"
						>
							{dock}
						</ResizablePanel>
					</Resizable>
				</Show>
				<FormatAside />
			</ShellBody>

			<ShellFooter className="h-8 flex-row items-center justify-between px-2">
				<ArchiveFooter />
				{/* `value` mirrors the two state atoms, so the dock reopens on the panel it closed on. */}
				<ShellDockSwitcher
					aria-label="Inspectors"
					onValueChange={(next) => {
						if (next) {
							setActive(next);
							setPanelOpen(true);
						} else {
							setPanelOpen(false);
						}
					}}
					value={panelOpen ? active : null}
				>
					{PANELS.map((p) => (
						<ShellDockItem icon={p.icon} key={p.id} label={p.label} value={p.id} />
					))}
				</ShellDockSwitcher>
			</ShellFooter>
		</>
	);
}

/**
 * The graph's root sits outside the shell so the canvas, the inspector and the panels all read one
 * graph and one crossfilter: lasso the canvas and the Info panel follows, with nothing wired between
 * them but the selection.
 */
export function Discover() {
	return (
		<ArchiveGraph>
			<ArchiveShell />
		</ArchiveGraph>
	);
}
