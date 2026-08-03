"use client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Item,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemHeader,
  ItemMedia,
  ItemTitle,
  SectionDescription,
  SectionHeader,
  SectionTitle,
  SectionTitleGroup,
  Show,
  Swatch,
  SwatchGroup,
} from "@kanzo-tech/ui";
import { InfoIcon, TriangleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { TaggedAdjustment, TaggedRelief } from "@kanzo-tech/palette";
import type { PaletteView, RampView } from "./derive";

/**
 * A titled block within the screen — the Section header parts at `section` scale.
 *
 * `SectionRoot`/`SectionBody` are deliberately not used: both are `flex-1 min-h-0` and the body
 * scrolls, which is right for the one region that owns a viewport and wrong for six stacked
 * blocks inside it. The header vocabulary is the part that was being hand-rolled.
 */
export function Block({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <SectionHeader>
        <SectionTitleGroup>
          <SectionTitle className="text-base">{title}</SectionTitle>
          <Show when={hint != null}>
            <SectionDescription className="text-pretty">{hint}</SectionDescription>
          </Show>
        </SectionTitleGroup>
      </SectionHeader>
      {children}
    </section>
  );
}

/** `size="lg"` swatches are `size-5` at `gap-0.5`, so a 1.25rem column ruler lines up with the strip. */
export function RampStrip({ colors, fill }: { colors: string[]; fill?: number }) {
  return (
    <div className="flex flex-col gap-1">
      <SwatchGroup className="rounded-sm ring-1 ring-border" colors={colors} size="lg" />
      <div aria-hidden className="flex gap-0.5 font-mono text-[10px] leading-none">
        {colors.map((_, i) => (
          <span
            className={
              i + 1 === fill
                ? "w-5 text-center font-semibold text-foreground"
                : "w-5 text-center text-muted-foreground"
            }
            key={i}
          >
            {i + 1}
          </span>
        ))}
      </div>
    </div>
  );
}

export function RampRow({ ramp, fill }: { ramp: RampView; fill?: number }) {
  return (
    <Item variant="outline">
      <ItemMedia>
        <Swatch color={ramp.seed} shape="round" size="lg" />
      </ItemMedia>
      <ItemContent className="max-w-40 flex-none">
        <ItemTitle>{ramp.name}</ItemTitle>
        <ItemDescription className="font-mono text-xs">
          {ramp.seed} · {ramp.hue == null ? "no hue" : `${ramp.hue.toFixed(1)}°`}
        </ItemDescription>
      </ItemContent>
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">
            Light · boundary {ramp.boundary.light} · on-solid {ramp.onSolid.light}
          </span>
          <RampStrip colors={ramp.light} fill={fill} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">
            Dark · boundary {ramp.boundary.dark} · on-solid {ramp.onSolid.dark}
          </span>
          <RampStrip colors={ramp.dark} fill={fill} />
        </div>
      </div>
    </Item>
  );
}

/**
 * A colour and its hex, as one inline run.
 *
 * The ring is not decoration: half the values on this screen are step 1 and step 12, and an
 * unringed `#efefef` on a card is an empty space where the reader was promised a colour.
 */
export function ColorChip({ color }: { color: string }) {
  return (
    <span className="inline-flex items-center gap-1 align-middle font-mono text-xs">
      <Swatch className="ring-1 ring-border" color={color} size="md" />
      {color}
    </span>
  );
}

/** From → to, drawn. The pair is the claim; the hexes beside it are the evidence. */
export function MoveSwatches({ from, to }: { from: string; to: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <ColorChip color={from} />
      <span aria-hidden className="text-muted-foreground">
        →
      </span>
      <ColorChip color={to} />
    </span>
  );
}

/**
 * What moved, said the way a person would say it.
 *
 * Every adjustment in the shipped seed set is a lightness move: chroma shifts by at most 0.001 and
 * hue by under 0.21°. That is the finding worth putting on this screen — a foreign seed keeps its
 * hue and gives up its place — so the hue is named even though it did not move.
 */
export function movePhrase(a: TaggedAdjustment): string {
  const direction = a.lightness < 0 ? "darker" : "lighter";
  const points = (Math.abs(a.lightness) * 100).toFixed(1);
  const chroma = a.chroma >= 0 ? `+${a.chroma.toFixed(4)}` : a.chroma.toFixed(4);
  return `${direction} by ${points} points of OKLCH lightness · chroma ${chroma} · hue held to ${Math.abs(a.hue).toFixed(2)}°`;
}

export function AdjustmentItem({ a }: { a: TaggedAdjustment }) {
  return (
    <Item variant="outline">
      <ItemHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge size="sm" variant="outline">
            {a.ramp}
          </Badge>
          <Badge size="sm" variant="secondary">
            {a.mode}
          </Badge>
          <Badge size="sm" variant="warning">
            {a.obligation}
          </Badge>
        </div>
        <span className="text-muted-foreground text-xs">
          step {a.step} · ΔE {a.deltaE.toFixed(2)}
        </span>
      </ItemHeader>
      <ItemContent>
        <ItemTitle>
          <MoveSwatches from={a.from} to={a.to} />
        </ItemTitle>
        <ItemDescription className="line-clamp-none text-foreground">
          {movePhrase(a)}
        </ItemDescription>
      </ItemContent>
      <ItemFooter>
        <p className="text-muted-foreground text-sm">{a.reason}</p>
      </ItemFooter>
    </Item>
  );
}

/**
 * The relief verdict, read by ramp and never by presence.
 *
 * `carries-identity` fires on **every** tinted base by design, so a healthy palette produces
 * relief rows as its normal state. Rendering any of them as an alert would make every correct
 * palette look broken — the ramp decides which sentence is true, so the brand case gets the `Alert`
 * and the base case gets an ordinary record row.
 */
export function ReliefVerdict({ palette }: { palette: PaletteView }) {
  const brand = palette.relief.filter((r) => r.ramp === "brand");
  const base = palette.relief.filter((r) => r.ramp === "base");
  const other = palette.relief.filter((r) => r.ramp !== "brand" && r.ramp !== "base");

  return (
    <div className="flex flex-col gap-3">
      <Show when={brand.length > 0}>
        <BrandRelief palette={palette} rows={brand} />
      </Show>
      <Show when={base.length > 0}>
        <NeutralRelief palette={palette} rows={base} />
      </Show>
      <Show when={other.length > 0}>
        <Item variant="muted">
          <ItemContent>
            <ItemTitle>A status ramp reported relief</ItemTitle>
            <ItemDescription className="line-clamp-none">
              {other.map((r) => `${r.ramp} (${r.mode}): ${r.id}`).join(" · ")}. The four status
              families are Kanzo&rsquo;s, but they are graded against this tenant&rsquo;s surface.
            </ItemDescription>
          </ItemContent>
        </Item>
      </Show>
    </div>
  );
}

/** `HueSource`, as a clause. The provenance is a field precisely so this can be said out loud. */
export function hueSource(from: string): string {
  if (from === "base-seed") return "taken from the base the client gave";
  if (from === "brand") return "carried over from the brand, since no base hue was given";
  return "with no hue to carry";
}

function chromaOf(rows: TaggedRelief[]): string {
  const worst = Math.max(...rows.map((r) => r.got));
  return worst < 0.0005 ? "no measurable chroma at all" : `chroma ${worst.toFixed(4)}`;
}

/**
 * Brand relief, split by the field the fill rule actually reads.
 *
 * `carries-identity` grades step 9 against the chroma floor (0.1); the monochrome fill rule fires on
 * `ramp.hue === null`, which is a *different* question — a ramp keeps its hue from 0.0035 up. So a
 * weakly chromatic brand reports this relief and still spends step 9 on it. Saying "the fill takes
 * the monochrome rule" on both would print "step 9 instead of step 9" for Nord, and would tell that
 * client their blue was thrown away when it was kept.
 */
function BrandRelief({ palette, rows }: { palette: PaletteView; rows: TaggedRelief[] }) {
  const floor = rows[0]?.wanted ?? 0.1;
  const hue = palette.ramps.find((r) => r.name === "brand")?.hue ?? null;
  const preamble = (
    <>
      <code>{palette.brandSeed}</code> reaches {chromaOf(rows)} at step 9, under a floor of {floor}.
      This is the one obligation that can never become an adjustment: below the floor there is no
      nearest legal value, and the nearest chromatic colour would be a hue <em>we</em> chose. So it
      is published rather than repaired.
    </>
  );

  return (
    <Show
      fallback={
        <Alert variant="info">
          <InfoIcon />
          <AlertTitle>The brand seed is chromatic, but barely</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <p>
              {preamble} It does <strong>not</strong> take the monochrome rule: that fires on a ramp
              with no hue at all, and this one has {hue?.toFixed(1)}°. So{" "}
              <code>--primary</code> stays at step {palette.fillStep} and keeps it —{" "}
              {palette.primary.light} in light, {palette.primary.dark} in dark. What this identity
              gives up is saturation, not itself.
            </p>
            <p className="text-xs">
              The two thresholds are deliberately different. A ramp keeps a seed&rsquo;s hue from
              chroma 0.0035 up, which is where encoding noise ends; the floor this row is measured
              against is 0.1, which is where a colour starts carrying an identity on its own. Reading
              the relief as the fill rule sent every weakly chromatic brand to a near-black.
            </p>
          </AlertDescription>
        </Alert>
      }
      when={hue == null}
    >
      <Alert variant="warning">
        <TriangleAlertIcon />
        <AlertTitle>The brand seed carries no hue</AlertTitle>
        <AlertDescription className="flex flex-col gap-2">
          <p>
            {preamble} The fill takes the monochrome rule — <code>--primary</code> comes from step{" "}
            {palette.fillStep}, the ramp&rsquo;s ink, instead of step 9. That is{" "}
            {palette.primary.light} in light and {palette.primary.dark} in dark. Step 9 is where a
            fill reads as a shape <em>by hue</em>; a ramp with none has only lightness left, and
            lightness carries furthest at the extreme.
          </p>
          <p className="text-xs">
            Decided over the ramp pair and not per mode, off a field the two modes cannot disagree
            about: <code>hue</code> is read from the seed before either mode is solved, and across a
            14,760-seed sweep 0 disagree. Graded on this relief instead — which is measured on the
            gamut-mapped step 9, solved per mode — 86 of them straddle, and each of those tenants
            would get a near-black primary in one mode and a mid-hue one in the other, which is the
            same button.
          </p>
        </AlertDescription>
      </Alert>
    </Show>
  );
}

function NeutralRelief({ palette, rows }: { palette: PaletteView; rows: TaggedRelief[] }) {
  return (
    <Item variant="muted">
      <ItemContent>
        <ItemTitle>
          <span>
            The base ramp reported <code>carries-identity</code>
          </span>
          <Badge size="sm" variant="success">
            expected
          </Badge>
        </ItemTitle>
        <ItemDescription className="line-clamp-none">
          A tinted base is a low chroma at a hue by definition, so it sits under the floor on
          purpose and reports this every time. Nothing is wrong.{" "}
          <Show
            fallback={
              <>
                This seed is a true grey — {chromaOf(rows)} — so there is no hue to keep and the ramp
                is achromatic the whole way up.
              </>
            }
            when={palette.baseHue != null}
          >
            The hue survives in full: every base step is generated at{" "}
            {palette.baseHue?.toFixed(1)}°, {hueSource(palette.baseHueFrom)}.
          </Show>
        </ItemDescription>
      </ItemContent>
    </Item>
  );
}
