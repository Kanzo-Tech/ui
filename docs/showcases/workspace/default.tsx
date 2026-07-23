"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import {
	Badge,
	Breadcrumbs,
	Button,
	InstanceSwitcher,
	Resizable,
	ResizablePanel,
	ResizableResizeTrigger,
	ScrollArea,
	ShellAside,
	ShellBody,
	ShellFooter,
	ShellHeader,
	ShellMain,
	ShellRoot,
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarNav,
	SidebarProvider,
	SidebarRail,
	SidebarTrigger,
	SidebarUser,
	Skeleton,
	Slider,
	Switch,
	Toaster,
	toast,
} from "@kanzo-tech/ui";
import {
	BarChart3Icon,
	ChevronDownIcon,
	InfoIcon,
	LogOutIcon,
	MaximizeIcon,
	MessageCircleIcon,
	MinusIcon,
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
 *   ShellRoot
 *   ├─ ShellHeader              breadcrumb (Jobs › aemet.fossil › Discover) + ⌘B sidebar trigger
 *   ├─ ShellBody
 *   │  ├─ Sidebar (start)       the app rail — workspace switcher / Platform nav / user
 *   │  └─ Resizable             ShellMain graph  ⟷  the docked ShellAside end analysis panel
 *   └─ ShellFooter             status bar: node/edge count at start, panel-tab icons at end
 *
 * The dock is drag-resizable: per DESIGN.md ("resizing is composed, not a prop") the canvas and the
 * aside are the two panels of a `Resizable` (our Ark Splitter wrapper), so the drag, keyboard resize
 * and ARIA all come from the machine. The Sidebar stays OUTSIDE the splitter. Panels (Info · Ask ·
 * Rules · Analysis · Settings) are switched IDE-style from the footer icon strip, not an in-panel
 * tab bar; collapsing the dock drops its panel + trigger and hands the canvas the full width. The
 * library ships the regions and the parts; the graph canvas is a placeholder (the design system has
 * no graph engine), but the **Analysis** panel is live — it renders real tokenized crossfilter
 * charts from the `@kanzo-tech/ui/charts` subpath, loaded client-only from `./analysis-charts` so the
 * DuckDB/vgplot stack never touches the RSC prerender. That split — placeholder graph, real charts —
 * is the point of a showcase: it shows exactly how far the library reaches.
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
				<div className="flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5">
					<SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
					<input
						className="min-w-0 flex-1 bg-transparent py-1.5 text-xs outline-none placeholder:text-muted-foreground/64"
						placeholder="Search entities…"
					/>
				</div>
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
							<button
								className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
								key={s}
								type="button"
							>
								{s}
							</button>
						))}
					</div>
				</div>
			</ScrollArea>
			<div className="shrink-0 border-t border-border p-2">
				<div className="flex items-center gap-1 rounded-md border border-input bg-background ps-2.5">
					<input
						className="min-w-0 flex-1 bg-transparent py-1.5 text-xs outline-none placeholder:text-muted-foreground/64"
						placeholder="Ask about your data…"
					/>
					<Button size="icon-sm" variant="ghost">
						<SendIcon />
					</Button>
				</div>
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
 * The Analysis panel is the one live region: it renders REAL tokenized crossfilter charts from the
 * `@kanzo-tech/ui/charts` subpath, not faux bars. The whole panel (DuckDB boot, sample table,
 * `MosaicProvider` and the chart cards) lives in `./analysis-charts`, loaded client-only so the
 * Mosaic/vgplot/DuckDB module tree is NEVER evaluated during the RSC prerender — the boundary
 * `docs/examples/charts/example-default.tsx` documents. Importing `@kanzo-tech/ui/charts` at the top
 * of this file would evaluate vgplot during prerender (a TDZ), so it must stay behind `ssr: false`.
 */
