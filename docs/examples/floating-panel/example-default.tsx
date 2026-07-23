"use client";

import { useState } from "react";
import { FloatingPanel, FloatingPanelResizeHandle } from "@kanzo-tech/ui";

export default function Example() {
	const [width, setWidth] = useState(220);

	return (
		<div className="relative h-64 w-full max-w-xl overflow-hidden rounded-lg border bg-muted/30">
			<div
				className="absolute inset-0 grid place-items-center text-muted-foreground text-sm"
				style={{
					backgroundImage:
						"radial-gradient(var(--border) 0.5px, transparent 0.5px)",
					backgroundSize: "16px 16px",
				}}
			>
				Canvas
			</div>

			<FloatingPanel
				className="absolute inset-y-2 end-2"
				maxWidth={340}
				minWidth={160}
				onWidthChange={setWidth}
				width={width}
			>
				<FloatingPanelResizeHandle side="start" />
				<div className="min-w-0 flex-1 p-3">
					<p className="font-medium text-sm">Inspector</p>
					<p className="mt-1 text-muted-foreground text-xs">
						Drag the left edge to resize — {Math.round(width)}px.
					</p>
				</div>
			</FloatingPanel>
		</div>
	);
}
