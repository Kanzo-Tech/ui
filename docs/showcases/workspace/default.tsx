"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import {
	Badge,
	Breadcrumbs,
	Button,
	ButtonGroup,
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
	InstanceSwitcher,
	NumberInput,
	NumberInputControl,
	NumberInputDecrementTrigger,
	NumberInputIncrementTrigger,
	NumberInputInput,
	Resizable,
	ResizablePanel,
	ResizableResizeTrigger,
	ScrollArea,
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
	Skeleton,
	Slider,
	Switch,
	TextField,
	Toaster,
	toast,
	ToggleGroup,
	ToggleGroupItem,
} from "@kanzo-tech/ui";
import {
	BarChart3Icon,
	ChevronDownIcon,
	InfoIcon,
	LogOutIcon,
	MaximizeIcon,
	MessageCircleIcon,
	MinusIcon,
	NetworkIcon,
	PlayIcon,
	PlusIcon,
	SearchIcon,
	SendIcon,
	Settings2Icon,
	SettingsIcon,
	ShieldCheckIcon,
	SparklesIcon,
	UserIcon,
	XIcon,
} from "lucide-react";
import {
	ASK_SUGGESTIONS,
	GRAPH_EDGES,
	GRAPH_LEGEND,
	GRAPH_NODES,
	INSTANCES,
	NAV,
	type NodeKind,
	RULE_FILTERS,
	SELECTED_NODE,
	SIM_PARAMS,
	type SimKey,
	USER,
} from "./data";

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
 * The library ships the regions and the parts; the graph canvas is a placeholder (the design system
 * has no graph engine), but the **Analysis** view is live — a full crossfilter dashboard over a real
 * DuckDB relation, built from the `@kanzo-tech/ui/charts` subpath and loaded client-only from
 * `./analysis-charts` so the DuckDB/vgplot stack never touches the RSC prerender. That split —
 * placeholder graph, real charts — is the point of a showcase: it shows how far the library reaches.
 */

const KIND_FILL: Record<NodeKind, string> = {
	dataset: "var(--primary)",
	distribution: "var(--info)",
	keyword: "var(--muted-foreground)",
	entity: "var(--foreground)",
};

function GraphCanvas() {
	const byId = useMemo(() => new Map(GRAPH_NODES.map((n) => [n.id, n])), []);
	return (
		<div
			className="absolute inset-0"
			style={{
				backgroundImage:
					"radial-gradient(var(--border) 0.5px, transparent 0.5px)",
				backgroundSize: "18px 18px",
			}}
		>
			<svg
				className="h-full w-full"
				preserveAspectRatio="xMidYMid meet"
				role="img"
				aria-label="Knowledge graph"
				viewBox="0 0 200 140"
			>
				{GRAPH_EDGES.map((e) => {
					const a = byId.get(e.from);
					const b = byId.get(e.to);
					if (!a || !b) return null;
					return (
						<line
							key={`${e.from}-${e.to}`}
							stroke="var(--border)"
							strokeWidth={0.6}
							x1={a.x}
							x2={b.x}
							y1={a.y}
							y2={b.y}
						/>
					);
				})}
				{GRAPH_NODES.map((n) => (
					<g key={n.id}>
						{n.id === "dataset" && (
							// The selected vertex — a primary ring, the same node the Info tab inspects.
							<circle
								cx={n.x}
								cy={n.y}
								fill="none"
								r={n.r + 3}
								stroke="var(--primary)"
								strokeWidth={1}
							/>
						)}
						<circle
							cx={n.x}
							cy={n.y}
							fill={KIND_FILL[n.kind]}
							opacity={n.kind === "keyword" ? 0.7 : 0.9}
							r={n.r}
						/>
						<text
							className="text-[5px]"
							fill="var(--muted-foreground)"
							textAnchor="middle"
							x={n.x}
							y={n.y + n.r + 5}
						>
							{n.label}
						</text>
					</g>
				))}
			</svg>
		</div>
	);
}

function GraphLegend() {
	return (
		<div className="absolute bottom-2 start-2 z-10 rounded-md border bg-card/80 px-2.5 py-1.5 backdrop-blur-sm">
			<ul className="space-y-1">
				{GRAPH_LEGEND.map((l) => (
					<li className="flex items-center gap-2 text-xs" key={l.kind}>
						<span
							className="size-2 shrink-0 rounded-full"
							style={{ background: KIND_FILL[l.kind] }}
						/>
						<span>{l.label}</span>
						<span className="ms-auto ps-4 text-muted-foreground tabular-nums">
							{l.count}
						</span>
					</li>
				))}
			</ul>
		</div>
	);
}

