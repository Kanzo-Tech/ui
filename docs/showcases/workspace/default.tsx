"use client";

import { useMemo, useRef, useState } from "react";
import {
	Badge,
	Breadcrumbs,
	Button,
	ScrollArea,
	ShellHeader,
	ShellMain,
	ShellRoot,
	Slider,
	Switch,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@kanzo-tech/ui";
import {
	ArrowLeftIcon,
	BarChart3Icon,
	ChevronDownIcon,
	ChevronUpIcon,
	InfoIcon,
	MessageCircleIcon,
	PanelRightCloseIcon,
	PanelRightOpenIcon,
	SendIcon,
	Settings2Icon,
	ShieldCheckIcon,
} from "lucide-react";
import {
	GRAPH_EDGES,
	GRAPH_NODES,
	HISTOGRAM_FIELDS,
	type NodeKind,
	SELECTED_NODE,
	SIM_PARAMS,
	type SimKey,
} from "./data";

/**
 * A data-discovery workspace at full viewport, mirroring keasy's discovery screen: a graph canvas
 * fills the frame, a floating glass inspector overlays it on the trailing edge (resizable, with
 * Info / Ask / Rules / Settings tabs), and a collapsible distributions strip sits along the
 * bottom. The library ships the regions and the parts; the graph itself is a placeholder — the
 * design system has no graph engine, and that boundary is the point of a showcase.
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

export function WorkspaceShowcase() {
	const [panelOpen, setPanelOpen] = useState(true);
	const [panelWidth, setPanelWidth] = useState(360);
	const [histOpen, setHistOpen] = useState(true);
	const dragRef = useRef<{ startX: number; startW: number } | null>(null);

	// Floating-panel resize — a left-edge drag handle, clamped. Hand-rolled because the panel
	// overlays the canvas rather than splitting it, which `Resizable` (a splitter) does not model.
	const startResize = (e: React.PointerEvent) => {
		e.preventDefault();
		dragRef.current = { startX: e.clientX, startW: panelWidth };
		const onMove = (ev: PointerEvent) => {
			if (!dragRef.current) return;
			const delta = dragRef.current.startX - ev.clientX;
			setPanelWidth(
				Math.max(280, Math.min(560, dragRef.current.startW + delta)),
			);
		};
		const onUp = () => {
			dragRef.current = null;
			document.removeEventListener("pointermove", onMove);
			document.removeEventListener("pointerup", onUp);
		};
		document.addEventListener("pointermove", onMove);
		document.addEventListener("pointerup", onUp);
	};

	return (
		<ShellRoot>
			<ShellHeader className="h-12 flex-row items-center gap-2 px-3">
				<Button aria-label="Back" asChild size="icon-sm" variant="ghost">
					<a href="#/app/jobs">
						<ArrowLeftIcon />
					</a>
				</Button>
				<Breadcrumbs
					items={[
						{ label: "Kanzo", href: "#/app" },
						{ label: "jobs", href: "#/app/jobs" },
						{ label: "aemet.fossil", href: "#/app/jobs/aemet" },
						{ label: "Discover" },
					]}
				/>
				<span className="ms-auto shrink-0 text-muted-foreground text-xs tabular-nums">
					12,480 vertices · 31,204 edges
				</span>
			</ShellHeader>

			<ShellMain className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
				{/* Canvas — always full-bleed. */}
				<div className="relative min-h-0 flex-1">
					<GraphCanvas />
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
					<div
						className="absolute inset-y-2 end-2 z-20 flex overflow-hidden rounded-lg border bg-background/95 shadow-lg backdrop-blur-sm"
						style={{ width: panelWidth }}
					>
						<div
							className="w-1.5 shrink-0 cursor-col-resize transition-colors hover:bg-accent/50 active:bg-accent"
							onPointerDown={startResize}
						/>
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
					</div>
				)}

				{/* Panel toggle — floats clear of the panel's leading edge. */}
				<Button
					aria-label={panelOpen ? "Hide inspector" : "Show inspector"}
					className="absolute top-2 z-30 bg-background/80 backdrop-blur-sm"
					onClick={() => setPanelOpen((v) => !v)}
					size="icon-sm"
					style={{ right: panelOpen ? panelWidth + 16 : 8 }}
					variant="outline"
				>
					{panelOpen ? <PanelRightCloseIcon /> : <PanelRightOpenIcon />}
				</Button>
			</ShellMain>
		</ShellRoot>
	);
}

export default WorkspaceShowcase;
