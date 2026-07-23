"use client";

import { useEffect, useState } from "react";
import { loadObjects } from "@uwdata/mosaic-sql";
import {
	BarChart,
	Coordinator,
	Histogram,
	LineChart,
	MosaicProvider,
	ScatterPlot,
	wasmConnector,
} from "@kanzo-tech/ui/charts";
import { Button, ScrollArea, Skeleton } from "@kanzo-tech/ui";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";

/**
 * The Analysis panel's body, wired to REAL crossfilter charts from `@kanzo-tech/ui/charts`.
 *
 * This is the discovery showcase's one live island. It is loaded client-only from `default.tsx`
 * (`dynamic(..., { ssr: false })`) so the Mosaic/vgplot/DuckDB module tree is never evaluated during
 * the RSC prerender — exactly the boundary `docs/examples/charts/example-default.tsx` documents. The
 * library never touches DuckDB: this island boots DuckDB-WASM (`wasmConnector`), loads a sample table
 * and owns the `Coordinator`, then hands it to `MosaicProvider`. Every chart below reads the one
 * shared crossfilter selection, so brushing/toggling any one refilters the others (the dual-layer
 * dimmed "all data" + `--primary` "current selection" look is built into the components).
 *
 * The sample table fits the discovery domain — a WeatherObserved / AEMET slice — so the Analysis
 * panel reads as the same knowledge graph the canvas draws, not a generic demo:
 *
 *   table `weather` (one row per observation)
 *   ├─ dataProvider  categorical  AEMET · MeteoCat · Euskalmet · SMC   → BarChart (click to toggle)
 *   ├─ region        categorical  Galicia · Cataluña · Andalucía · …   → BarChart (click to toggle)
 *   ├─ temperature   numeric °C                                        → Histogram (drag to brush)
 *   ├─ windSpeed     numeric m/s                                       → Histogram (drag to brush)
 *   ├─ hour          ordered 0–23                                      → LineChart (drag to brush)
 *   └─ temperature × windSpeed                                         → ScatterPlot (drag a box)
 */

const PROVIDERS = ["AEMET", "MeteoCat", "Euskalmet", "SMC"] as const;
const REGIONS = ["Galicia", "Cataluña", "Andalucía", "Castilla", "País Vasco"] as const;

// A `type` alias, not an `interface`: an anonymous object type gets an implicit index signature, so
// it satisfies `loadObjects`'s `Record<string, unknown>[]` parameter (an interface would not).
type WeatherRow = {
	dataProvider: string;
	region: string;
	temperature: number;
	windSpeed: number;
	hour: number;
};

/**
 * ~700 synthetic WeatherObserved rows. Temperature follows a daily curve (coldest before dawn,
 * warmest mid-afternoon) with a per-region offset, and windSpeed loosely tracks it, so the scatter
 * shows a real cloud and every chart moves when another is brushed.
 */
function sampleRows(): WeatherRow[] {
	const rows: WeatherRow[] = [];
	for (let i = 0; i < 700; i++) {
		const hour = i % 24;
		const region = REGIONS[i % REGIONS.length];
		// AEMET is the national provider and dominates; the others are regional.
		const dataProvider =
			i % 5 === 0 ? PROVIDERS[1 + (i % 3)] : PROVIDERS[0];
		// Daily temperature curve: min ~06:00, max ~15:00. Regional offset + noise.
		const daily = Math.sin(((hour - 9) / 24) * 2 * Math.PI);
		const regionOffset = (i % REGIONS.length) * 1.5 - 3;
		const temperature = Math.round(
			(15 + daily * 9 + regionOffset + (Math.random() - 0.5) * 5) * 10,
		) / 10;
		// Wind rises with daytime heating and adds a right-skewed gust term.
		const windSpeed = Math.round(
			(4 + Math.max(0, daily) * 6 + Math.abs(Math.sin(i * 1.3)) * 5 +
				Math.random() * 3) * 10,
		) / 10;
		rows.push({ dataProvider, region, temperature, windSpeed, hour });
	}
	return rows;
}

/** The Analysis panel's chart cards, each bound to a column of the shared crossfilter table. */
const CHARTS = [
	{ name: "temperature (°C)", render: () => <Histogram column="temperature" height={120} table="weather" /> },
	{ name: "windSpeed (m/s)", render: () => <Histogram column="windSpeed" height={120} table="weather" /> },
	{ name: "dataProvider", render: () => <BarChart column="dataProvider" height={120} table="weather" /> },
	{ name: "region", render: () => <BarChart column="region" height={120} table="weather" /> },
	{ name: "observations by hour", render: () => <LineChart column="hour" height={120} table="weather" /> },
	{ name: "temperature × windSpeed", render: () => <ScatterPlot height={120} table="weather" x="temperature" y="windSpeed" /> },
] as const;

export default function AnalysisCharts() {
	const [coordinator, setCoordinator] = useState<Coordinator | null>(null);

	useEffect(() => {
		let active = true;
		(async () => {
			// Bring-your-own-coordinator: the showcase wires DuckDB-WASM and owns the Coordinator; the
			// package never imports DuckDB. `wasmConnector` lazily downloads + instantiates DuckDB-WASM.
			const connector = wasmConnector();
			const coord = new Coordinator(connector);
			await coord.exec(loadObjects("weather", sampleRows()));
			if (active) setCoordinator(coord);
		})();
		return () => {
			active = false;
		};
	}, []);

	if (!coordinator) {
		return (
			<ScrollArea className="h-full">
				<div className="space-y-2 p-1.5">
					{CHARTS.map((c) => (
						<Skeleton className="h-[7.5rem] w-full rounded-sm" key={c.name} />
					))}
				</div>
			</ScrollArea>
		);
	}

	return (
		<MosaicProvider coordinator={coordinator}>
			<ScrollArea className="h-full">
				<div className="space-y-2 p-1.5">
					{CHARTS.map((c) => (
						<div
							className="group overflow-hidden rounded-sm border border-border bg-card"
							key={c.name}
						>
							<div className="flex h-6 items-center justify-between px-2">
								<span className="truncate text-[10px] text-muted-foreground">
									{c.name}
								</span>
								<div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
									<Button
										aria-label="Edit chart"
										className="size-4"
										size="icon-sm"
										variant="ghost"
									>
										<PencilIcon className="size-2.5" />
									</Button>
									<Button
										aria-label="Delete chart"
										className="size-4 text-muted-foreground hover:text-destructive"
										size="icon-sm"
										variant="ghost"
									>
										<Trash2Icon className="size-2.5" />
									</Button>
								</div>
							</div>
							{/* WIRE POINT (now live): the faux stacked-bar body is replaced by a real
							    tokenized crossfilter chart. Brushing/toggling one refilters the rest. */}
							<div className="px-2 pt-0.5 pb-2" data-slot="analysis-chart">
								{c.render()}
							</div>
						</div>
					))}
					<Button
						className="h-6 gap-1 text-[10px] text-muted-foreground"
						size="sm"
						variant="link"
					>
						<PlusIcon className="size-2.5" />
						Add chart
					</Button>
				</div>
			</ScrollArea>
		</MosaicProvider>
	);
}