const AnalysisTab = dynamic(() => import("./analysis-charts"), {
	ssr: false,
	loading: () => (
		<ScrollArea className="h-full">
			<div className="space-y-2 p-1.5">
				{Array.from({ length: 6 }).map((_, i) => (
					<Skeleton className="h-[7.5rem] w-full rounded-sm" key={i} />
				))}
			</div>
		</ScrollArea>
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
	{ id: "analysis", label: "Analysis", icon: BarChart3Icon },
	{ id: "settings", label: "Settings", icon: Settings2Icon },
] as const;

type PanelId = (typeof PANELS)[number]["id"];

const PANEL_BODY: Record<PanelId, React.ComponentType> = {
	info: InfoTab,
	ask: AskTab,
	rules: RulesTab,
	analysis: AnalysisTab,
	settings: SettingsTab,
};

/** The graph region — one `<main>`, filling whichever box holds it (a splitter panel, or the whole
 *  body when the dock is collapsed). */
function DiscoveryCanvas() {
	return (
		<ShellMain className="relative size-full bg-background">
			<GraphCanvas />
			<GraphLegend />
			{/* Zoom controls — decorative, like the graph itself; pinned bottom-end. */}
			<div className="absolute end-2 bottom-2 z-10 flex flex-col overflow-hidden rounded-md border bg-card/80 backdrop-blur-sm">
				<Button aria-label="Zoom in" size="icon-sm" variant="ghost">
					<PlusIcon />
				</Button>
				<Button aria-label="Zoom out" size="icon-sm" variant="ghost">
					<MinusIcon />
				</Button>
				<Button aria-label="Fit to view" size="icon-sm" variant="ghost">
					<MaximizeIcon />
				</Button>
			</div>
		</ShellMain>
	);
}

export function WorkspaceShowcase() {
	const [active, setActive] = useState<PanelId>("info");
	const [panelOpen, setPanelOpen] = useState(true);

	// IDE toggle: clicking the active panel's footer icon collapses the dock; clicking another
	// switches to it (opening the dock if it was collapsed).
	const selectPanel = (id: PanelId) => {
		if (panelOpen && id === active) {
			setPanelOpen(false);
		} else {
			setActive(id);
			setPanelOpen(true);
		}
	};

	const ActiveBody = PANEL_BODY[active];
	const activeLabel = PANELS.find((p) => p.id === active)?.label ?? "";

	return (
		<ShellRoot>
			{/* `contents` dissolves the provider's own box, so ShellHeader / ShellBody / ShellFooter
			    stay the direct children ShellRoot stacks — while the whole shell still sits inside the
			    sidebar context the header's ⌘B trigger needs. */}
			<SidebarProvider className="contents">
				<ShellHeader className="h-12 flex-row items-center gap-2 px-3">
					<SidebarTrigger />
					<Breadcrumbs
						items={[
							{ label: "Jobs", href: "#/app/jobs" },
							{ label: "aemet.fossil", href: "#/app/jobs/aemet" },
							{ label: "Discover" },
						]}
					/>
				</ShellHeader>

				<ShellBody>
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

					{/* The canvas and the docked panel are the two sides of a splitter, so drag- and
					    keyboard-resize come from Ark's machine (DESIGN.md: resizing is composed, not a
					    prop). The Sidebar stays outside it. Collapsing the dock drops the second panel
					    and its trigger, and the lone canvas takes the full width. */}
					<div className="relative flex min-h-0 min-w-0 flex-1">
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
									<DiscoveryCanvas />
								</ResizablePanel>
								<ResizableResizeTrigger id="canvas:dock" withHandle />
								<ResizablePanel
									className="flex min-h-0 min-w-0 flex-col"
									id="dock"
								>
									{/* The dock is still a ShellAside end (complementary landmark, bg-card); the
									    trigger draws the divider, so the aside drops its own border-s. */}
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
							<DiscoveryCanvas />
						)}
					</div>
				</ShellBody>

				{/* Status bar — node/edge count at the start, IDE panel-tab icons at the end. */}
				<ShellFooter className="h-7 flex-row items-center justify-between px-3">
					<span className="text-muted-foreground text-xs tabular-nums">
						5,021 nodes · 4,997 edges
					</span>
					<div className="flex items-center gap-0.5">
						{PANELS.map((p) => {
							const isActive = panelOpen && p.id === active;
							return (
								<Button
									aria-label={p.label}
									aria-pressed={isActive}
									className={
										isActive ? "text-foreground" : "text-muted-foreground"
									}
									key={p.id}
									onClick={() => selectPanel(p.id)}
									size="icon-sm"
									variant="ghost"
								>
									<p.icon />
								</Button>
							);
						})}
					</div>
				</ShellFooter>
				<Toaster />
			</SidebarProvider>
		</ShellRoot>
	);
}

export default WorkspaceShowcase;