function InfoTab() {
	return (
		<div className="flex h-full flex-col">
			<div className="shrink-0 border-b border-border p-2">
				<TextField
					iconStart={<SearchIcon className="size-3.5" />}
					placeholder="Search entities…"
					size="sm"
				/>
			</div>
			<ScrollArea className="min-h-0 flex-1 p-3">
				<div className="space-y-3">
					<div>
						<p className="truncate font-medium text-sm">{SELECTED_NODE.label}</p>
						<p className="mt-0.5 break-all text-muted-foreground text-xs">
							{SELECTED_NODE.id}
						</p>
						<Badge className="mt-1 text-[10px]" size="xs" variant="outline">
							{SELECTED_NODE.type}
						</Badge>
					</div>
					<dl className="space-y-2 text-sm">
						{SELECTED_NODE.properties.map((p) => (
							<div className="flex flex-col gap-0.5" key={p.predicate}>
								<dt className="font-medium text-muted-foreground text-xs">
									{p.predicate}
								</dt>
								<dd className="break-all">{p.value}</dd>
							</div>
						))}
					</dl>
				</div>
			</ScrollArea>
		</div>
	);
}

function AskTab() {
	return (
		<div className="flex h-full flex-col">
			<ScrollArea className="min-h-0 flex-1">
				<div className="flex flex-col items-center gap-3 p-4 text-center">
					<SparklesIcon className="size-5 text-muted-foreground" />
					<p className="text-muted-foreground text-xs">Ask about your data</p>
					<div className="flex flex-wrap justify-center gap-1.5">
						{ASK_SUGGESTIONS.map((s) => (
							<Button key={s} pill size="sm" variant="outline">
								{s}
							</Button>
						))}
					</div>
				</div>
			</ScrollArea>
			<div className="shrink-0 border-t border-border p-2">
				<InputGroup size="sm">
					<InputGroupInput placeholder="Ask about your data…" />
					<InputGroupAddon align="inline-end">
						<InputGroupButton aria-label="Send" variant="ghost">
							<SendIcon />
						</InputGroupButton>
					</InputGroupAddon>
				</InputGroup>
			</div>
		</div>
	);
}

function FilterChip({
	children,
	muted,
}: {
	children: React.ReactNode;
	muted?: boolean;
}) {
	return (
		<span
			className={`inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 ${
				muted ? "text-muted-foreground" : ""
			}`}
		>
			{children}
			<ChevronDownIcon className="size-3 text-muted-foreground" />
		</span>
	);
}

function RulesTab() {
	return (
		<ScrollArea className="h-full p-3">
			<div className="space-y-2 text-xs">
				{RULE_FILTERS.map((f) => (
					<div
						className="flex flex-wrap items-center gap-1.5"
						key={`${f.conj}-${f.entity}-${f.field}`}
					>
						<span className="w-10 shrink-0 text-muted-foreground">{f.conj}</span>
						<FilterChip>{f.entity}</FilterChip>
						<FilterChip>{f.field}</FilterChip>
						<FilterChip>{f.op}</FilterChip>
						{f.value && <FilterChip muted>{f.value}</FilterChip>}
					</div>
				))}
				<Button
					className="h-7 gap-1.5 text-muted-foreground text-xs"
					size="sm"
					variant="ghost"
				>
					<PlusIcon />
					Add filter
				</Button>
			</div>
		</ScrollArea>
	);
}

/**
 * The Analysis view is the one live region: a real crossfilter dashboard over a real DuckDB
 * relation, built entirely from the `@kanzo-tech/ui/charts` subpath. It occupies `ShellMain` rather
 * than the dock because a dashboard needs the width — a KPI row, six faceted panels and a table do
 * not fit in a 320px inspector, and cramming them there would demonstrate the opposite of what the
 * layer can do.
 *
 * It stays client-only: importing `@kanzo-tech/ui/charts` at the top of this file would evaluate
 * vgplot during the RSC prerender (a TDZ), so it lives behind `ssr: false` — the boundary
 * `docs/examples/charts/mosaic-demo.tsx` documents.
 */
const AnalysisView = dynamic(() => import("./analysis-charts"), {
	ssr: false,
	loading: () => (
		<div className="space-y-4 p-4">
			<Skeleton className="h-16 w-full rounded-lg" />
			<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
				{Array.from({ length: 4 }).map((_, i) => (
					<Skeleton className="h-24 w-full rounded-lg" key={i} />
				))}
			</div>
		</div>
	),
});

