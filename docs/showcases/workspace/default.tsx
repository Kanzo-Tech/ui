"use client";

import { useMemo, useState } from "react";
import {
	Badge,
	Breadcrumbs,
	Button,
	FloatingPanel,
	FloatingPanelResizeHandle,
	InstanceSwitcher,
	ScrollArea,
	ShellBody,
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
	Slider,
	Switch,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	Toaster,
	toast,
} from "@kanzo-tech/ui";
import {
	BarChart3Icon,
	ChevronDownIcon,
	ChevronUpIcon,
	InfoIcon,
	LogOutIcon,
	MaximizeIcon,
	MessageCircleIcon,
	MinusIcon,
	PanelRightCloseIcon,
	PanelRightOpenIcon,
	PlusIcon,
	SendIcon,
	Settings2Icon,
	SettingsIcon,
	ShieldCheckIcon,
	UserIcon,
} from "lucide-react";
import {
	GRAPH_EDGES,
	GRAPH_LEGEND,
	GRAPH_NODES,
	HISTOGRAM_FIELDS,
	INSTANCES,
	NAV,
	type NodeKind,
	SELECTED_NODE,
	SIM_PARAMS,
	type SimKey,
	USER,
} from "./data";

/**
 * keasy's discovery screen, at full viewport and end-to-end in our vocabulary: the app shell wraps
 * the graph, exactly as it does in the product. `ShellRoot` › `ShellBody` › (`SidebarProvider` with
 * the collapsing `Sidebar` + `ShellMain`) gives the left workspace/nav/user rail and its ⌘B
 * collapse; inside `ShellMain`, a `ShellHeader` breadcrumb sits above the discovery canvas — a graph
 * that fills the frame, a floating glass inspector overlaying its trailing edge (resizable, with
 * Info / Ask / Rules / Settings tabs), a legend and zoom controls pinned to the canvas corners, and
 * a collapsible distributions strip along the bottom. The library ships the regions and the parts;
 * the graph itself is a placeholder — the design system has no graph engine, and that boundary is
 * the point of a showcase.
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

function MiniHistogram({ name, bars }: { name: string; bars: number[] }) {
	return (
		<div className="w-40 shrink-0 rounded-md border bg-card p-2">
			<p className="mb-1.5 truncate font-medium text-[10px] text-muted-foreground">
				{name}
			</p>
			<div className="flex h-10 items-end gap-0.5">
				{bars.map((h, i) => (
					<div
						className="flex-1 rounded-t-[1px] bg-primary/70"
						key={i}
						style={{ height: `${Math.max(6, h * 100)}%` }}
					/>
				))}
			</div>
		</div>
	);
}

function InfoTab() {
	return (
		<ScrollArea className="h-full p-3">
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
	);
}

function AskTab() {
	return (
		<div className="flex h-full flex-col">
			<ScrollArea className="flex-1 p-3">
				<div className="space-y-2 text-xs">
					<div className="ms-auto w-fit max-w-[85%] rounded-lg rounded-ee-sm bg-primary px-3 py-1.5 text-primary-foreground">
						Which datasets mention weather?
					</div>
					<div className="w-fit max-w-[90%] rounded-lg rounded-es-sm bg-muted px-3 py-1.5">
						Three datasets are tagged <code>weather</code>. Highlighted on the
						graph.
					</div>
				</div>
			</ScrollArea>
			<div className="border-t p-2">
				<div className="flex items-center gap-1 rounded-md border bg-background ps-2.5">
					<input
						className="min-w-0 flex-1 bg-transparent py-1.5 text-xs outline-none placeholder:text-muted-foreground/64"
						placeholder="Ask about your graph…"
					/>
					<Button size="icon-sm" variant="ghost">
						<SendIcon />
					</Button>
				</div>
			</div>
		</div>
	);
}

function RulesTab() {
	const rules = [
		"Every Dataset has a dct:title",
		"dcat:keyword is not empty",
		"dct:issued is a valid xsd:date",
	];
	return (
		<ScrollArea className="h-full p-3">
			<div className="space-y-2">
				<p className="text-muted-foreground text-xs">
					Validation rules run over the graph.
				</p>
				{rules.map((r) => (
					<div
						className="flex items-center gap-2 rounded-md border p-2 text-xs"
						key={r}
					>
						<ShieldCheckIcon className="size-3.5 shrink-0 text-success" />
						<span className="min-w-0 flex-1">{r}</span>
						<Badge size="xs" variant="success">
							pass
						</Badge>
					</div>
				))}
			</div>
		</ScrollArea>
	);
}

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

export function WorkspaceShowcase() {
	const [panelOpen, setPanelOpen] = useState(true);
	const [panelWidth, setPanelWidth] = useState(360);
	const [histOpen, setHistOpen] = useState(true);

	// Controls pinned to the canvas's trailing edge shift inward when the inspector is open, so the
	// glass panel never covers them — the same offset the panel toggle uses.
	const endInset = panelOpen ? panelWidth + 16 : 8;

	return (
		<ShellRoot>
			<ShellBody>
				<SidebarProvider className="min-h-0 flex-1">
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

					<ShellMain className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
						<ShellHeader className="h-12 flex-row items-center gap-2 px-3">
							<SidebarTrigger />
							<Breadcrumbs
								items={[
									{ label: "Jobs", href: "#/app/jobs" },
									{ label: "aemet.fossil", href: "#/app/jobs/aemet" },
									{ label: "Discover" },
								]}
							/>
							<span className="ms-auto shrink-0 text-muted-foreground text-xs tabular-nums">
								12,480 vertices · 31,204 edges
							</span>
						</ShellHeader>

						{/* Discovery body — a <section> under the header, the positioning context for the
						    graph, its corner controls and the floating inspector (ShellMain owns <main>). */}
						<section className="relative flex min-h-0 flex-1 flex-col">
							{/* Canvas — always full-bleed, with a legend and zoom controls in its corners. */}
							<div className="relative min-h-0 flex-1">
								<GraphCanvas />
								<GraphLegend />
								{/* Zoom controls — decorative, like the graph itself; pinned bottom-end,
								    clear of the inspector. */}
								<div
									className="absolute bottom-2 z-10 flex flex-col overflow-hidden rounded-md border bg-card/80 backdrop-blur-sm"
									style={{ insetInlineEnd: endInset }}
								>
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
							</div>

							{/* Distributions — the bottom strip. */}
							<div className="border-t bg-background">
								<Button
									className="h-7 w-full gap-1.5 rounded-none text-muted-foreground text-xs hover:text-foreground"
									onClick={() => setHistOpen((v) => !v)}
									size="sm"
									variant="ghost"
								>
									<BarChart3Icon />
									Distributions ({HISTOGRAM_FIELDS.length})
									{histOpen ? <ChevronDownIcon /> : <ChevronUpIcon />}
								</Button>
								{histOpen && (
									<ScrollArea className="w-full">
										<div className="flex gap-2 px-2 pb-2">
											{HISTOGRAM_FIELDS.map((f) => (
												<MiniHistogram bars={f.bars} key={f.name} name={f.name} />
											))}
										</div>
									</ScrollArea>
								)}
							</div>

							{/* Floating inspector — overlays the canvas on the trailing edge. */}
							{panelOpen && (
								<FloatingPanel
									className="absolute inset-y-2 end-2 z-20"
									maxWidth={560}
									minWidth={280}
									onWidthChange={setPanelWidth}
									width={panelWidth}
								>
									<FloatingPanelResizeHandle side="start" />
									<div className="flex min-w-0 flex-1 flex-col">
										<Tabs
											className="flex min-h-0 flex-1 flex-col"
											defaultValue="info"
										>
											<TabsList className="h-9 w-full shrink-0 justify-start rounded-none border-b px-1">
												<TabsTrigger className="gap-1 text-xs" value="info">
													<InfoIcon className="size-3" />
													Info
												</TabsTrigger>
												<TabsTrigger className="gap-1 text-xs" value="ask">
													<MessageCircleIcon className="size-3" />
													Ask
												</TabsTrigger>
												<TabsTrigger className="gap-1 text-xs" value="rules">
													<ShieldCheckIcon className="size-3" />
													Rules
												</TabsTrigger>
												<TabsTrigger className="gap-1 text-xs" value="settings">
													<Settings2Icon className="size-3" />
													Settings
												</TabsTrigger>
											</TabsList>
											<TabsContent className="m-0 min-h-0 flex-1" value="info">
												<InfoTab />
											</TabsContent>
											<TabsContent className="m-0 min-h-0 flex-1" value="ask">
												<AskTab />
											</TabsContent>
											<TabsContent className="m-0 min-h-0 flex-1" value="rules">
												<RulesTab />
											</TabsContent>
											<TabsContent className="m-0 min-h-0 flex-1" value="settings">
												<SettingsTab />
											</TabsContent>
										</Tabs>
									</div>
								</FloatingPanel>
							)}

							{/* Panel toggle — floats clear of the panel's leading edge. */}
							<Button
								aria-label={panelOpen ? "Hide inspector" : "Show inspector"}
								className="absolute top-2 z-30 bg-background/80 backdrop-blur-sm"
								onClick={() => setPanelOpen((v) => !v)}
								size="icon-sm"
								style={{ insetInlineEnd: endInset }}
								variant="outline"
							>
								{panelOpen ? <PanelRightCloseIcon /> : <PanelRightOpenIcon />}
							</Button>
						</section>
					</ShellMain>
				</SidebarProvider>
				<Toaster />
			</ShellBody>
		</ShellRoot>
	);
}

export default WorkspaceShowcase;
