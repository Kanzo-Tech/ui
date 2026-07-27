"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import {
	Breadcrumbs,
	Button,
	DialogTrigger,
	InstanceSwitcher,
	Kbd,
	PreferencesPanel,
	PreferencesRoot,
	Resizable,
	ResizablePanel,
	ResizableResizeTrigger,
	ShellAside,
	ShellBody,
	ShellFooter,
	ShellHeader,
	ShellMain,
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarInset,
	SidebarNav,
	SidebarProvider,
	SidebarRail,
	SidebarTrigger,
	SidebarUser,
	Show,
	Skeleton,
	Toaster,
	toast,
	ToggleGroup,
	ToggleGroupItem,
} from "@kanzo-tech/ui";
import {
	BarChart3Icon,
	InfoIcon,
	LogOutIcon,
	MessageCircleIcon,
	NetworkIcon,
	Settings2Icon,
	SettingsIcon,
	ShieldCheckIcon,
	UserIcon,
	XIcon,
} from "lucide-react";
import {
	INSTANCES,
	NAV,
	USER,
} from "./data";
import {
	GraphAsk,
	GraphCanvas,
	GraphCounts,
	GraphInspector,
	GraphLegend,
	GraphMosaic,
	GraphRules,
	GraphSelection,
	GraphSettings,
	GraphToolbar,
	GraphZoom,
} from "./graph-view";

/**
 * keasy's discovery screen, at full viewport and end-to-end in our vocabulary. The whole point is
 * the mapping: it is an IDE-docked layout, not a floating overlay, so every region is one of ours.
 *
 *   SidebarProvider             app frame + collapse context (⌘B)
 *   ├─ Sidebar                  the app rail — workspace switcher / Platform nav / user
 *   └─ SidebarInset             neutral offset column; the content shell lives inside it
 *      ├─ ShellHeader           breadcrumb (Jobs › aemet.fossil › Discover) + ⌘B + view switcher
 *      ├─ ShellBody             Resizable: ShellMain view  ⟷  docked ShellAside inspector
 *      └─ ShellFooter           status bar: node/edge count at start, panel-tab icons at end
 *
 * The dock is drag-resizable: per DESIGN.md ("resizing is composed, not a prop") the main region and
 * the aside are the two panels of a `Resizable` (our Ark Splitter wrapper), so the drag, keyboard
 * resize and ARIA all come from the machine. The Sidebar stays OUTSIDE the splitter.
 *
 * Two orthogonal switches, which is the IDE shape: the **header** picks what `ShellMain` shows
 * (Graph · Analysis), the **footer strip** picks which inspector the dock holds (Info · Ask · Rules
 * · Settings) and collapses it when you click the active icon again — a state Tabs cannot express.
 *
 * Both regions are live and both read the same DuckDB: **Graph** is cosmos.gl rendering a force
 * layout on the GPU while a `MosaicClient` keeps it inside the page's crossfilter, and **Analysis**
 * is a full crossfilter dashboard built from the `@kanzo-tech/ui/analytics` subpath. Both load
 * client-only, because evaluating vgplot during the RSC prerender is a TDZ.
 *
 * What the showcase is demonstrating there is the reach of the vocabulary rather than a graph
 * widget: the library ships no renderer, and the canvas joins the crossfilter by declaring a query
 * and publishing a clause — the same contract a brushed histogram honours.
 */

/**
 * The Analysis view is the discovery showcase's other region: a real crossfilter dashboard over a
 * real DuckDB relation, built entirely from the `@kanzo-tech/ui/analytics` subpath. It occupies
 * `ShellMain` rather than the dock because a dashboard needs the width — a KPI row, six faceted
 * panels and a table do not fit in a 320px inspector.
 *
 * It stays client-only: importing `@kanzo-tech/ui/analytics` at the top of this file would evaluate
 * vgplot during the RSC prerender (a TDZ), so it lives behind `ssr: false` — the boundary
 * `docs/examples/charts/mosaic-demo.tsx` documents.
 */
const AnalysisView = dynamic(() => import("./analysis-charts"), {
	ssr: false,
	loading: () => <Skeleton className="h-full w-full" />,
});

