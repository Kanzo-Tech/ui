"use client";

import {
  Badge,
  Clipboard,
  ClipboardControl,
  ClipboardLabel,
  ClipboardTrigger,
  EmptyState,
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionRoot,
  SectionTitle,
  SectionTitleGroup,
  Separator,
  Show,
  Swatch,
  SwatchGroup,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@kanzo-tech/ui";
import { CheckCheckIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { PaletteView } from "./derive";
import { AdjustmentItem, Block, ColorChip, RampRow, ReliefVerdict, hueSource } from "./parts";

/**
 * The screen a hall sees when it registers its heraldry: two seeds in, a measured document out.
 *
 * A hall&rsquo;s `heraldry` is the seed pair — the brand it signs with and the neutral it prints
 * on — so the tabs are five real identities rather than five ways of demonstrating theming. Every
 * number here comes from a real `derivePalette` run on the server (see `derive.ts`). Nothing on
 * this page is illustrative.
 */
export function PaletteOnboarding({ palettes }: { palettes: PaletteView[] }) {
  return (
    <div className="min-h-svh bg-background p-8">
      <SectionRoot>
        <SectionHeader scale="page">
          <SectionTitleGroup>
            <SectionTitle level={1} scale="page">
              Registering heraldry
            </SectionTitle>
            <SectionDescription>
              A hall gives two seeds — the brand it signs with and the neutral it prints on.
              Everything below is derived from that pair once, measured against the hall&rsquo;s own
              surfaces, and stored as a document. Runtime only applies it.
            </SectionDescription>
          </SectionTitleGroup>
          <Badge variant="info">derived at build time</Badge>
        </SectionHeader>

        <SectionBody scale="page">
          <Tabs defaultValue={palettes[0]?.id}>
            <TabsList variant="underline">
              {palettes.map((p) => (
                <TabsTrigger key={p.id} value={p.id}>
                  <SwatchGroup colors={[p.brandSeed, p.neutralSeed]} shape="round" size="xs" />
                  {p.short}
                </TabsTrigger>
              ))}
            </TabsList>

            {palettes.map((p) => (
              <TabsContent className="flex flex-col gap-8 pt-4" key={p.id} value={p.id}>
                <Registration palette={p} />
              </TabsContent>
            ))}
          </Tabs>
        </SectionBody>
      </SectionRoot>
    </div>
  );
}

function Registration({ palette: p }: { palette: PaletteView }) {
  return (
    <>
      {/* `Show`'s children are eager, so the hall is read through `?.` — the guard picks the
          sentence, it does not defer the lookup. */}
      <Show
        fallback={
          <p className="text-muted-foreground text-sm">
            {p.label} belongs to no hall: it is the document the stylesheet already ships with, and
            what a hall wears until it registers. The same grey stands as both seeds, which makes it
            the one monochrome pair here — the case the fill rule below is written for.
          </p>
        }
        when={p.hall != null}
      >
        <p className="text-muted-foreground text-sm">
          {p.label} — {p.hall?.standing?.toLowerCase()} since {p.hall?.founded}, seat at{" "}
          {p.hall?.seat}. <em>{p.hall?.motto}</em>
        </p>
      </Show>

      <Block
        hint={
          <>
            The neutral supplies the tint hue; the brand hue is the fallback when none is given. The
            four status families are Kanzo&rsquo;s and are not a hall&rsquo;s to override — but they
            are re-measured here, because every obligation is graded against the surface and the
            surface is this hall&rsquo;s.
          </>
        }
        title="The seeds"
      >
        <ItemGroup className="grid gap-3 sm:grid-cols-2">
          <SeedItem
            color={p.brandSeed}
            note={
              <>
                Fill from step {p.fillStep}, so <code>--primary</code> is{" "}
                <ColorChip color={p.primary.light} /> in light and{" "}
                <ColorChip color={p.primary.dark} /> in dark.
              </>
            }
            title="Brand"
          />
          <SeedItem
            color={p.neutralSeed}
            note={
              p.neutralHue == null
                ? "No hue to keep — a true grey, so every step is achromatic."
                : `Hue ${p.neutralHue.toFixed(1)}°, ${hueSource(p.neutralHueFrom)}, and kept in full on every step.`
            }
            title="Neutral"
          />
        </ItemGroup>
      </Block>

      <Block
        hint="A failing gate adjusts and publishes what moved; the one it cannot adjust is published as relief. No heraldry on this page moves a step — all five halls' brands are legal exactly where the ramp puts them, so what they publish is relief and nothing else. The base16 page is where a seed pays."
        title="The record"
      >
        <ReliefVerdict palette={p} />
        <Show
          fallback={
            <EmptyState
              description={`Every step of all six ramps met its obligation as generated. ${p.label} needed no repair.`}
              icon={<CheckCheckIcon />}
              title="Nothing moved"
            />
          }
          when={p.adjustments.length > 0}
        >
          <ItemGroup>
            {p.adjustments.map((a, i) => (
              <AdjustmentItem a={a} key={`${a.ramp}-${a.mode}-${a.obligation}-${i}`} />
            ))}
          </ItemGroup>
        </Show>
      </Block>

      <Block
        hint="Twelve steps per mode. 1 is the page, 3/4/5 are one component's normal / hover / active surface, 6 is the border, 9 is the solid, 11 and 12 are ink. The bold number is where this identity's brand fill comes from."
        title="The ramps"
      >
        <ItemGroup>
          {p.ramps.map((ramp) => (
            <RampRow fill={ramp.name === "brand" ? p.fillStep : undefined} key={ramp.name} ramp={ramp} />
          ))}
        </ItemGroup>
      </Block>

      <Block
        hint={
          p.categorical.from === "brand-wheel"
            ? `Hues spaced from the brand hue and snapped to families — the brand's own family (${p.categorical.family}) must be present, which is why the default eight are not simply reused.`
            : "The brand names no hue family — matching one asks chroma 0.1 of the seed and this one is under it — so there was no wheel to cut and the default scheme stands in. A brand that keeps its fill can still land here: a fill only has to be seen, where a category has to be told from seven others under simulation."
        }
        title="The categorical set"
      >
        <ItemGroup className="flex-row flex-wrap gap-3">
          <Item className="w-auto" variant="outline">
            <ItemContent>
              <ItemTitle>Light</ItemTitle>
              <SwatchGroup colors={p.categorical.light} shape="round" size="lg" />
              <ItemDescription>
                worst adjacent pair under simulation, ΔE {p.categorical.separation.light.toFixed(1)}
              </ItemDescription>
            </ItemContent>
          </Item>
          <Item className="w-auto" variant="outline">
            <ItemContent>
              <ItemTitle>Dark</ItemTitle>
              <SwatchGroup colors={p.categorical.dark} shape="round" size="lg" />
              <ItemDescription>
                worst adjacent pair under simulation, ΔE {p.categorical.separation.dark.toFixed(1)}
              </ItemDescription>
            </ItemContent>
          </Item>
          <Item className="w-auto max-w-md" variant="muted">
            <ItemContent>
              <ItemTitle>
                Capacity {p.categorical.capacity} of 8
                <Badge size="sm" variant="secondary">
                  {p.categorical.from}
                </Badge>
              </ItemTitle>
              <ItemDescription className="line-clamp-none">
                Kept {p.categorical.kept.join(", ") || "—"} — families, because a family is what
                the search picks; what it picks from is a colour.
                <Show when={p.categorical.crowded.length > 0}>
                  {" "}
                  Crowded out for want of separation:{" "}
                  <SwatchGroup
                    className="inline-flex translate-y-0.5"
                    colors={p.categorical.crowded}
                    shape="round"
                    size="sm"
                  />{" "}
                  {p.categorical.crowded.join(", ")}.
                </Show>
                <Show when={p.categorical.dropped.length > 0}>
                  {" "}
                  Dropped for carrying no usable hue:{" "}
                  <SwatchGroup
                    className="inline-flex translate-y-0.5"
                    colors={p.categorical.dropped}
                    shape="round"
                    size="sm"
                  />{" "}
                  {p.categorical.dropped.join(", ")}. Never conflated with the line above: one says
                  there was no hue, the other says there was no room.
                </Show>{" "}
                Slots past capacity compile to <code>var(--muted-foreground)</code> rather than
                inventing a colour.
              </ItemDescription>
            </ItemContent>
          </Item>
        </ItemGroup>
      </Block>

      <Separator />

      <Block
        hint={`One stylesheet, both modes, every colour token, literal hex. ${p.css.length} bytes, derived in ${p.ms} ms — a cost paid once, here, and never in a browser.`}
        title="What ships"
      >
        <Clipboard timeout={1200} value={p.css}>
          <ClipboardControl>
            <ClipboardLabel>compile(document)</ClipboardLabel>
            <ClipboardTrigger aria-label={`Copy the ${p.label} stylesheet`} />
          </ClipboardControl>
        </Clipboard>
        <pre className="max-h-72 overflow-auto rounded-xl border border-border bg-muted/48 p-3 font-mono text-xs">
          {p.css}
        </pre>
      </Block>
    </>
  );
}

function SeedItem({ color, title, note }: { color: string; title: string; note: ReactNode }) {
  return (
    <Item variant="outline">
      <ItemMedia>
        <Swatch className="size-10 rounded-lg" color={color} />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>
          {title}
          <code className="font-mono text-muted-foreground text-xs">{color}</code>
        </ItemTitle>
        <ItemDescription className="line-clamp-none">{note}</ItemDescription>
      </ItemContent>
    </Item>
  );
}
