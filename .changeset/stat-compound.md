---
"@kanzo-tech/ui": major
---

**BREAKING: `StatTile` is gone; a dashboard number is the `Stat` compound.** `StatRoot` is a `Card`
— `asChild` makes your link the tile, and `variant` (`"default" | "success" | "info" | "warning" |
"destructive"`) tints a `StatIndicator` icon disc. Inside it go `StatLabel`, `StatValue` (with
`loading` for a skeleton), `StatDelta`, `StatTrend` and `StatDescription`. `StatTile`,
`StatTileProps` and `StatTileDelta` are removed with no alias. Move each tile to the parts:

```diff
- <StatTile
-   label="Gold on the board"
-   value={12_400}
-   delta={{ value: 4.2, unit: "%", label: "vs last month", goodWhenUp: true }}
-   trend={byMonth}
- />
+ <StatRoot>
+   <StatLabel>Gold on the board</StatLabel>
+   <StatValue>
+     <FormatNumber notation="compact" value={12_400} />
+   </StatValue>
+   <StatTrend values={byMonth} />
+   <StatDelta unit="%" value={4.2}>vs last month</StatDelta>
+ </StatRoot>
```

`StatValue` does not format: `StatTile` compacted a numeric `value` from ten thousand up, and now you
choose — `<FormatNumber notation={n >= 10_000 ? "compact" : "standard"} value={n} />` is the old
reading exactly, and `prefix="$"` is `style="currency" currency="USD"` or a string. The delta's `label` is `StatDelta`'s children, `trend` is
`StatTrend`'s `values`, and a delta of zero now reads muted with a flat mark rather than as a rise.

If you copied `MetricCard` out of the docs showcase, replace it too: `MetricCard href status` is
`<StatRoot asChild variant><a href>…</a></StatRoot>` (`"neutral"` is `"default"`, `"danger"` is
`"destructive"`), `MetricCardIcon` is `StatIndicator`, `MetricCardLabel` is `StatLabel`,
`MetricCardValue` is `StatValue`, `MetricCardDescription` is `StatDescription`, and
`MetricCardHeader` is dropped — the indicator and label share a row on their own.

**BREAKING, `@kanzo-tech/ui/analytics`: `ChartStat` is the figure, not the tile.** It renders a
`StatValue` whose number is queried, so it goes inside a `StatRoot` beside your own label; `label`,
`delta`, `prefix` and `fallback` are removed, and it shows `StatValue`'s skeleton until the first
answer.

```diff
- <ChartStat label="Sightings" table="sightings" value={count()} />
+ <StatRoot>
+   <StatLabel>Sightings</StatLabel>
+   <ChartStat table="sightings" value={count()} />
+ </StatRoot>
```