const PANELS = [
	{ id: "info", label: "Info", icon: InfoIcon },
	{ id: "ask", label: "Ask", icon: MessageCircleIcon },
	{ id: "rules", label: "Rules", icon: ShieldCheckIcon },
	{ id: "settings", label: "Settings", icon: Settings2Icon },
] as const;

type PanelId = (typeof PANELS)[number]["id"];

const PANEL_BODY: Record<PanelId, React.ComponentType> = {
	info: GraphInspector,
	ask: GraphAsk,
	rules: GraphRules,
	settings: GraphSettings,
};

/** What `ShellMain` shows. The dock's panels are orthogonal to it — they inspect either one. */
const VIEWS = [
	{ id: "graph", label: "Graph", icon: NetworkIcon },
	{ id: "analysis", label: "Analysis", icon: BarChart3Icon },
] as const;

type ViewId = (typeof VIEWS)[number]["id"];

/** The graph region — one `<main>`, filling whichever box holds it (a splitter panel, or the whole
 *  body when the dock is collapsed). */
function DiscoveryCanvas() {
	return (
		<ShellMain className="relative size-full bg-background">
			<GraphCanvas />
			{/* Chrome, at the four corners: what is selected and the tools that select it on top,
			    the legend and the camera below. All of it floats over a WebGL surface it never talks
			    to — each one publishes into the crossfilter or calls a command the canvas registered.
			    The look lives in Settings, because a canvas you are reading should not carry the
			    controls for how it was drawn. */}
			<GraphSelection />
			<GraphToolbar />
			<GraphLegend />
			{/* Zoom / fit — an ACTION cluster (three independent commands, not a choice), so a
			    vertical ButtonGroup: it collapses the shared borders into one segmented control and
			    keeps each button's focus ring un-clipped. */}
			<GraphZoom />
		</ShellMain>
	);
}

/** The analysis region — the other `<main>`; only ever one of the two is mounted. */
function AnalysisRegion() {
	return (
		<ShellMain className="min-h-0 bg-background">
			<AnalysisView />
		</ShellMain>
	);
}

