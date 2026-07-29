"use client";

import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldLabel,
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionRoot,
  SectionTitle,
  SectionTitleGroup,
  SegmentGroup,
  Separator,
  Show,
  Swatch,
  SwatchGroup,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@kanzo-tech/ui";
import { useState } from "react";
import type { PaletteView } from "./derive";
import { AdjustmentItem, Block, RampStrip, ReliefVerdict } from "./parts";

/** The "no tenant document applied" option — the tokens the stylesheet already ships with. */
const KANZO = "kanzo";

/**
 * The authored original beside the derived result.
 *
 * base16 identities are not a second shape in this system — they are seeds, run through the same
 * `derivePalette` a client is. This page is the demonstration that the system digests a foreign
 * identity and charges an honest price for it, and "Wear it" is the price being paid in public:
 * the compiled document replaces every colour token on the page, which is the whole of the runtime
 * mechanism. There is nothing else to swap.
 */
export function Base16Comparison({ palettes }: { palettes: PaletteView[] }) {
  const [worn, setWorn] = useState<string | null>(null);
  const wornPalette = palettes.find((p) => p.id === worn);

  return (
    <div className="min-h-svh bg-background p-8">
      {/* The one mechanism: a compiled document is a stylesheet, and applying it is appending one.
          It outranks the default tokens by source order, which is all the cascade needs. */}
      {wornPalette && <style>{wornPalette.css}</style>}

      <SectionRoot>
        <SectionHeader scale="page">
          <SectionTitleGroup>
            <SectionTitle level={1} scale="page">
              Authored, and derived
            </SectionTitle>
            <SectionDescription>
              Dracula, Nord and the Catppuccins are <strong>seeds</strong> here, not palettes: a
              brand hue and a neutral hue, through the same derivation a client goes through. The
              left column is what their authors wrote. The right column is what this system makes of
              it — same hues, different places.
            </SectionDescription>
          </SectionTitleGroup>
          <Badge variant="info">derived at build time</Badge>
        </SectionHeader>

        <SectionBody scale="page">
          {/* Single-select, so a SegmentGroup and not a ButtonGroup — the library says so, and it
              is right: these are not independent actions, they are one choice. */}
          <Field orientation="horizontal">
            <FieldLabel className="w-fit shrink-0">This page is wearing</FieldLabel>
            <SegmentGroup
              aria-label="Palette worn by this page"
              onValueChange={(d) => setWorn(d.value === KANZO ? null : d.value)}
              options={[
                { value: KANZO, label: "Kanzo default" },
                ...palettes.map((p) => ({ value: p.id, label: p.label })),
              ]}
              value={worn ?? KANZO}
              variant="solid"
            />
          </Field>

          <Tabs defaultValue={palettes[0]?.id}>
            <TabsList variant="underline">
              {palettes.map((p) => (
                <TabsTrigger key={p.id} value={p.id}>
                  <SwatchGroup colors={[p.brandSeed, p.neutralSeed]} shape="round" size="xs" />
                  {p.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {palettes.map((p) => (
              <TabsContent className="flex flex-col gap-6 pt-4" key={p.id} value={p.id}>
                <Comparison palette={p} />
              </TabsContent>
            ))}
          </Tabs>
        </SectionBody>
      </SectionRoot>
    </div>
  );
}

function Comparison({ palette: p }: { palette: PaletteView }) {
  const authored = p.authored;
  if (!authored) return null;

  // Slot order is meaning here, so nothing sorts; the split is base16's own — base00 up is the
  // identity's neutral ramp, base08 up its syntax accents. Sources vary in how many they publish
  // (Dracula and the Catppuccins omit base06/base07), which is why the ranges are read, not written.
  const neutrals = authored.slots.filter(([slot]) => slot < "base08");
  const accents = authored.slots.filter(([slot]) => slot >= "base08");

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Authored</CardTitle>
            <CardDescription>
              {authored.slots.length} hexes with documented roles, and not one of them a brand:
              base16 is a syntax-highlighting format and nominates no primary.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <SlotStrip label={`${slotRange(neutrals)} · the neutral ramp, background → ink`} slots={neutrals} />
            <SlotStrip label={`${slotRange(accents)} · syntax accents`} slots={accents} />
            <ItemGroup>
              <Item variant="muted">
                <ItemContent>
                  <ItemTitle>The two seeds, and where they came from</ItemTitle>
                  <ItemDescription className="line-clamp-none">
                    Neutral <code>{p.neutralSeed}</code>
                    <Show when={authored.neutralSlot != null}> ({authored.neutralSlot})</Show>, by a{" "}
                    <strong>rule</strong>{" "}
                    rather than by transcription: base16 orders base00–base05 background → ink, so
                    base03 is the mid-tone of the identity&rsquo;s own neutral ramp. The tint rides
                    along with it, which is why these surfaces are not grey.
                  </ItemDescription>
                  <ItemDescription className="line-clamp-none">
                    Brand <code>{p.brandSeed}</code>
                    <Show when={authored.brandSlot != null}> ({authored.brandSlot})</Show>, by{" "}
                    <strong>designation</strong> — the one value a source states and a ramp cannot
                    infer, so it is read per identity and matched back to a slot here rather than
                    taken from one. Nord names its own: <code>nord.css</code>{" "}
                    calls nord8 the main colour for primary UI elements. Dracula names none at all,
                    and its pink is an ecosystem convention rather than the project&rsquo;s word.
                  </ItemDescription>
                </ItemContent>
              </Item>
            </ItemGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Derived</CardTitle>
            <CardDescription>
              Two ramps of twelve, in both modes. A ramp keeps the seed&rsquo;s hue and gives up its
              mood — which is why a light Dracula is a reading rather than an invention.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {p.ramps
              .filter((ramp) => ramp.name === "brand" || ramp.name === "neutral")
              .map((ramp) => (
                <div className="flex flex-col gap-2" key={ramp.name}>
                  <span className="font-medium text-sm">
                    {ramp.name} · {ramp.hue == null ? "no hue" : `${ramp.hue.toFixed(1)}°`}
                  </span>
                  <div className="flex flex-wrap gap-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground text-xs">Light</span>
                      <RampStrip
                        colors={ramp.light}
                        fill={ramp.name === "brand" ? p.fillStep : undefined}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground text-xs">Dark</span>
                      <RampStrip
                        colors={ramp.dark}
                        fill={ramp.name === "brand" ? p.fillStep : undefined}
                      />
                    </div>
                  </div>
                </div>
              ))}
            <div className="flex flex-col gap-2">
              <span className="font-medium text-sm">
                categorical · {p.categorical.capacity} of 8 slots
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <SwatchGroup colors={p.categorical.light} shape="round" size="lg" />
                <SwatchGroup colors={p.categorical.dark} shape="round" size="lg" />
                <Badge size="sm" variant="secondary">
                  {p.categorical.from}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <Block
        hint="What the identity had to give up to become legal here, itemised by the rule that took it."
        title="The price"
      >
        <ReliefVerdict palette={p} />
        <Show when={p.adjustments.length > 0}>
          <ItemGroup>
            {p.adjustments.map((a, i) => (
              <AdjustmentItem a={a} key={`${a.ramp}-${a.mode}-${a.obligation}-${i}`} />
            ))}
          </ItemGroup>
        </Show>
      </Block>
    </>
  );
}

const slotRange = (slots: [string, string][]) =>
  slots.length ? `${slots[0]?.[0]}–${slots[slots.length - 1]?.[0]}` : "—";

function SlotStrip({ label, slots }: { label: string; slots: [string, string][] }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      <div className="flex flex-wrap gap-2">
        {slots.map(([slot, hex]) => (
          <div className="flex flex-col items-center gap-1" key={slot}>
            <Swatch className="size-8 rounded-md" color={hex} />
            <span className="font-mono text-[10px] text-muted-foreground leading-none">
              {slot.replace("base", "")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
