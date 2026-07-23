# Layout layer — is it "Ark-native"? Reference review + API proposal

Written 2026-07-23. A review-only pass (no code changed) answering one question from the owner:
**should our layout layer be "100% native / idiomatic to Ark UI", and is it?** Every claim below
is grounded in a URL or a `file:line` in this repo, because the previous audits shipped three
findings that turned out to be wrong (`.planning/audit-findings-need-verification`).

Companion docs: `DESIGN.md` ("The layout layer"), `.planning/LAYOUT-DESIGN.md` (the executed spec).
This document **amends** one line of `LAYOUT-DESIGN.md` — see §6.1.

---

## TL;DR

1. **"Idiomatic to Ark" for layout is a category error — and that is the single most important
   finding.** Ark UI ships **no** layout, region, box, flex, grid, stack, app-shell or sidebar
   primitive. It is a behaviour library (Zag.js state machines). The only layout-adjacent thing it
   ships is **`Splitter`** (a resizable-panes machine). So there is no Ark layout to "match". What
   is idiomatic-to-Ark is the **authoring idiom** — Root + named parts + context + `ark.*` +
   `asChild` + `data-slot` — which our Shell parts already follow. The correct *references for
   layout* are the app-shell libraries built on top of headless cores: **shadcn, Mantine, Ant** —
   and the Ark-family libraries (**Park UI, Chakra v3**) confirm the default is "no layout
   components, use flex utilities".
2. **The double-`<main>` is a real bug.** `SidebarInset` (`ark.main`) and `ShellMain` (`ark.main`)
   both render `<main>`; you cannot nest them. Resolution: **`SidebarInset` becomes a neutral
   offset `<div>`; `ShellMain` keeps the landmark.** This is what our own `DESIGN.md` already
   dictates ("a region declares no role"), and it unblocks the composition the owner wants.