function SettingsTab() {
	const [sim, setSim] = useState<Record<SimKey, number>>(
		() =>
			Object.fromEntries(SIM_PARAMS.map((p) => [p.key, p.default])) as Record<
				SimKey,
				number
			>,
	);
	const [showLinks, setShowLinks] = useState(true);
	const [scaleOnZoom, setScaleOnZoom] = useState(true);
	const [depth, setDepth] = useState("2");

	return (
		<ScrollArea className="h-full p-3">
			<div className="space-y-4">
				<p className="font-medium text-muted-foreground text-xs">Simulation</p>
				{SIM_PARAMS.map((p) => (
					<div className="space-y-1" key={p.key}>
						<div className="flex items-center justify-between">
							<span className="text-xs">{p.label}</span>
							<span className="text-[10px] text-muted-foreground tabular-nums">
								{sim[p.key].toFixed(p.step >= 1 ? 0 : 2)}
							</span>
						</div>
						<Slider
							max={p.max}
							min={p.min}
							onValueChange={(d) =>
								setSim((prev) => ({ ...prev, [p.key]: d.value[0] }))
							}
							step={p.step}
							value={[sim[p.key]]}
						/>
					</div>
				))}

				<div className="space-y-3 pt-2">
					<p className="font-medium text-muted-foreground text-xs">Display</p>
					<div className="flex items-center justify-between">
						<span className="text-xs">Show links</span>
						<Switch
							checked={showLinks}
							onCheckedChange={(d) => setShowLinks(d.checked)}
						/>
					</div>
					<div className="flex items-center justify-between">
						<span className="text-xs">Scale on zoom</span>
						<Switch
							checked={scaleOnZoom}
							onCheckedChange={(d) => setScaleOnZoom(d.checked)}
						/>
					</div>
					{/* A bounded integer (how many hops out from the selected node to render) — a
					    spinbutton, not a slider: the user types or steps an exact count. */}
					<div className="flex items-center justify-between">
						<span className="text-xs">Neighbour depth</span>
						<NumberInput
							className="w-24"
							max={6}
							min={1}
							onValueChange={(d) => setDepth(d.value)}
							value={depth}
						>
							<NumberInputControl size="sm">
								<NumberInputInput />
								<NumberInputIncrementTrigger />
								<NumberInputDecrementTrigger />
							</NumberInputControl>
						</NumberInput>
					</div>
				</div>

				<Button
					className="w-full text-xs"
					onClick={() => {
						setSim(
							Object.fromEntries(
								SIM_PARAMS.map((p) => [p.key, p.default]),
							) as Record<SimKey, number>,
						);
						setShowLinks(true);
						setScaleOnZoom(true);
						setDepth("2");
					}}
					size="sm"
					variant="outline"
				>
					Reset defaults
				</Button>
			</div>
		</ScrollArea>
	);
}

const PANELS = [
	{ id: "info", label: "Info", icon: InfoIcon },
	{ id: "ask", label: "Ask", icon: MessageCircleIcon },
	{ id: "rules", label: "Rules", icon: ShieldCheckIcon },
	{ id: "settings", label: "Settings", icon: Settings2Icon },
] as const;

type PanelId = (typeof PANELS)[number]["id"];

const PANEL_BODY: Record<PanelId, React.ComponentType> = {
	info: InfoTab,
	ask: AskTab,
	rules: RulesTab,
	settings: SettingsTab,
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
			<GraphLegend />
			{/* Zoom / fit — an ACTION cluster (three independent commands, not a choice), so a
			    vertical ButtonGroup: it collapses the shared borders into one segmented control and
			    keeps each button's focus ring un-clipped. */}
			<ButtonGroup
				aria-label="Zoom and fit"
				className="absolute end-2 bottom-2 z-10 bg-card/80 backdrop-blur-sm"
				orientation="vertical"
			>
				<Button aria-label="Zoom in" size="icon-sm" variant="outline">
					<PlusIcon />
				</Button>
				<Button aria-label="Zoom out" size="icon-sm" variant="outline">
					<MinusIcon />
				</Button>
				<Button aria-label="Fit to view" size="icon-sm" variant="outline">
					<MaximizeIcon />
				</Button>
			</ButtonGroup>
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

export function WorkspaceShowcase() {
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
				<ShellHeader className="h-12 flex-row items-center gap-2 px-3">
					<SidebarTrigger />
					<Breadcrumbs
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
				</ShellHeader>

				<ShellBody className="min-w-0">
					{panelOpen ? (
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
											{active === "rules" && (
												<Button className="h-6 gap-1 text-xs" size="sm">
													<PlayIcon className="size-3" />
													Run
												</Button>
											)}
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
					) : (
						<MainRegion />
					)}
				</ShellBody>

				<ShellFooter className="h-8 flex-row items-center justify-between px-2">
					<span className="px-1 text-muted-foreground text-xs tabular-nums">
						5,021 nodes · 4,997 edges
					</span>
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