function DiscoveryShell() {
	const [active, setActive] = useState<PanelId>("info");
	const [panelOpen, setPanelOpen] = useState(true);
	const [view, setView] = useState<ViewId>("graph");

	const ActiveBody = PANEL_BODY[active];
	const activeLabel = PANELS.find((p) => p.id === active)?.label ?? "";
	const MainRegion = view === "graph" ? DiscoveryCanvas : AnalysisRegion;

	return (
		<SidebarProvider className="h-dvh min-h-0 overflow-hidden">
			<Sidebar collapsible="icon">
				<SidebarHeader>
					<InstanceSwitcher
						activeId="dev"
						instances={INSTANCES}
						label="Workspaces"
						onSelect={() =>
							toast.create({ title: "Switch workspace", type: "info" })
						}
					/>
				</SidebarHeader>

				<SidebarContent>
					<SidebarNav items={NAV} label="Platform" />
				</SidebarContent>

				<SidebarFooter>
					<SidebarUser
						menuItems={[
							{
								label: "Profile",
								icon: <UserIcon />,
								onSelect: () =>
									toast.create({ title: "Profile", type: "info" }),
							},
							{
								label: "Settings",
								icon: <SettingsIcon />,
								onSelect: () =>
									toast.create({ title: "Settings", type: "info" }),
							},
							{
								label: "Log out",
								icon: <LogOutIcon />,
								variant: "destructive",
								separatorBefore: true,
								onSelect: () =>
									toast.create({ title: "Logged out", type: "info" }),
							},
						]}
						user={USER}
					/>
				</SidebarFooter>
				<SidebarRail />
			</Sidebar>

			{/* SidebarInset is a neutral offset column; the content shell lives inside it so ShellMain
			    owns the one <main> and the fixed rail never overlaps the header (a fixed sidebar and a
			    full-width top region are mutually exclusive — DESIGN.md). */}
			<SidebarInset>
				{/* `min-w-0` is what lets the trail shrink instead of pushing the strip wide. Every
				    other region of this showcase already carries it; this one did not, which is
				    half of why the breadcrumb used to break onto a second line. */}
				<ShellHeader className="h-12 min-w-0 flex-row items-center gap-2 px-3">
					<SidebarTrigger />
					{/* The other half is Shark's `flex-wrap` on the list — deliberate upstream, and
					    right for a breadcrumb in the page body. A fixed-height header is the case it
					    is wrong for: a second row has nowhere to go. `className` lands on the list,
					    so overriding it here is a call-site decision rather than a fork.
					    `overflow-hidden` plus a truncating leaf is the second half of that: without
					    it the trail simply refuses to yield (every link is `text-nowrap`) and pushes
					    the view controls off the right edge instead of wrapping. The trail is what
					    gives, because it is the part you can still infer from the page. */}
					<Breadcrumbs
						className="min-w-0 flex-nowrap overflow-hidden [&_[data-slot=breadcrumb-page]]:truncate"
						items={[
							{ label: "Jobs", href: "#/app/jobs" },
							{ label: "aemet.fossil", href: "#/app/jobs/aemet" },
							{ label: "Discover" },
						]}
					/>
					{/* Switching to Analysis closes the dock: a dashboard is judged at full width, and the
					    inspector has nothing to inspect there. Reopen it from the footer strip. */}
					<ToggleGroup
						aria-label="View"
						className="ms-auto"
						multiple={false}
						onValueChange={(d) => {
							const next = d.value[0] as ViewId | undefined;
							if (!next) return;
							setView(next);
							if (next === "analysis") setPanelOpen(false);
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

					{/* The library's own theme drawer, unextended. The graph's display controls are
					    deliberately NOT in here — a look, a node size and a friction coefficient are
					    properties of this view, and they live in the Settings panel of the dock.
					    Preferences is for what the whole product looks like. */}
					<PreferencesRoot hotkey="p">
						<DialogTrigger asChild>
							<Button className="gap-1.5" size="sm" variant="ghost">
								Preferences
								<Kbd>P</Kbd>
							</Button>
						</DialogTrigger>
						<PreferencesPanel />
					</PreferencesRoot>
				</ShellHeader>

				<ShellBody className="min-w-0">
					<Show fallback={<MainRegion />} when={panelOpen}>
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
								<ShellAside
									aria-label={`${activeLabel} panel`}
									className="size-full min-h-0 border-s-0"
									side="end"
								>
									<div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
										<span className="font-medium text-sm">{activeLabel}</span>
										<div className="ms-auto flex items-center gap-1">
											{/* No "Run": the rules panel publishes into the crossfilter as each rule is set,
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
							</ResizablePanel>
						</Resizable>
					</Show>
				</ShellBody>

				<ShellFooter className="h-8 flex-row items-center justify-between px-2">
					<GraphCounts />
					{/* The panel switcher is a single-select, DESELECTABLE ToggleGroup, not a Button
					    row and not Tabs: one panel shows at a time and clicking the active icon again
					    collapses the dock (value → none) — a state Tabs cannot express. The machine
					    owns the pressed state and roving focus; the old Button row hand-rolled
					    `aria-pressed`. `value` mirrors the two state atoms: `[active]` open, `[]` shut. */}
					<ToggleGroup
						aria-label="Panels"
						multiple={false}
						onValueChange={(d) => {
							const next = d.value[0] as PanelId | undefined;
							if (next) {
								setActive(next);
								setPanelOpen(true);
							} else {
								setPanelOpen(false);
							}
						}}
						size="sm"
						spacing={2}
						value={panelOpen ? [active] : []}
					>
						{PANELS.map((p) => (
							<ToggleGroupItem aria-label={p.label} key={p.id} value={p.id}>
								<p.icon />
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				</ShellFooter>
			</SidebarInset>
			<Toaster />
		</SidebarProvider>
	);
}

export default WorkspaceShowcase;

/**
 * The provider sits outside the shell so the canvas, the inspector and the footer all read the one
 * crossfilter: lasso the graph and the Info panel and the counts follow, with nothing wired between
 * them but the selection.
 */
export function WorkspaceShowcase() {
	return (
		<GraphMosaic>
			<DiscoveryShell />
		</GraphMosaic>
	);
}