3. **"Inset outside, Shell inside" is well-supported** by the references (Ant's Sider + nested
   Layout, shadcn's `SidebarProvider > Sidebar + SidebarInset`). Canonical composition in §5.
4. **The fixed-sidebar-overlaps-header problem is self-inflicted in the workspace showcase** and
   traces to mixing two incompatible models: a *fixed* (shadcn) sidebar under a *full-width* top
   header. References either put the header inside the content column (shadcn/Chakra/Park), offset
   the fixed sidebar by header height (Mantine), or keep the sidebar in-flow (Ant). Fix in §4.3.
5. **`ShellRoot/Body/Header/Footer` earn their keep only weakly** — they are "named flex" in the
   Mantine/Ant lineage, not behavioural primitives. `ShellMain` and `ShellAside` earn theirs
   strongly (landmark discipline + logical-property RTL). §4.4.

---

## 1. How each reference models layout

### 1.1 Ark UI itself — behaviour only, no layout

Ark is "a headless component library that handles behavior and accessibility while leaving styling
entirely to your design system … over 45 components … gives you a solid behavior layer without
imposing visual opinions" ([chakra-ui/ark README](https://github.com/chakra-ui/ark),
[ark-ui.com](https://ark-ui.com/)). Every one of the 45+ components is a *stateful interactive*
primitive (Accordion, Dialog, Splitter, …). There is **no** Box / Flex / Grid / Stack / Container /
AppShell / Sidebar / region primitive.

The one layout-adjacent primitive is **`Splitter`** — a resizable-panes state machine
([ark-ui.com/docs/components/splitter](https://ark-ui.com/docs/components/splitter)):

- Anatomy: **`Root`** (`<div>`), **`Panel`** (`<div>`), **`ResizeTrigger`** (`<button>`),
  **`ResizeTriggerIndicator`** (`<div>`).
- `Root` props: `panels: PanelData[]`, `defaultSize: number[]`, `orientation:
  'horizontal' | 'vertical'` (default horizontal), `keyboardResizeBy`, `onResize*` callbacks.
- Controlled/uncontrolled via `useSplitterContext`.

**Implication:** "make our layout idiomatic to Ark" cannot mean "use Ark's layout components" —
there are none. It can only mean "author our layout parts in Ark's compound idiom" (which we do) and
"lean on `Splitter` for resizing rather than a `resizable` prop" (which we do, `resizable.tsx`).

### 1.2 Park UI (Ark + Panda) — adds no layout primitives

Park UI is "components built with Ark UI and Panda CSS"
([park-ui.com/docs/introduction](https://park-ui.com/docs/introduction)). It ships the styled
**`Splitter`** ([park-ui.com/docs/components/splitter](https://park-ui.com/docs/components/splitter))
but **no app-shell or sidebar component**. Layout is delegated to **Panda CSS's styled-system**
primitives (`Box` / `Flex` / `Grid` / `Stack` / `Container` / `Center`). So the whole Ark+Panda
stack's answer to "how do I build an app shell?" is: **compose flex/grid boxes yourself; the library
gives you Splitter for the one case that needs a state machine.**

### 1.3 Chakra UI v3 (Ark/Zag internally) — layout primitives, no shell abstraction

Chakra v3 ships layout **primitives** — `Box` ("a div on steroids"), `Flex` ("a Box with
display:flex"), `Stack`/`HStack`/`VStack`, `Grid`, `Wrap`, `Center`, `AspectRatio`, `Container`
([chakra-ui.com flex-and-grid](https://chakra-ui.com/docs/styling/style-props/flex-and-grid),
[@chakra-ui/layout](https://www.npmjs.com/package/@chakra-ui/layout)). It has **no** `AppShell` /
`Sidebar` abstraction — an app shell is `Flex`/`Grid` + style props. Same verdict as Park: the
headless-core family leaves app-shell composition to the consumer.

### 1.4 shadcn/ui sidebar — landmark ON the content region, header INSIDE it

shadcn is the model our `sidebar.tsx` is vendored from (confirmed: our file mirrors it 1:1). From
the canonical registry source
([sidebar.tsx](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/sidebar.tsx)):

- **`SidebarProvider`** → a `<div>`, `flex` row, sets `--sidebar-width: 16rem` /
  `--sidebar-width-icon: 3rem` CSS vars.
- **`Sidebar`** (desktop) → two divs: a **`sidebar-gap`** spacer *in flow*
  (`"relative w-(--sidebar-width) bg-transparent transition-[width]…"`) that reserves the gutter,
  plus a **`sidebar-container`** *fixed* overlay
  (`"fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) … md:flex"`).
- **`SidebarInset`** → renders **`<main>`**, `"relative flex w-full flex-1 flex-col bg-background"`
  plus the `inset`-variant margin/rounded/shadow.
- **Canonical usage:** `<SidebarProvider><Sidebar/><SidebarInset><header/>{children}</SidebarInset></SidebarProvider>`
  — **the header lives inside `SidebarInset`**, to the right of the sidebar.

Answers to the three cross-cutting questions:
- **(a) Landmark on the sidebar's content region?** Yes — `SidebarInset` *is* the `<main>`.
- **(b) Overlap prevention?** There is **no full-width header above the sidebar**. The fixed sidebar
  fills the left gutter that the in-flow `sidebar-gap` reserves; the header sits inside the inset,
  so nothing spans across the sidebar to be overlapped.
- **(c) Composition vs config?** Composition of region components, driven by CSS-variable widths and
  `data-*` state selectors — no offset config props.

### 1.5 Mantine `AppShell` — region components + config-driven offsets, landmark on Main

([mantine.dev/core/app-shell](https://mantine.dev/core/app-shell)) Six region parts, each a real
landmark: **`AppShell.Header`** (`<header>`), **`AppShell.Navbar`** (`<nav>`), **`AppShell.Aside`**
(`<aside>`), **`AppShell.Footer`** (`<footer>`), **`AppShell.Main`** (**`<main>`**),
**`AppShell.Section`** (`<div>`, scroll helper). Every region is **fixed-positioned**; overlap is
prevented by **config props on the root** that compute offsets:

- `header={{ height, collapsed?, offset? }}`, `footer={{ height, … }}`
- `navbar={{ width, breakpoint, collapsed?: {desktop?, mobile?} }}`, `aside={{ … }}`
- `padding` on `AppShell` offsets `Main` *and* the sections simultaneously; CSS vars
  `--app-shell-header-height` / `--app-shell-navbar-width` do the arithmetic; the `offset` prop
  controls whether `Main` (or a section) is pushed by a collapsible header.

Answers: **(a)** landmark on `Main` (yes). **(b)** overlap solved by **config-driven offsets** — the
Navbar's top is offset by the header height via CSS var. **(c)** a hybrid: composable region
components whose *sizing/offset* is config props on the root.

### 1.6 Ant Design `Layout` — nested composition, in-flow Sider, auto flex-direction

([ant.design/components/layout](https://ant.design/components/layout)) Parts: `Layout`,
`Layout.Header`, `Layout.Sider`, `Layout.Content`, `Layout.Footer`. Key patterns:

- **Sider + nested Layout** (the exact shape the owner wants):
  ```jsx
  <Layout>
    <Header>header</Header>
    <Layout>                    {/* inner Layout switches to flex-row: hasSider */}
      <Sider>left</Sider>
      <Content>main</Content>
      <Sider>right</Sider>
    </Layout>
    <Footer>footer</Footer>
  </Layout>
  ```
- `Layout` auto-detects a `Sider` child and switches to **horizontal** flex (`hasSider` can be set
  explicitly to avoid SSR flicker).
- `Sider` is **in-flow** flex (not fixed) by default; `width` (default 200), `collapsible`,
  `collapsed`, `breakpoint`.

Answers: **(a)** Ant does not aggressively brand the content region a landmark (it is composition-
first, config-light). **(b)** overlap solved **by construction** — the Sider is in-flow, nested
under the header row, so flow layout keeps them apart. **(c)** pure **composable region components**,
almost no config; the "frame outside, content-shell inside" nesting is first-class.

### 1.7 Synthesis table

| Library | Ships layout parts? | Landmark on content region | Sidebar positioning | Overlap strategy | Model |
|---|---|---|---|---|---|
| Ark UI | No (only Splitter) | n/a | n/a | n/a | behaviour only |
| Park UI | No (Panda Box/Flex) | n/a | n/a | n/a | flex utilities |
| Chakra v3 | Primitives only (Box/Flex/Grid) | n/a | n/a | n/a | flex utilities |
| shadcn | Sidebar family | **`SidebarInset` = `<main>`** | fixed + in-flow gap | header **inside** inset | composition |
| Mantine | `AppShell.*` regions | `AppShell.Main` = `<main>` | fixed | **config offsets** (CSS vars) | regions + config |
| Ant | `Layout.*` regions | config-light | **in-flow** Sider | in-flow + nesting | composition |
| **Kanzo (us)** | `Shell.*` + Sidebar | **both** `ShellMain` **and** `SidebarInset` = `<main>` ⚠ | fixed (shadcn) | **unresolved** | regions + shadcn sidebar |

The last row is the problem: we run **two** region systems (Shell + Sidebar) that each independently
claim the `<main>` landmark and assume a different overlap model. Every one of the four problems
below is a symptom of that.

---

## 2. What "Ark-native" should mean for us

Because Ark abstains from layout, "100% native to Ark" for the layout layer resolves to two concrete
commitments, both already partly met:

1. **Author in Ark's compound idiom** — Root + named parts, `ark.*` factory (so `asChild` works),
   `data-slot` on every part, context only where parts share state. `CONVENTIONS.md` already
   mandates this, and Shell follows it (`shell.tsx` uses `ark.div`/`ark.main`/`ark.aside` +
   `data-slot` throughout).
2. **Behaviour comes from Ark machines, never from props** — resizing is `Splitter`, not a
   `resizable` prop (`DESIGN.md`: "Resizing is composed, not a prop"; `resizable.tsx` wraps
   `ArkSplitter`). Correct today.

Everything else about our layout is **not** an Ark question — it is a shadcn/Mantine/Ant question,
because that is the tier Ark deliberately leaves empty. The owner's instinct ("follow Ark's semantic
architecture") is right, but the target for *layout specifically* is the app-shell libraries, with
Ark supplying only the authoring idiom and the Splitter machine.

---

## 3. Where our code stands (grounded)

- `ShellMain` renders `<main>` — `packages/ui/src/layouts/shell.tsx:102-110`. "Exactly one per
  page … nested containers use `<section>`" (`shell.tsx:96-101`, `DESIGN.md:109`).
- `SidebarInset` renders `<main>` — `packages/ui/src/composites/sidebar.tsx:347-363`. Same landmark.
- The Sidebar desktop container is `fixed inset-y-0 z-10 … h-svh` —
  `packages/ui/src/composites/sidebar.tsx:252-258`, with an in-flow `sidebar-gap` spacer at
  `sidebar.tsx:237-251`. Faithful shadcn port.
- `Sidebar collapsible="none"` renders a plain **in-flow** `ark.aside` — `sidebar.tsx:174-189`
  (this is the only non-fixed sidebar path we ship; it matters for §4.3).
- `ShellRoot` hardcodes the viewport frame `h-dvh min-h-0 flex-col overflow-hidden` —
  `shell.tsx:71-79`.
- `SidebarProvider` is the frame: `flex min-h-svh w-full`, sets `--sidebar-width` —
  `sidebar.tsx:131-152`.
- **App-shell showcase** puts `SidebarProvider` *inside* `ShellBody`, and the header *inside*
  `ShellMain` — `docs/showcases/app-shell/default.tsx:148-205` (`ShellRoot > ShellBody >
  SidebarProvider > Sidebar + ShellMain > ShellHeader`). This is the shadcn model (header inside the
  content column) and it **works**.
- **Workspace showcase** puts `ShellHeader` *full-width above* `ShellBody`, with a *fixed* `Sidebar`
  inside `ShellBody`, and `SidebarProvider className="contents"` dissolving its own box —
  `docs/showcases/workspace/default.tsx:466-483`. This is the combination that overlaps (§4.3).

---

## 4. Verdict on the four problems

### 4.1 Problem 1 — double `<main>`

**Verdict: `SidebarInset` must stop rendering `<main>`. It becomes a neutral offset `<div>`;
`ShellMain` keeps the landmark.**

- shadcn makes `SidebarInset = <main>` because shadcn has **no** separate region vocabulary — the
  inset *is* the content, so it *is* the main. **We are different: we also ship `ShellMain`.** When
  two systems each bake in the landmark, nesting them is a conformance error (two `<main>`).
- Our own doctrine already decides the tie: **"A region declares no role … the call site passes the
  landmark"** (`DESIGN.md:117-118`) and **"Exactly one `<main>` per page. `ShellMain` owns it"**
  (`DESIGN.md:109-110`). `SidebarInset` is a *styling* wrapper (the inset margin/rounded/shadow
  offset) — precisely the kind of thing that should *not* claim a landmark.
- Idiomatic-Ark reinforces it: `ark.div` with `asChild` means a neutral `SidebarInset` can still
  *become* the main when a consumer wants the plain shadcn shape (`<SidebarInset asChild><ShellMain
  …>`), while defaulting to neutral so `SidebarInset > ShellHeader + ShellBody(> ShellMain)`
  composes without conflict.
- **Cost:** a consumer who today uses `SidebarInset` *as* their main must now put a `ShellMain`
  (or `role="main"`) inside it. Acceptable: nothing is published (`0.0.0`), and the two showcases
  are the only call sites in-repo (§3).

Rejected alternative — "keep `SidebarInset = <main>`, forbid `ShellMain` inside it": this makes the
Shell header/body/footer vocabulary unusable inside the content column (you would hand-roll it),
which defeats the point of having a Shell layer and contradicts the owner's desired composition
(§4.2). Reject.

### 4.2 Problem 2 — "Inset outside, Shell inside" vs "Shell wrapping Sidebar"

**Verdict: the references strongly support the owner's preference (frame outside, content-shell
inside). Adopt it as canonical. And note that `SidebarInset` already *is* the content column, so no
inner `ShellRoot` is needed.**

- **Ant** does exactly this (`Sider` + nested `Layout`, §1.6). **shadcn** does exactly this
  (`SidebarProvider > Sidebar + SidebarInset > header + content`, §1.4). So "SidebarProvider as the
  app frame, the content shell inside `SidebarInset`" is the mainstream shape, not an invention.
- Key realisation: **`SidebarInset` is already a `flex-1 flex-col` column** (`sidebar.tsx:352`) — it
  is structurally a `ShellRoot` *minus the viewport frame*. The provider already supplies the
  viewport (`min-h-svh w-full`, `sidebar.tsx:137`). So inside the inset you do **not** nest a second
  `ShellRoot` (its `h-dvh` would double-count the viewport, `shell.tsx:74`); you place
  `ShellHeader` / `ShellBody` / `ShellFooter` **directly** in the inset.
- Corollary finding: **`ShellRoot`'s `h-dvh` is only correct when `ShellRoot` is the outermost
  frame.** Today's app-shell showcase avoids the clash by making `ShellRoot` the outer frame and
  nesting the provider inside it (`app-shell/default.tsx:148`) — the *opposite* nesting order to
  what the owner wants. To flip the order (provider outside), the content column must be the inset,
  not a nested `ShellRoot`. (`tailwind-merge` means `<ShellRoot className="h-full">` would also
  neutralise `h-dvh` if someone insists on nesting it, but the clean answer is: don't.)

### 4.3 Problem 3 — fixed sidebar overlaps a full-width header

**Verdict: this is a live bug in the workspace showcase, caused by pairing a *fixed* sidebar with a
*full-width top header*. The references never pair those two. Fix: either put the header inside the
inset (shadcn), or make the sidebar in-flow (Ant), or offset the fixed sidebar (Mantine).**

The bug, concretely: `workspace/default.tsx:466-483` renders `ShellRoot(h-dvh) > [ShellHeader
full-width, ShellBody > Sidebar(fixed inset-y-0 z-10), ShellFooter]`. The Sidebar's fixed container
starts at **viewport** top (`inset-y-0`, `sidebar.tsx:254`) with `z-10`, so it paints **over** the
static `ShellHeader`'s left ~16rem (the breadcrumb bar). Same for the footer. It looks fine only
because the sidebar's background matches; the header content underneath the sidebar is unreachable.

How the references avoid it:
- **shadcn / Chakra / Park:** no full-width header exists — the header is *inside* the content column
  (right of the sidebar). The fixed sidebar fills the gutter the in-flow gap reserves. (§1.4)
- **Mantine:** the sidebar *is* fixed *and* a full-width header exists — solved by **offsetting the
  Navbar's top by the header height** via `--app-shell-header-height` + the `offset` prop. (§1.5)
- **Ant:** the Sider is **in-flow**, nested under the header row — flow layout, no overlap. (§1.6)

What our API should do:
1. **Canonical (matches our shadcn Sidebar): put the header inside the inset.** This is what the
   app-shell showcase already does and it is correct. Make it *the* documented pattern.
2. **For the IDE / full-bleed look** (workspace: a header *and* footer that span across the sidebar,
   the sidebar sandwiched between them) — this is the **Ant model**, which requires an **in-flow**
   sidebar. We already ship one: `Sidebar collapsible="none"` renders an in-flow `ark.aside`
   (`sidebar.tsx:174-189`), or use `ShellAside` directly. The *fixed* Sidebar (`collapsible="icon"
   | "offcanvas"`) is **incompatible** with a full-width header above it and should not be used
   there. The workspace showcase should switch its rail to an in-flow sidebar (or accept that
   icon-collapse + full-width header needs a Mantine-style top offset, which we do not currently
   ship — see §6.3 for the optional enhancement).

The rule to add to `DESIGN.md`: **a fixed sidebar and a full-width top region are mutually
exclusive; choose the header-inside-inset composition, or an in-flow sidebar.**

### 4.4 Problem 4 — do `ShellRoot/Body/Header/Footer` earn their keep?

**Verdict: `ShellMain` and `ShellAside` earn it strongly; `ShellRoot/Body/Header/Footer` earn it
weakly — they are "named flex" (the Mantine/Ant lineage), not Ark-behavioural primitives. Keep them,
but be honest about what they are, and consider collapsing Header+Footer into one part.**

- **`ShellMain` — keep.** Its whole value is the *landmark discipline* (one `<main>`, `<section>`
  for nested, `shell.tsx:96-110`). That is a real semantic decision worth a named export; none of
  Ark/Park/Chakra give it to you.
- **`ShellAside` — keep.** Encodes logical-property RTL mirroring (`side="start"|"end"`,
  `border-e`/`border-s`), the `overlay` drawer variant, and the `<aside>` complementary landmark
  (`shell.tsx:115-173`). This is genuine, non-trivial, and idiomatic (it mirrors Mantine's
  `AppShell.Aside` and Ant's `Sider` role). The `width` inline-style escape hatch is the sanctioned
  computed-value exception (`CONVENTIONS.md`), correct.
- **`ShellRoot/Body/Header/Footer` — thin.** They are `flex h-dvh flex-col overflow-hidden`,
  `flex flex-1 min-h-0`, `flex flex-col border-b`, `flex flex-col border-t` respectively
  (`shell.tsx:38-93`). Against idiomatic Ark-family layout (Chakra `Flex`, Park/Panda `Flex`) these
  are a `<Flex>` with a border token. Their *actual* value over a raw `<div className="flex flex-col
  border-b border-border">`:
  1. a stable `data-slot` (theming/testing hook),
  2. the `shrink-0` default on bars and `min-h-0` on Root/Body (the flex-overflow footguns),
  3. centralising the **`h-dvh` vs `h-screen`** mobile-URL-bar gotcha in one place
     (`shell.tsx:71-79` — a real, easy-to-get-wrong detail).
  That is modest but non-zero. They are legitimate in the Mantine/Ant sense (named regions), just
  **not** Ark-behavioural — and we should describe them that way rather than implying Ark blessing.
- **Header + Footer differ only by border direction** (`border-b` vs `border-t`, `shell.tsx:41` vs
  `:53`). `LAYOUT-DESIGN.md §2` already decided to collapse the three legacy bars into one
  `ShellBar position="top"|"bottom"`; the same logic collapses `ShellHeader`/`ShellFooter` into one
  region with a `position` variant. Recommended (cuts two near-identical exports to one), but
  optional and orthogonal to the correctness fixes.

---

## 5. Proposed canonical composition

The one composition to document and to build both showcases from: **`SidebarProvider` is the app
frame; the content shell lives inside `SidebarInset` (a neutral `<div>`); `ShellMain` is the sole
`<main>`; a docked aside is the far side of a `Splitter`.**

```tsx
<SidebarProvider>                       {/* app frame: flex row, min-h-svh, --sidebar-width */}
  {/* ── the rail ─────────────────────────────────────────────── */}
  <Sidebar collapsible="icon">
    <SidebarHeader>…workspace switcher…</SidebarHeader>
    <SidebarContent><SidebarNav items={NAV} /></SidebarContent>
    <SidebarFooter><SidebarUser … /></SidebarFooter>
    <SidebarRail />
  </Sidebar>

  {/* ── the content column ───────────────────────────────────── */}
  {/* SidebarInset is now a NEUTRAL <div>: flex-1 flex-col min-w-0. It IS the column,
      so no inner ShellRoot (its h-dvh would double-count the provider's viewport). */}
  <SidebarInset>
    {/* content header — inside the inset, so the fixed rail never overlaps it */}
    <ShellHeader className="h-12 flex-row items-center gap-2 px-3">
      <SidebarTrigger />
      <Breadcrumbs items={[{ label: "Kanzo", href: "#/app" }, { label: "Discover" }]} />
    </ShellHeader>

    {/* the horizontal band: main ⟷ docked aside, drag-resizable via Ark Splitter */}
    <ShellBody>
      <Resizable
        className="min-h-0"
        defaultSize={[72, 28]}
        panels={[{ id: "main", minSize: 40 }, { id: "dock", minSize: 18 }]}
      >
        {/* asChild fuses the panel and the region — no wrapper div, the panel carries
            the id/data-* and ShellMain carries the <main> + overflow. */}
        <ResizablePanel id="main" asChild>
          <ShellMain className="relative bg-background">…canvas / page…</ShellMain>
        </ResizablePanel>

        <ResizableResizeTrigger id="main:dock" withHandle />

        <ResizablePanel id="dock" asChild>
          <ShellAside side="end" aria-label="Inspector" className="border-s-0">
            …inspector panel…
          </ShellAside>
        </ResizablePanel>
      </Resizable>
    </ShellBody>

    {/* content footer / status bar — also inside the inset */}
    <ShellFooter className="h-7 flex-row items-center justify-between px-3">
      <span className="text-muted-foreground text-xs">5,021 nodes · 4,997 edges</span>
      <div>…panel toggles…</div>
    </ShellFooter>
  </SidebarInset>
</SidebarProvider>
```

Why this is the right skeleton:
- **One `<main>`** — only `ShellMain` (§4.1). `SidebarInset` is neutral (`<div>`).
- **Frame outside, shell inside** — the owner's order, backed by Ant + shadcn (§4.2).
- **No overlap** — the header/footer are *inside* the inset, right of the rail; the fixed sidebar
  fills its own gutter (§4.3). If a product genuinely needs header/footer to span *across* the rail
  (IDE look), switch `Sidebar` to `collapsible="none"` (in-flow) — the fixed rail is not used with a
  spanning header.
- **Resizing is composed** — the dock is a `Splitter` panel, drag + keyboard + ARIA from the machine
  (`DESIGN.md`, `resizable.tsx`). `asChild` on `ResizablePanel` removes the extra wrapper `<div>` the
  current workspace showcase carries (`workspace/default.tsx:544-586`) — verify `Splitter.Panel`
  forwards `asChild` (Ark's factory parts generally do); if a panel needs a measured box, keep the
  wrapper as a fallback.
- **No inner `ShellRoot`** — the inset is the column; `ShellRoot`'s `h-dvh` frame is reserved for the
  *standalone* Shell case (a shell with no sidebar), where `ShellRoot` is the outermost element.

Two supported shells, stated plainly:

| Shape | Root | Header/footer position | Sidebar |
|---|---|---|---|
| **Sidebar app shell** (above) | `SidebarProvider` | inside `SidebarInset` | fixed (`icon`/`offcanvas`) |
| **IDE / full-bleed shell** (workspace) | `ShellRoot` | full-width, spanning | **in-flow** (`ShellAside`, or `Sidebar collapsible="none"`) |
| **Standalone shell** (no rail) | `ShellRoot` | inside | none |

---

## 6. Minimal changes this implies

### 6.1 Code (one required change)

1. **`SidebarInset`: `ark.main` → `ark.div`** (`packages/ui/src/composites/sidebar.tsx:347-363`).
   Keep every class (the `inset`-variant offset is its whole job); add `min-w-0` so a `ShellBody`
   inside can scroll horizontally. This is the fix for Problems 1 and 2.
   - **Amends `LAYOUT-DESIGN.md:172` ("Sidebar stays as it is").** That line predates the
     double-`<main>` analysis; the change is scoped strictly to `SidebarInset`'s *landmark* — the
     Sidebar rail, its context, and every other part are untouched. The amendment is required
     because a design doc cannot bless a two-`<main>` conformance error.

That is the only code change the correctness story *requires*. Everything else is docs + showcases +
optional consolidation.

### 6.2 Showcases

2. **Workspace showcase** (`docs/showcases/workspace/default.tsx:466-483`) — fix the overlap. Two
   options: (a) switch the rail to an in-flow sidebar (`Sidebar collapsible="none"`, or a
   `ShellAside`) so the full-width header/footer legitimately span across it (the IDE model); or
   (b) move the header/footer inside the content column and keep the fixed rail. (a) preserves the
   IDE look; pick it. Also collapse the `ResizablePanel > ShellAside` double-wrap to `asChild`
   (`workspace/default.tsx:544-586`).
3. **App-shell showcase** (`docs/showcases/app-shell/default.tsx`) — re-point to the §5 canonical
   order (`SidebarProvider` outside, `SidebarInset` the column, `ShellMain` inside). It is already
   overlap-free; this is alignment, not a bug fix. Note `SidebarInset` now needs a `ShellMain`
   inside it to carry the landmark (previously the inset was the `<main>`).

### 6.3 Docs (`DESIGN.md`)

4. Add to "The layout layer": **"Ark ships no layout — the reference for our layout is
   shadcn/Mantine/Ant; Ark supplies the authoring idiom and the Splitter machine."** (§2)
5. Add the rule: **"A fixed sidebar and a full-width top/bottom region are mutually exclusive."**
   (§4.3)
6. Add: **"`SidebarInset` is a neutral offset container; the landmark is `ShellMain` inside it."**
   Reconcile with the existing "one `<main>`, `ShellMain` owns it" line (`DESIGN.md:109`).
7. Note that **`ShellRoot`'s `h-dvh` is the standalone-frame case**; inside a `SidebarProvider`, the
   inset is the column and you do not nest a `ShellRoot`.

### 6.4 Optional (consolidation / enhancement, not required)

8. Collapse `ShellHeader` + `ShellFooter` into one `ShellBar position="top"|"bottom"` — same logic
   `LAYOUT-DESIGN.md §2` already applied to the three legacy bars (§4.4). Cuts two near-identical
   exports to one.
9. If icon-collapse *and* a spanning full-width header is a real product requirement, add a
   **Mantine-style top offset** to the fixed Sidebar (offset `inset-block-start` by a
   `--shell-header-height` CSS var instead of `inset-y-0`, `sidebar.tsx:254`). Only build this on
   proven demand — the in-flow sidebar already covers the IDE look.

---

## 7. One-line answer for the owner

Our layout is *already* idiomatic in the only sense Ark defines (compound parts, `ark.*`,
`data-slot`, Splitter-for-resize) — because **Ark has no layout to be un-idiomatic against**. The
real incoherence is that we run **two** region systems (Shell + the shadcn Sidebar) that both claim
`<main>` and assume different overlap models. Make `SidebarInset` a neutral `<div>` (one code line),
let `ShellMain` own the landmark, adopt "provider outside / shell inside the inset" as canonical, and
keep fixed-sidebars and full-width-headers from mixing. That resolves all four problems and leaves
the layer genuinely Ark-native *and* shadcn/Mantine/Ant-consistent.
