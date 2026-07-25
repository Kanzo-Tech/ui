// Placeholder data for the discovery showcase. The design system ships no graph engine, so the
// canvas is a hand-laid faux knowledge graph and the panels read from these fixtures — enough to
// mirror keasy's discovery screen (graph + floating inspector + distributions) without the real
// cosmos.gl viewer or a DuckDB coordinator behind it.

import {
	DatabaseIcon,
	HouseIcon,
	LayersIcon,
	WorkflowIcon,
} from "lucide-react";
import type { Instance, SidebarNavItem } from "@kanzo-tech/ui";

// --- App-shell chrome, matching keasy's real discovery screen (which lives INSIDE the shell). ---

/** The workspace switcher's tenants. keasy shows a single "Dev Workspace / Member" tile. */
export const INSTANCES: Instance[] = [
	{
		id: "dev",
		label: "Dev Workspace",
		description: "Member",
		icon: <LayersIcon />,
	},
];

/** Platform nav — Dashboard / Connections / Jobs, with Jobs active (discovery opens from a job). */
export const NAV: SidebarNavItem[] = [
	{ title: "Dashboard", href: "#/app", icon: <HouseIcon /> },
	{ title: "Connections", href: "#/app/connections", icon: <DatabaseIcon /> },
	{ title: "Jobs", href: "#/app/jobs", icon: <WorkflowIcon />, isActive: true },
];

/** The signed-in member shown in the sidebar footer. */
export const USER = {
	name: "Ángel Iglesias",
	email: "member@keasy.local",
};

export type NodeKind = "dataset" | "distribution" | "keyword" | "entity";

export interface GraphNode {
	id: string;
	x: number; // in the 0..200 viewBox
	y: number; // in the 0..140 viewBox
	r: number;
	kind: NodeKind;
	label: string;
}

export interface GraphEdge {
	from: string;
	to: string;
}

export const GRAPH_NODES: GraphNode[] = [
	{
		id: "dataset",
		x: 100,
		y: 70,
		r: 9,
		kind: "dataset",
		label: "aemet.fossil",
	},
	{
		id: "dist-parquet",
		x: 55,
		y: 42,
		r: 5.5,
		kind: "distribution",
		label: "parquet",
	},
	{ id: "dist-csv", x: 150, y: 40, r: 5.5, kind: "distribution", label: "csv" },
	{
		id: "dist-graphar",
		x: 158,
		y: 96,
		r: 5.5,
		kind: "distribution",
		label: "graphar",
	},
	{ id: "kw-weather", x: 30, y: 88, r: 4, kind: "keyword", label: "weather" },
	{ id: "kw-spain", x: 62, y: 114, r: 4, kind: "keyword", label: "spain" },
	{ id: "kw-climate", x: 120, y: 116, r: 4, kind: "keyword", label: "climate" },
	{ id: "pub", x: 100, y: 22, r: 6, kind: "entity", label: "AEMET" },
	{ id: "theme", x: 178, y: 66, r: 5, kind: "entity", label: "ENVI" },
	{ id: "station", x: 40, y: 60, r: 4.5, kind: "entity", label: "station" },
	{ id: "obs", x: 178, y: 122, r: 4.5, kind: "entity", label: "observation" },
];

export const GRAPH_EDGES: GraphEdge[] = [
	{ from: "dataset", to: "dist-parquet" },
	{ from: "dataset", to: "dist-csv" },
	{ from: "dataset", to: "dist-graphar" },
	{ from: "dataset", to: "kw-weather" },
	{ from: "dataset", to: "kw-spain" },
	{ from: "dataset", to: "kw-climate" },
	{ from: "dataset", to: "pub" },
	{ from: "dataset", to: "theme" },
	{ from: "dataset", to: "station" },
	{ from: "station", to: "kw-weather" },
	{ from: "dist-graphar", to: "obs" },
	{ from: "dist-graphar", to: "theme" },
];

/** Bottom-start legend, keyed to the node kinds. Counts are the real tallies in GRAPH_NODES. */
export const GRAPH_LEGEND: { kind: NodeKind; label: string; count: number }[] = [
	{ kind: "dataset", label: "Dataset", count: 1 },
	{ kind: "distribution", label: "Distribution", count: 3 },
	{ kind: "entity", label: "Entity", count: 4 },
	{ kind: "keyword", label: "Keyword", count: 3 },
];

/** The node the inspector shows selected — mirrors discovery's Info tab. */
export const SELECTED_NODE = {
	label: "aemet.fossil",
	id: "urn:dataset:aemet.fossil",
	type: "Dataset",
	properties: [
		{ predicate: "dct:title", value: "AEMET fossil observations" },
		{ predicate: "dct:issued", value: "2026-01-14" },
		{ predicate: "dcat:keyword", value: "weather, spain, climate" },
		{ predicate: "dct:publisher", value: "Agencia Estatal de Meteorología" },
		{
			predicate: "dcat:theme",
			value: "http://publications.europa.eu/resource/authority/data-theme/ENVI",
		},
	],
};

/**
 * The Analysis view reads no fixture from here: it renders REAL crossfilter charts over a live
 * DuckDB relation, and that relation lives in `./analysis-data`, next to the client-only island that
 * loads it — the same rule as the rest of the sample data on the /charts subpath.
 */

/** Suggested-question chips for the Ask panel's empty state (mirrors keasy's demo). */
export const ASK_SUGGESTIONS = [
	"What are the most common attributes?",
	"How many WeatherObserved entities are there?",
	"Which datasets mention weather?",
	"What is the average temperature?",
];

/** One row of the Rules filter builder: a conjunction + field/op/value dropdowns. */
export interface RuleFilter {
	conj: "Where" | "And";
	entity: string;
	field: string;
	op: string;
	value?: string;
}

/** The faux Where/And filter stack shown in the Rules panel (mirrors the validation frames). */
export const RULE_FILTERS: RuleFilter[] = [
	{ conj: "Where", entity: "WeatherObserved", field: "dataProvider", op: "Must have value" },
	{ conj: "And", entity: "Attribute", field: "hasValue", op: "Minimum", value: "Select value" },
];

/** Force-simulation sliders in the Settings tab. */
export const SIM_PARAMS = [
	{
		key: "repulsion",
		label: "Repulsion",
		min: 0,
		max: 2,
		step: 0.05,
		default: 0.5,
	},
	{
		key: "friction",
		label: "Friction",
		min: 0,
		max: 1,
		step: 0.05,
		default: 0.5,
	},
	{
		key: "gravity",
		label: "Gravity",
		min: 0,
		max: 1,
		step: 0.05,
		default: 0.25,
	},
	{
		key: "linkDistance",
		label: "Link distance",
		min: 1,
		max: 100,
		step: 1,
		default: 20,
	},
	{
		key: "pointSize",
		label: "Point size",
		min: 0.5,
		max: 5,
		step: 0.1,
		default: 1.1,
	},
] as const;

export type SimKey = (typeof SIM_PARAMS)[number]["key"];
