"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import {
	AvatarFallback,
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
	Button,
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
	DialogTrigger,
	isActivePath,
	Kbd,
	Menu,
	MenuContent,
	MenuGroup,
	MenuItem,
	MenuSeparator,
	MenuTrigger,
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
	SidebarGroup,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarIdentity,
	SidebarIdentityAvatar,
	SidebarIdentityDescription,
	SidebarIdentityIcon,
	SidebarIdentityLabel,
	SidebarIdentityText,
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	SidebarProvider,
	SidebarRail,
	SidebarTrigger,
	Show,
	Skeleton,
	Toaster,
	toast,
	ToggleGroup,
	ToggleGroupItem,
	useSidebar,
} from "@kanzo-tech/ui";
import {
	BarChart3Icon,
	CheckIcon,
	ChevronRightIcon,
	ChevronsUpDownIcon,
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
	ACTIVE_PATH,
	INSTANCES,
	type Instance,
	NAV,
	type SidebarNavItem,
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
 *
 * The rail is the same argument in miniature. A workspace switcher, a nav column and a user
 * footer are three arrangements of `Menu*`, `SidebarMenu*` and `SidebarIdentity*`, and an
 * arrangement is what an app decides — so all three are written out below, and reading them is
 * the documentation.
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

/* ── The sidebar's three blocks, hand-composed ────────────────────────────────────────────────
 * The library ships the vocabulary — `SidebarIdentity*`, `SidebarMenu*`, `Menu*` — and no
 * pre-arrangement of it. A workspace switcher, a nav column and a user footer are three
 * arrangements of the same four parts, and the arrangement is what an app decides. So they are
 * written out here, where you can read them, rather than imported as a prop-driven wrapper. */

/** First letter of the first two words. The one thing an avatar fallback needs and the DS won't guess. */
function initials(name: string) {
	return name
		.split(/\s+/)
		.map((part) => part[0])
		.filter(Boolean)
		.slice(0, 2)
		.join("")
		.toUpperCase();
}

/** One workspace as an identity block. Rendered in the trigger (collapse-aware) and in each menu row. */
function WorkspaceIdentity({
	collapsed = false,
	instance,
	responsive = false,
}: {
	collapsed?: boolean;
	instance: Instance;
	responsive?: boolean;
}) {
	return (
		<SidebarIdentity collapsed={collapsed} responsive={responsive}>
			<SidebarIdentityIcon>{instance.icon}</SidebarIdentityIcon>
			<SidebarIdentityText>
				<SidebarIdentityLabel>{instance.label}</SidebarIdentityLabel>
				<SidebarIdentityDescription>
					{instance.description}
				</SidebarIdentityDescription>
			</SidebarIdentityText>
		</SidebarIdentity>
	);
}

function WorkspaceSwitcher() {
	const { isMobile, setOpenMobile, state } = useSidebar();
	const collapsed = state === "collapsed" && !isMobile;
	const active = INSTANCES[0];

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				{/* Beside the rail on desktop, below the trigger on mobile, 4px gutter. */}
				<Menu
					positioning={{
						gutter: 4,
						placement: isMobile ? "bottom-start" : "right-start",
					}}
				>
					<MenuTrigger asChild>
						{/* `aria-label`, not `tooltip`: `MenuTrigger asChild` claims the single button node,
						    so a tooltip trigger nested in the same button never binds. The label is what
						    names the row once the rail collapses to icons. */}
						<SidebarMenuButton
							aria-label={active.label}
							className="group-data-[collapsible=icon]:justify-center data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
							size="lg"
						>
							<WorkspaceIdentity
								collapsed={collapsed}
								instance={active}
								responsive
							/>
							<ChevronsUpDownIcon className="ms-auto group-data-[collapsible=icon]:hidden" />
						</SidebarMenuButton>
					</MenuTrigger>
					{/* `--reference-width` is the trigger's width, published by Ark on the positioner: the
					    menu reads as anchored to the button instead of floating beside the rail. */}
					<MenuContent className="w-(--reference-width) min-w-60">
						{/* `MenuGroup` is what gives the heading an item-group to label. */}
						<MenuGroup heading="Workspaces">
							{INSTANCES.map((instance) => (
								<MenuItem
									key={instance.id}
									onClick={() => {
										setOpenMobile(false);
										toast.create({ title: "Switch workspace", type: "info" });
									}}
									value={instance.id}
								>
									<WorkspaceIdentity instance={instance} />
									<Show when={instance.id === active.id}>
										<CheckIcon className="ms-auto" />
									</Show>
								</MenuItem>
							))}
						</MenuGroup>
					</MenuContent>
				</Menu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}

function MemberMenu() {
	const { isMobile, setOpenMobile, state } = useSidebar();
	const collapsed = state === "collapsed" && !isMobile;

	// One description of the member, rendered twice with different collapse behaviour — in the
	// trigger, where it follows the rail, and as the menu's header, where it must not. So it is a
	// local element factory rather than a shared node.
	const identity = (responsive: boolean) => (
		<SidebarIdentity collapsed={responsive && collapsed} responsive={responsive}>
			<SidebarIdentityAvatar>
				<AvatarFallback>{initials(USER.name)}</AvatarFallback>
			</SidebarIdentityAvatar>
			<SidebarIdentityText>
				<SidebarIdentityLabel>{USER.name}</SidebarIdentityLabel>
				<SidebarIdentityDescription>{USER.email}</SidebarIdentityDescription>
			</SidebarIdentityText>
		</SidebarIdentity>
	);

	const announce = (title: string) => () => {
		setOpenMobile(false);
		toast.create({ title, type: "info" });
	};

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<Menu
					positioning={{
						gutter: 4,
						placement: isMobile ? "bottom-end" : "right-end",
					}}
				>
					<MenuTrigger asChild>
						{/* Collapsed, the button is a 32px square the avatar fills edge to edge, so round the
						    button too — otherwise its clip squares off a circular avatar. */}
						<SidebarMenuButton
							aria-label={USER.name}
							className="group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-full data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
							size="lg"
						>
							{identity(true)}
							<ChevronsUpDownIcon className="ms-auto group-data-[collapsible=icon]:hidden" />
						</SidebarMenuButton>
					</MenuTrigger>
					<MenuContent className="w-(--reference-width) min-w-56">
						<div className="px-2 py-1.5">{identity(false)}</div>
						<MenuSeparator />
						<MenuItem onClick={announce("Profile")} value="profile">
							<UserIcon />
							Profile
						</MenuItem>
						<MenuItem onClick={announce("Settings")} value="settings">
							<SettingsIcon />
							Settings
						</MenuItem>
						<MenuSeparator />
						{/* Log out is an item with a variant, not a prop on a component: the confirmation
						    and the wording belong to the product. */}
						<MenuItem
							onClick={announce("Logged out")}
							value="logout"
							variant="destructive"
						>
							<LogOutIcon />
							Log out
						</MenuItem>
					</MenuContent>
				</Menu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}

/** A nav leaf. `asChild` on the button is the router seam — a plain `<a>` here, `next/link` in an app. */
function NavLeaf({
	item,
	onNavigate,
}: {
	item: SidebarNavItem;
	onNavigate: () => void;
}) {
	return (
		<SidebarMenuItem>
			<SidebarMenuButton
				asChild
				isActive={isActivePath(ACTIVE_PATH, item.href)}
				tooltip={item.title}
			>
				<a href={item.href} onClick={onNavigate}>
					{item.icon}
					<span className="truncate">{item.title}</span>
				</a>
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
}

function NavGroup({
	item,
	onNavigate,
}: {
	item: SidebarNavItem;
	onNavigate: () => void;
}) {
	const items = item.items ?? [];
	// App policy, not library behaviour: a group opens itself when the live route is one of its
	// descendants, because a closed group hides the one row that is lit.
	const defaultOpen = items.some((sub) => isActivePath(ACTIVE_PATH, sub.href));

	return (
		<SidebarMenuItem>
			<Collapsible defaultOpen={defaultOpen}>
				<CollapsibleTrigger asChild>
					<SidebarMenuButton
						className="[&[data-state=open]>svg:last-child]:rotate-90"
						tooltip={item.title}
					>
						{item.icon}
						<span className="truncate">{item.title}</span>
						<ChevronRightIcon className="ms-auto shrink-0 transition-transform duration-200 motion-reduce:transition-none!" />
					</SidebarMenuButton>
				</CollapsibleTrigger>
				<CollapsibleContent>
					<SidebarMenuSub>
						{items.map((sub) => (
							<SidebarMenuSubItem key={sub.title}>
								<SidebarMenuSubButton
									asChild
									isActive={isActivePath(ACTIVE_PATH, sub.href)}
								>
									<a href={sub.href} onClick={onNavigate}>
										<span className="truncate">{sub.title}</span>
									</a>
								</SidebarMenuSubButton>
							</SidebarMenuSubItem>
						))}
					</SidebarMenuSub>
				</CollapsibleContent>
			</Collapsible>
		</SidebarMenuItem>
	);
}

/** The navigation column. `<nav>` is ours to write: `SidebarGroup` is a `div`, and a titled group
 *  that names its own landmark is the only reason there is a heading at all. */
function PlatformNav() {
	const { setOpenMobile } = useSidebar();
	// Below `md` the sidebar is a sheet over the content, so navigating has to dismiss it. Above it,
	// `setOpenMobile` is inert. Per-app policy again — a library nav could only guess.
	const close = () => setOpenMobile(false);

	return (
		<nav aria-label="Platform">
			<SidebarGroup>
				<SidebarGroupLabel>Platform</SidebarGroupLabel>
				<SidebarMenu>
					{NAV.map((item) => (
						<Show
							fallback={<NavLeaf item={item} onNavigate={close} />}
							key={item.title}
							when={item.items != null}
						>
							<NavGroup item={item} onNavigate={close} />
						</Show>
					))}
				</SidebarMenu>
			</SidebarGroup>
		</nav>
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
					<WorkspaceSwitcher />
				</SidebarHeader>

				<SidebarContent>
					<PlatformNav />
				</SidebarContent>

				<SidebarFooter>
					<MemberMenu />
				</SidebarFooter>
				<SidebarRail />
			</Sidebar>

			{/* SidebarInset is a neutral offset column; the content shell lives inside it so ShellMain
			    owns the one <main> and the fixed rail never overlaps the header (a fixed sidebar and a
			    full-width top region are mutually exclusive — DESIGN.md). */}
			<SidebarInset>
				{/* `min-w-0` is what lets the trail shrink instead of pushing the strip wide. Miss it
				    on one region and the breadcrumb breaks onto a second line, which a fixed-height
				    strip has nowhere to put. */}
				<ShellHeader className="h-12 min-w-0 flex-row items-center gap-2 px-3">
					<SidebarTrigger />
					{/* `Breadcrumb` already carries `min-w-0`. The other half is Shark's `flex-wrap` on the
					    LIST — deliberate upstream, and right for a breadcrumb in the page body. A
					    fixed-height header is the case it is wrong for: a second row has nowhere to go.
					    `overflow-hidden` plus the truncating leaf is what makes it yield; without them
					    the trail refuses to shrink (every link is `text-nowrap`) and pushes the view
					    controls off the right edge. The trail gives, because it is the part you can
					    still infer from the page. */}
					<Breadcrumb>
						<BreadcrumbList className="min-w-0 flex-nowrap overflow-hidden">
							<BreadcrumbItem>
								<BreadcrumbLink asChild>
									<a href="#/app/jobs">Jobs</a>
								</BreadcrumbLink>
							</BreadcrumbItem>
							{/* The separator is a SIBLING of the item, never a child: both render `li`, and
							    an `li` inside an `li` breaks the row count screen readers announce. */}
							<BreadcrumbSeparator />
							<BreadcrumbItem>
								<BreadcrumbLink asChild>
									<a href="#/app/jobs/aemet">aemet.fossil</a>
								</BreadcrumbLink>
							</BreadcrumbItem>
							<BreadcrumbSeparator />
							<BreadcrumbItem className="min-w-0">
								{/* `BreadcrumbPage` is the one that carries `aria-current="page"`, so the leaf
								    is a page and not a link — and it is the one allowed to truncate. */}
								<BreadcrumbPage className="truncate">Discover</BreadcrumbPage>
							</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>
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
