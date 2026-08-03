"use client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Clipboard,
  ClipboardControl,
  ClipboardLabel,
  ClipboardTrigger,
  Field,
  FieldLabel,
  Input,
  InputGroup,
  InputGroupAddon,
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
  Spinner,
  Show,
  Swatch,
  SwatchGroup,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@kanzo-tech/ui";
import { CheckCheckIcon } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { deriveSeeds } from "./derive-action";
import type { PaletteView } from "./derive";
import { AdjustmentItem, Block, ColorChip, RampRow, ReliefVerdict, hueSource } from "./parts";

/**
 * The onboarding screen for a tenant palette: two seeds in, a measured document out.
 *
 * Every number here comes from a real `derivePalette` run on the server — see `derive.ts`. Nothing
 * on this page is illustrative.
 */
export function PaletteOnboarding({ palettes }: { palettes: PaletteView[] }) {
  const [custom, setCustom] = useState<PaletteView | null>(null);
  const [tab, setTab] = useState(palettes[0]?.id ?? "");
  const shown = custom ? [...palettes, custom] : palettes;

  return (
    <div className="min-h-svh bg-background p-8">
      <SectionRoot>
        <SectionHeader scale="page">
          <SectionTitleGroup>
            <SectionTitle level={1} scale="page">
              Palette onboarding
            </SectionTitle>
            <SectionDescription>
              A client gives two seeds — a brand colour and a neutral. Everything below is derived
              from that pair once, measured against the tenant&rsquo;s own surfaces, and stored as a
              document. Runtime only applies it.
            </SectionDescription>
          </SectionTitleGroup>
        </SectionHeader>

        <SectionBody scale="page">
          <SeedForm
            onDerived={(palette) => {
              setCustom(palette);
              // The derived id is slugged from the name, so it is read off the result rather than
              // assumed — a fixed `"custom"` here would leave the new tab unselected the moment the
              // action started naming what it returns.
              setTab(palette.id);
            }}
          />

          <Tabs onValueChange={(d) => setTab(d.value)} value={tab}>
            <TabsList variant="underline">
              {shown.map((p) => (
                <TabsTrigger key={p.id} value={p.id}>
                  <SwatchGroup colors={[p.brandSeed, p.neutralSeed]} shape="round" size="xs" />
                  {p.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {shown.map((p) => (
              <TabsContent className="flex flex-col gap-8 pt-4" key={p.id} value={p.id}>
                <Tenant palette={p} />
              </TabsContent>
            ))}
          </Tabs>
        </SectionBody>
      </SectionRoot>
    </div>
  );
}

/**
 * Two seeds in, a measured document out — the claim this page makes, made exercisable.
 *
 * The five palettes beside it are derived at build time and this one on submit, through the same
 * `viewOf`. Deriving in the browser is not an option and not a limitation to route around: the
 * search costs 0.2–1.6 s and `@kanzo-tech/palette` is kept out of the client graph on purpose, so
 * the action runs on the server and this half only ever sees the projection.
 */
function SeedForm({ onDerived }: { onDerived: (palette: PaletteView) => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [seeds, setSeeds] = useState({ label: "", brand: "#2b7fff", neutral: "#6b7280" });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    start(async () => {
      const result = await deriveSeeds(seeds);
      if (result.ok) onDerived(result.palette);
      else setError(result.message);
    });
  };

  return (
    <form className="flex flex-col gap-3" onSubmit={submit}>
      <div className="flex flex-wrap items-end gap-3">
        <SeedInput
          label="Brand"
          onChange={(brand) => setSeeds((s) => ({ ...s, brand }))}
          value={seeds.brand}
        />
        <SeedInput
          label="Neutral"
          onChange={(neutral) => setSeeds((s) => ({ ...s, neutral }))}
          value={seeds.neutral}
        />
        <Field className="w-48">
          <FieldLabel htmlFor="seed-label">Name</FieldLabel>
          <Input
            id="seed-label"
            onChange={(e) => setSeeds((s) => ({ ...s, label: e.target.value }))}
            placeholder="Your palette"
            value={seeds.label}
          />
        </Field>
        <Button disabled={pending} type="submit">
          <Show fallback="Derive" when={pending}>
            <Spinner />
            Deriving…
          </Show>
        </Button>
      </div>
      <Show when={error !== null}>
        <Alert variant="destructive">
          <AlertTitle>That pair cannot be derived</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </Show>
    </form>
  );
}

// A text field and not a `ColorPicker`: the input IS a hex string, the swatch depicts it, and the
// picker's `parseColor("")` throws on a half-typed value — the exact keystroke this field expects.
function SeedInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = `seed-${label.toLowerCase()}`;
  return (
    <Field className="w-44">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup>
        <InputGroupAddon>
          <Swatch
            className="size-4 rounded"
            color={/^#[0-9a-f]{6}$/i.test(value) ? value : "transparent"}
          />
        </InputGroupAddon>
        <Input
          aria-label={`${label} seed, hex`}
          className="font-mono"
          id={id}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          value={value}
        />
      </InputGroup>
    </Field>
  );
}

function Tenant({ palette: p }: { palette: PaletteView }) {
  return (
    <>
      <Block
        hint={
          <>
            The neutral supplies the tint hue; the brand hue is the fallback when none is given. The
            four status families are Kanzo&rsquo;s and are not client-overridable — but they are
            re-measured here, because every obligation is graded against the surface and the surface
            is this tenant&rsquo;s.
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

      <Show when={p.authored !== null}>
        <Block
          hint="A base16 palette is not a second shape here — it is a brand hue and a neutral hue, through the same derivation a client goes through. What its authors wrote, and what this system makes of it."
          title="Authored, and derived"
        >
          <ItemGroup className="grid gap-3 sm:grid-cols-2">
            <Item variant="outline">
              <ItemContent>
                <ItemTitle>
                  Brand
                  <code className="font-mono text-muted-foreground text-xs">
                    {p.authored?.brandSlot ?? "—"}
                  </code>
                </ItemTitle>
                <ItemDescription className="line-clamp-none">
                  <ColorChip color={p.brandSeed} /> authored, <ColorChip color={p.primary.light} />{" "}
                  derived. Same hue, different place: a fill has to read as a shape, and the band
                  that guarantees that is what moves it.
                </ItemDescription>
              </ItemContent>
            </Item>
            <Item variant="outline">
              <ItemContent>
                <ItemTitle>
                  Neutral
                  <code className="font-mono text-muted-foreground text-xs">
                    {p.authored?.neutralSlot ?? "—"}
                  </code>
                </ItemTitle>
                <ItemDescription className="line-clamp-none">
                  <ColorChip color={p.neutralSeed} /> is base03 by the <strong>rule</strong> and not
                  by transcription — base16 orders base00–base05 background → ink, so base03 is the
                  mid-tone of its own neutral ramp. Its tint is why these surfaces are not grey.
                </ItemDescription>
              </ItemContent>
            </Item>
          </ItemGroup>
        </Block>
      </Show>

      <Block
        hint="A failing gate adjusts and publishes what moved; the one it cannot adjust is published as relief."
        title="The record"
      >
        <ReliefVerdict palette={p} />
        <Show
          fallback={
            <Item className="flex-col text-center">
              <ItemMedia className="text-muted-foreground">
                <CheckCheckIcon className="size-8" />
              </ItemMedia>
              <ItemContent className="items-center">
                <ItemTitle>Nothing moved</ItemTitle>
                <ItemDescription className="line-clamp-none max-w-[420px] text-center">
                  Every step of all six ramps met its obligation as generated. {p.label} needed no
                  repair.
                </ItemDescription>
              </ItemContent>
            </Item>
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
        hint="Twelve steps per mode. 1 is the page, 3/4/5 are one component's normal / hover / active surface, 6 is the border, 9 is the solid, 11 and 12 are ink. The bold number is where this tenant's brand fill comes from."
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
        {/* Two artefacts, and the smaller one is the source. The stylesheet is what a page loads;
            the seed pair is what the system INGESTS, so copying it back into `derivePalette`
            reproduces this document byte for byte. A generator whose output is not its own input
            leaves the loop open — which is what copying CSS alone did. */}
        <Clipboard timeout={1200} value={seedSnippet(p)}>
          <ClipboardControl>
            <ClipboardLabel>derivePalette(input) — the two seeds, and everything above follows</ClipboardLabel>
            <ClipboardTrigger aria-label={`Copy the ${p.label} seed input`} />
          </ClipboardControl>
        </Clipboard>
        <pre className="overflow-auto rounded-xl border border-border bg-muted/48 p-3 font-mono text-xs">
          {seedSnippet(p)}
        </pre>

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

/**
 * The input that produced this document, in the shape `derivePalette` takes.
 *
 * `identities` is an array of one because that is the only shape there is — a document with a single
 * brand is a one-element list, not a different call. A second brand is one more entry, and the
 * derivation refuses a multi-identity tenant without an explicit neutral, which is why the neutral is
 * written here rather than left to the brand-hue fallback.
 */
function seedSnippet(p: PaletteView): string {
  return `derivePalette({
  id: ${JSON.stringify(p.id)},
  label: ${JSON.stringify(p.label)},
  neutral: ${JSON.stringify(p.neutralSeed)},
  identities: [{ id: ${JSON.stringify(p.id)}, label: ${JSON.stringify(p.label)}, brand: ${JSON.stringify(p.brandSeed)} }],
});`;
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
