import { useEffect, useMemo, useState, type ComponentProps } from "react";
import {
  ActionBar,
  ActionBarClose,
  ActionBarContent,
  ActionBarSeparator,
  ActionBarValue,
  Alert,
  AlertDescription,
  AlertTitle,
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardMedia,
  CardRadioGroup,
  CardTitle,
  Checkbox,
  ComingSoon,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  cn,
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  Command,
  CommandContent,
  CommandDialog,
  CommandDialogContent,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
  createListCollection,
  DateField,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTrigger,
  Field,
  FieldArray,
  FieldDescription,
  FieldLabel,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  Kbd,
  MadeWithKanzo,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  SectionHeader,
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
  RadioGroup,
  RadioGroupItem,
  SegmentGroup,
  SegmentGroupItem,
  SecretField,
  SegmentGroupItemText,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarNav,
  type SidebarNavItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  Skeleton,
  Slider,
  Spinner,
  StatCard,
  StatusBar,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Toolbar,
  toast,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  Tour,
  TourActions,
  TourContent,
  TourDescription,
  TourHeader,
  TourProgressText,
  TourTitle,
  TourTrigger,
  TreeView,
  TreeViewBranch,
  TreeViewBranchContent,
  TreeViewBranchItem,
  TreeViewContent,
  TreeViewItem,
  TreeViewNode,
  TreeViewTree,
  createTreeCollection,
  useFilter,
  useListCollection,
  type TourStepType,
} from "@kanzo-tech/ui";
import { EditorShell } from "@kanzo-tech/ui/editor";
import { type ColumnDef, DataTable, sortableHeader } from "@kanzo-tech/ui/table";
import { json } from "@codemirror/lang-json";
import {
  Bot as BotIcon,
  Compass as CompassIcon,
  FormInput as FormInputIcon,
  Layers as LayersIcon,
  LayoutTemplate as LayoutIcon,
  PanelsTopLeft as PanelsIcon,
  Sparkles as SparklesIcon,
  Square as SquareIcon,
  Table2 as TableIcon,
  Cloud as CloudIcon,
  Code as CodeIcon,
  X as Cross2Icon,
  Database as DatabaseIcon,
  MoreHorizontal as DotsHorizontalIcon,
  TriangleAlert as ExclamationTriangleIcon,
  FileText as FileTextIcon,
  Settings as GearIcon,
  Wand2 as WandIcon,
  Heart as HeartIcon,
  Image as ImageIcon,
  List as ListBulletIcon,
  Search as MagnifyingGlassIcon,
  Pencil as Pencil1Icon,
  Plus as PlusIcon,
  Trash2 as TrashIcon,
} from "lucide-react";

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** A subsection divider that mirrors a sidebar group — the page reads in the same blocks. */
function GroupHeader({ id, title, blurb }: { id: string; title: string; blurb: string }) {
  return (
    <div className="scroll-mt-6 space-y-1 pt-6" id={id}>
      <Separator className="mb-6" />
      <h2 className="font-semibold text-2xl tracking-tight">{title}</h2>
      <p className="max-w-xl text-muted-foreground text-sm">{blurb}</p>
    </div>
  );
}

/** A read-only source snippet, shown under the Code tab. */
function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="kz-preview overflow-x-auto rounded-xl border border-border p-4 text-[13px] leading-relaxed">
      <code className="font-mono text-foreground">{code}</code>
    </pre>
  );
}

/**
 * A gallery section, styled after shadcn/Radix/Ark docs: a real heading with a hover
 * anchor, an optional description, and the demo on a bordered "preview canvas" (dotted
 * surface, generous padding). With `code`, a Preview / Code tab pair sits above it — the
 * exact affordance those docs sites use.
 */
function Section({
  title,
  nav,
  group,
  description,
  code,
  children,
  /** Center the demo horizontally — right for atoms (a button, a badge). */
  center = false,
  /** Skip the preview canvas — for demos that already provide their own full container. */
  bare = false,
}: {
  title: string;
  nav: string;
  group: string;
  description?: React.ReactNode;
  code?: string;
  children: React.ReactNode;
  center?: boolean;
  bare?: boolean;
}) {
  const id = slugify(title);

  const canvas = bare ? (
    children
  ) : (
    <div
      className={cn(
        "kz-preview relative overflow-hidden rounded-xl border border-border p-6 sm:p-10",
        center && "flex flex-wrap items-center justify-center gap-3",
      )}
    >
      {children}
    </div>
  );

  return (
    <section
      id={id}
      data-section-title={title}
      data-nav-label={nav}
      data-nav-group={group}
      className="scroll-mt-6 space-y-4"
    >
      <div className="space-y-1">
        <h3 className="group/anchor flex items-center gap-2 font-semibold text-foreground text-lg tracking-tight">
          {title}
          <a
            href={`#${id}`}
            aria-label={`Link to ${title}`}
            className="text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/anchor:opacity-100"
          >
            #
          </a>
        </h3>
        {description != null && (
          <p className="text-muted-foreground text-sm">{description}</p>
        )}
      </div>

      {code ? (
        <Tabs defaultValue="preview">
          <TabsList>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="code">Code</TabsTrigger>
          </TabsList>
          <TabsContent value="preview">{canvas}</TabsContent>
          <TabsContent value="code">
            <CodeBlock code={code} />
          </TabsContent>
        </Tabs>
      ) : (
        canvas
      )}
    </section>
  );
}

/**
 * Showcase nav — a sticky index built from the sections themselves (no duplicate list to
 * drift), with scroll-spy highlighting via IntersectionObserver.
 *
 * Built on our own `Sidebar`: a design system whose own gallery navigates with hand-rolled
 * markup is not eating its own cooking, and this is the longest-lived nav in the repo —
 * exactly the surface that should surface the component's rough edges first.
 */
// Icon per parent group — the collapsed (icon-only) rail needs one glyph per top entry.
const GROUP_ICON: Record<string, React.ReactNode> = {
  Buttons: <SquareIcon />,
  "New in this branch": <SparklesIcon />,
  Forms: <FormInputIcon />,
  Surfaces: <LayersIcon />,
  Overlays: <LayoutIcon />,
  Data: <TableIcon />,
  Navigation: <CompassIcon />,
  Shells: <PanelsIcon />,
};

function GallerySidebar() {
  const [items, setItems] = useState<SidebarNavItem[]>([]);
  const [active, setActive] = useState("");

  useEffect(() => {
    const els = Array.from(
      document.querySelectorAll<HTMLElement>("[data-section-title]"),
    );
    // Build parent → children in document order, so the sidebar's structure IS the page's
    // structure and can never present a shape the page does not have.
    const order: string[] = [];
    const byGroup = new Map<string, { title: string; href: string }[]>();
    for (const el of els) {
      const group = el.dataset.navGroup ?? "Other";
      const child = {
        title: el.dataset.navLabel ?? el.dataset.sectionTitle ?? "",
        href: `#${el.id}`,
      };
      const list = byGroup.get(group);
      if (list) list.push(child);
      else {
        byGroup.set(group, [child]);
        order.push(group);
      }
    }
    setItems(
      order.map((group) => ({
        title: group,
        icon: GROUP_ICON[group],
        items: byGroup.get(group),
      })),
    );

    const obs = new IntersectionObserver(
      (entries) => {
        const seen = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (seen[0]) setActive(seen[0].target.id);
      },
      { rootMargin: "0px 0px -72% 0px", threshold: 0 },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  // Mark the active child (and, through SidebarNav, auto-open its parent group).
  const withActive = useMemo<SidebarNavItem[]>(
    () =>
      items.map((parent) => {
        const kids =
          parent.items?.map((c) => ({ ...c, isActive: c.href === `#${active}` })) ??
          [];
        return { ...parent, items: kids, isActive: kids.some((c) => c.isActive) };
      }),
    [items, active],
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-1">
          <SidebarTrigger />
          <span className="font-semibold text-sm group-data-[collapsible=icon]:hidden">
            Kanzo UI
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {/* Dogfoods our own SidebarNav: parent groups with collapsible children — the
            exact composite keasy will consume. */}
        <SidebarNav items={withActive} />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}

// ── New components — self-contained demos so each owns its own state ──────────────

function StatCardsDemo() {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 1600);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          description="accounts configured"
          href="#stat-cards-kpi-tiles"
          icon={<CloudIcon />}
          label="Cloud Accounts"
          loading={loading}
          status="success"
          value="3"
        />
        <StatCard
          description="connections configured"
          href="#stat-cards-kpi-tiles"
          icon={<DatabaseIcon />}
          label="Connections"
          loading={loading}
          status="warning"
          value="0"
        />
        <StatCard
          description="last run failed"
          href="#stat-cards-kpi-tiles"
          icon={<ExclamationTriangleIcon />}
          label="Jobs"
          loading={loading}
          status="danger"
          value="12"
        />
        <StatCard
          description="no href — a plain, inert surface"
          icon={<FileTextIcon />}
          label="DCAT Catalogs"
          loading={loading}
          value="7"
        />
      </div>
      <Button onClick={() => setLoading((v) => !v)} size="sm" variant="outline">
        Toggle loading
      </Button>
    </div>
  );
}

function CardRadioDemo() {
  const [provider, setProvider] = useState("openai");
  const [mode, setMode] = useState("studio");
  const [font, setFont] = useState("geist");
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">
          Vertical · icon · badge — no longer coupled to <code>disabled</code>
        </p>
        <CardRadioGroup
          onValueChange={setProvider}
          options={[
            { value: "openai", label: "OpenAI", icon: <BotIcon /> },
            {
              value: "anthropic",
              label: "Anthropic",
              icon: <WandIcon />,
              badge: "Recommended",
            },
            {
              value: "mistral",
              label: "Mistral",
              icon: <CodeIcon />,
              badge: "Configured",
              disabled: true,
            },
          ]}
          value={provider}
        />
      </div>

      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">
          Horizontal · description · indicator — the layout that was hand-rolled twice
        </p>
        <CardRadioGroup
          columns={2}
          onValueChange={setMode}
          options={[
            {
              value: "studio",
              label: "Studio",
              description: "Write the mapping yourself, in the editor.",
              icon: <CodeIcon />,
            },
            {
              value: "assistant",
              label: "Assistant",
              description: "Describe the result and let the assistant draft it.",
              icon: <WandIcon />,
            },
          ]}
          orientation="horizontal"
          showIndicator
          value={mode}
        />
      </div>

      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">
          Arbitrary <code>preview</code> node — collapses three preview props into one
        </p>
        <CardRadioGroup
          columns={3}
          onValueChange={setFont}
          options={[
            { value: "geist", label: "Geist", preview: <span className="text-2xl">Aa</span> },
            { value: "inter", label: "Inter", preview: <span className="text-2xl">Aa</span> },
            { value: "system", label: "System", preview: <span className="text-2xl">Aa</span> },
          ]}
          value={font}
        />
      </div>
    </div>
  );
}

function SecretFieldDemo() {
  const [fresh, setFresh] = useState("");
  const [stored, setStored] = useState("");
  return (
    <div className="grid max-w-xl gap-4">
      <Field>
        <FieldLabel>API key — new account</FieldLabel>
        <SecretField
          ignorePasswordManagers
          onValueChange={setFresh}
          placeholder="Enter your Anthropic API key"
          value={fresh}
        />
        <FieldDescription>
          An API key is not a password, so password managers are kept out of it.
        </FieldDescription>
      </Field>

      <Field>
        <FieldLabel>API key — editing an existing account</FieldLabel>
        <SecretField hasStoredValue onValueChange={setStored} value={stored} />
        <FieldDescription>
          The stored secret never reaches the client: the field renders empty, and the hint
          disappears the moment you type.
        </FieldDescription>
      </Field>

      <Field invalid>
        <FieldLabel>Invalid · reveal toggle off</FieldLabel>
        <SecretField invalid revealable={false} value="hunter2" />
      </Field>
    </div>
  );
}

function FieldArrayDemo() {
  const [values, setValues] = useState<string[]>(["dcat:Dataset", ""]);
  const MAX = 4;
  return (
    <div className="max-w-xl space-y-2">
      <FieldArray
        canAdd={values.length < MAX}
        canRemove={values.length > 1}
        count={values.length}
        onAdd={() => setValues((v) => [...v, ""])}
        onRemove={(i) => setValues((v) => v.filter((_, j) => j !== i))}
        rowKey={(i) => `keyword#${i}`}
      >
        {(i) => (
          <Input
            onChange={(e) =>
              setValues((v) => v.map((x, j) => (j === i ? e.target.value : x)))
            }
            placeholder="Keyword"
            value={values[i] ?? ""}
          />
        )}
      </FieldArray>
      <p className="text-muted-foreground text-xs">
        {values.length}/{MAX} rows — “Add” hides at the maximum; the last remaining row
        keeps its ✕ hidden.
      </p>
    </div>
  );
}

function ComingSoonDemo() {
  return (
    <div className="grid max-w-xl gap-4">
      <ComingSoon>
        <div className="flex items-center gap-3 rounded-lg border border-border p-3">
          <GearIcon className="size-4 text-muted-foreground" />
          <div>
            <p className="font-medium text-sm">Scheduled runs</p>
            <p className="text-muted-foreground text-xs">Run this job on a cron.</p>
          </div>
        </div>
      </ComingSoon>

      <div className="w-56">
        <ComingSoon placement="corner">
          <Button className="w-full" variant="outline">
            Local upload
          </Button>
        </ComingSoon>
      </div>

      <p className="text-muted-foreground text-xs">
        Tab through this section: the wrapped content is inert, so it never takes focus.
      </p>
    </div>
  );
}

interface Row {
  name: string;
  team: string;
  rows: number;
  status: "ready" | "syncing" | "failed";
}

const DT_ROWS: Row[] = [
  { name: "aemet-observations", team: "Weather", rows: 1_204_882, status: "ready" },
  { name: "ine-census-2021", team: "Public", rows: 830_517, status: "ready" },
  { name: "geonames-places", team: "Geo", rows: 11_002_450, status: "ready" },
  { name: "who-indicators", team: "Health", rows: 74_600, status: "syncing" },
  { name: "legacy-oracle-dump", team: "Internal", rows: 0, status: "failed" },
  { name: "worldbank-gdp", team: "Public", rows: 33_915, status: "ready" },
  { name: "spotify-charts", team: "Culture", rows: 640_120, status: "syncing" },
  { name: "eurostat-nuts", team: "Geo", rows: 156_240, status: "ready" },
];

const dtNum = new Intl.NumberFormat("en-US");
const DT_STATUS = { ready: "success", syncing: "info", failed: "destructive" } as const;

function DataTableDemo() {
  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      {
        accessorKey: "name",
        header: sortableHeader("Dataset"),
        cell: ({ getValue }) => (
          <span className="font-medium">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: "team",
        header: sortableHeader("Team"),
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: "rows",
        header: sortableHeader("Rows"),
        cell: ({ getValue }) => (
          <span className="block text-right font-mono text-muted-foreground text-xs tabular-nums">
            {dtNum.format(getValue<number>())}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => {
          const s = getValue<Row["status"]>();
          return (
            <Badge size="sm" variant={DT_STATUS[s]}>
              {s}
            </Badge>
          );
        },
      },
    ],
    [],
  );

  return (
    <div className="space-y-2">
      <DataTable
        columns={columns}
        data={DT_ROWS}
        onRowClick={(r) => toast.create({ title: r.name, type: "info" })}
        pageSize={5}
        searchKey="name"
        searchPlaceholder="Search datasets…"
      />
      <p className="text-muted-foreground text-xs">
        <code>@kanzo-tech/ui/table</code> — TanStack Table under the chrome. Sort by any
        header, filter by name, paginate. The dependency is an <em>optional peer</em> in a
        subpath, so the base bundle never pays for it.
      </p>
    </div>
  );
}

// ── Static collections (Ark needs a `collection`, built with createListCollection) ──
const visibilityCollection = createListCollection({
  items: [
    { label: "Public", value: "public" },
    { label: "Private", value: "private" },
    { label: "Restricted", value: "restricted" },
  ],
});

const ALL_DATASETS = [
  { label: "customers", value: "customers" },
  { label: "orders", value: "orders" },
  { label: "products", value: "products" },
  { label: "suppliers", value: "suppliers" },
  { label: "invoices", value: "invoices" },
  { label: "shipments", value: "shipments" },
];

// ── Tour steps: intro modal + two tooltips targeting elements by id ─────────────
const tourSteps: TourStepType[] = [
  {
    id: "intro",
    type: "dialog",
    title: "Welcome to the editor",
    description: "A quick three-step tour of the dataset tools in this section.",
    actions: [{ label: "Start", action: "next" }],
  },
  {
    id: "name",
    type: "tooltip",
    target: () => document.getElementById("tour-name"),
    title: "Name your dataset",
    description: "Give the dataset a short, unique name — it becomes the graph id.",
    actions: [
      { label: "Back", action: "prev" },
      { label: "Next", action: "next" },
    ],
  },
  {
    id: "save",
    type: "tooltip",
    target: () => document.getElementById("tour-save"),
    title: "Save your work",
    description: "Persist the changes. That's the whole tour!",
    actions: [
      { label: "Back", action: "prev" },
      { label: "Done", action: "dismiss" },
    ],
  },
];

const SAMPLE_TTL = `@prefix ex: <http://example.org/> .
@prefix schema: <http://schema.org/> .

ex:customers a schema:Dataset ;
  schema:name "Customers" ;
  schema:variableMeasured "1204 triples" .`;

const SAMPLE_JSON = `{
  "dataset": "customers.ttl",
  "triples": 1204,
  "mapped": true,
  "shapes": ["Customer", "Address"],
  "lastRun": null,
  "score": 0.98
}`;

const SHAPE_TREE = {
  id: "ROOT",
  name: "",
  children: [
    {
      id: "customers",
      name: "customers.ttl",
      children: [
        {
          id: "CustomerShape",
          name: "CustomerShape",
          children: [
            { id: "c-name", name: "schema:name" },
            { id: "c-email", name: "schema:email" },
            {
              id: "c-address",
              name: "schema:address",
              children: [{ id: "AddressShape", name: "AddressShape" }],
            },
          ],
        },
      ],
    },
    {
      id: "orders",
      name: "orders.ttl",
      children: [{ id: "OrderShape", name: "OrderShape" }],
    },
  ],
};

// Recursive node renderer — the canonical Shark TreeView composition (branch vs leaf).
const ShapeNode = (props: ComponentProps<typeof TreeViewNode>) => {
  const { node, indexPath } = props;
  return (
    <TreeViewNode indexPath={indexPath} node={node}>
      {node.children ? (
        <TreeViewBranch>
          <TreeViewBranchItem>{node.name}</TreeViewBranchItem>
          <TreeViewBranchContent>
            {node.children.map((child, index) => (
              <ShapeNode indexPath={[...indexPath, index]} key={child.id} node={child} />
            ))}
          </TreeViewBranchContent>
        </TreeViewBranch>
      ) : (
        <TreeViewContent>
          <TreeViewItem>{node.name}</TreeViewItem>
        </TreeViewContent>
      )}
    </TreeViewNode>
  );
};

const COMMANDS = [
  { label: "New dataset", value: "new-dataset", group: "Actions", shortcut: "⌘N" },
  { label: "Search datasets", value: "search", group: "Actions", shortcut: "⌘F" },
  { label: "Import from URL", value: "import", group: "Actions" },
  { label: "Toggle theme", value: "theme", group: "Preferences", shortcut: "T" },
  { label: "Open settings", value: "settings", group: "Preferences", shortcut: "⌘," },
  { label: "View documentation", value: "docs", group: "Help" },
  { label: "Keyboard shortcuts", value: "shortcuts", group: "Help", shortcut: "?" },
];

export function Gallery() {
  const [notify, setNotify] = useState(true);
  const [created, setCreated] = useState<string | null>(null);
  const [ttl, setTtl] = useState(SAMPLE_TTL);
  const [jsonDoc, setJsonDoc] = useState(SAMPLE_JSON);
  const jsonLang = useMemo(() => json(), []);
  const shapeTree = useMemo(() => createTreeCollection({ rootNode: SHAPE_TREE }), []);
  const [view, setView] = useState("list");
  const [selectedRows, setSelectedRows] = useState(0);
  // Autocomplete: filter the dataset collection on every keystroke (the Ark way —
  // rebuild the collection from the filtered items).
  const [dsItems, setDsItems] = useState(ALL_DATASETS);
  const datasetCollection = useMemo(() => createListCollection({ items: dsItems }), [dsItems]);
  const filterDatasets = (inputValue: string) =>
    setDsItems(
      ALL_DATASETS.filter((d) => d.label.toLowerCase().includes(inputValue.toLowerCase())),
    );

  // Command palette (⌘K): Shark's `Command` is Ark Combobox — drive it with a filtered
  // list collection grouped by section, exactly like Shark's own example.
  const { contains } = useFilter({ sensitivity: "base" });
  const { collection: commandCollection, filter: filterCommands } = useListCollection({
    initialItems: COMMANDS,
    filter: contains,
    groupBy: (item) => item.group,
  });
  const [cmdOpen, setCmdOpen] = useState(false);
  const [ranCommand, setRanCommand] = useState<string | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <SidebarProvider className="h-svh">
      <GallerySidebar />
      {/* The inset scrolls internally so the sidebar and the hero stay put — same shell
          contract as the App and Workspace scenes. */}
      <SidebarInset className="min-h-0 min-w-0 overflow-y-auto">
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-14 px-8 pb-24">
      <header className="-mx-8 mb-2 border-border border-b bg-gradient-to-b from-muted/40 to-transparent px-8 py-10">
        <p className="font-medium text-primary text-xs uppercase tracking-widest">
          Kanzo Design System
        </p>
        <h1 className="mt-2 font-bold text-3xl tracking-tight">Component gallery</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Shark UI vendored on Ark + tailwind-variants over design tokens. Press{" "}
          <Kbd>t</Kbd> for the theme panel — change radius, accent or light/dark and watch
          everything re-skin. Full shells live on their own scenes (<Kbd>⌘J</Kbd>).
        </p>
      </header>

      <GroupHeader id="group-buttons" title={'Buttons'} blurb={'Actions and status — buttons, badges, and the floating action bar.'} />
      <Section title="Buttons — variants" nav="Variants" group="Buttons" center>
        <div className="flex flex-wrap items-center gap-2">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
        </div>
      </Section>
      <Section title="Buttons — sizes, state, icons" nav="Sizes & state" group="Buttons" center>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
          <Button isLoading>Loading</Button>
          <Button>
            <PlusIcon /> New dataset
          </Button>
          <Button variant="outline">
            <MagnifyingGlassIcon /> Search
          </Button>
          <Button size="icon-md" variant="outline" aria-label="Edit">
            <Pencil1Icon />
          </Button>
          <Button size="icon-md" variant="ghost" aria-label="Like">
            <HeartIcon />
          </Button>
        </div>
      </Section>
      <Section title="Badges" nav="Badges" group="Buttons" center>
        <div className="flex flex-wrap gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="success">Mapped</Badge>
          <Badge variant="warning">Partial</Badge>
          <Badge variant="destructive">Failed</Badge>
          <Badge variant="info">Info</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge size="xs">xs</Badge>
          <Badge size="sm">sm</Badge>
          <Badge size="md">md</Badge>
          <Badge size="lg">lg</Badge>
          <span className="text-muted-foreground text-xs">
            — <code>xs</code> is the micro-badge that was copy-pasted three times in keasy
          </span>
        </div>
      </Section>
      <Section title="Action bar — floating toolbar on selection" nav="Action bar" group="Buttons" center>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setSelectedRows((n) => n + 1)}>
            Select a row
          </Button>
          <span className="text-sm text-muted-foreground">{selectedRows} selected — a toolbar floats up.</span>
        </div>
        <ActionBar open={selectedRows > 0} onOpenChange={(open) => !open && setSelectedRows(0)}>
          <ActionBarContent>
            <ActionBarValue count={selectedRows} label={`${selectedRows} selected`} />
            <ActionBarSeparator />
            <Button size="sm" variant="ghost">
              <Pencil1Icon /> Edit
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive">
              <TrashIcon /> Delete
            </Button>
            <ActionBarSeparator />
            <ActionBarClose asChild>
              <Button size="icon-xs" variant="ghost" aria-label="Clear selection">
                <Cross2Icon />
              </Button>
            </ActionBarClose>
          </ActionBarContent>
        </ActionBar>
      </Section>
      <GroupHeader id="group-new-in-this-branch" title={'New in this branch'} blurb={'Components authored for this branch, built to erase real duplication in keasy and metadata-form.'} />
      <Section title="Stat cards — KPI tiles" nav="Stat cards" group="New in this branch">
        <StatCardsDemo />
      </Section>
      <Section title="Card radio group — one component, four call sites" nav="Card radio" group="New in this branch">
        <CardRadioDemo />
      </Section>
      <Section title="Secret field — credential editing" nav="Secret field" group="New in this branch">
        <SecretFieldDemo />
      </Section>
      <Section title="Field array — repeatable rows" nav="Field array" group="New in this branch">
        <FieldArrayDemo />
      </Section>
      <Section title="Coming soon — availability decorator" nav="Coming soon" group="New in this branch">
        <ComingSoonDemo />
      </Section>
      <GroupHeader id="group-forms" title={'Forms'} blurb={'Inputs and the field chrome around them.'} />
      <Section title="Forms & complex fields" nav="Fields" group="Forms">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel>Dataset name</FieldLabel>
            <Input placeholder="customers" />
            <FieldDescription>Lower-case, no spaces — it becomes the graph id.</FieldDescription>
          </Field>

          <Field>
            <FieldLabel>Visibility</FieldLabel>
            <Select collection={visibilityCollection} defaultValue={["private"]}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select visibility" />
              </SelectTrigger>
              <SelectContent>
                {visibilityCollection.items.map((item) => (
                  <SelectItem key={item.value} item={item}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>Who can see this dataset.</FieldDescription>
          </Field>

          <Field className="sm:col-span-2">
            <FieldLabel>Description</FieldLabel>
            <Textarea placeholder="What is this dataset?" />
            <FieldDescription>Markdown is supported.</FieldDescription>
          </Field>

          <Field>
            <FieldLabel>Linked dataset</FieldLabel>
            <Combobox
              collection={datasetCollection}
              onInputValueChange={(d) => filterDatasets(d.inputValue)}
            >
              <ComboboxInput placeholder="Search datasets…" />
              <ComboboxContent>
                <ComboboxEmpty>No datasets found.</ComboboxEmpty>
                {datasetCollection.items.map((item) => (
                  <ComboboxItem key={item.value} item={item}>
                    {item.label}
                  </ComboboxItem>
                ))}
              </ComboboxContent>
            </Combobox>
            <FieldDescription>Autocomplete — filters as you type.</FieldDescription>
          </Field>

          <Field>
            <FieldLabel>Created</FieldLabel>
            <DateField value={created} onChange={setCreated} />
            <FieldDescription>Ark DatePicker — keyboard-navigable grid, month/year jump.</FieldDescription>
          </Field>

          <Field className="sm:col-span-2">
            <FieldLabel>SPARQL endpoint</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <MagnifyingGlassIcon />
              </InputGroupAddon>
              <InputGroupInput placeholder="api.example.com/sparql" />
              <InputGroupAddon align="inline-end">
                <Kbd>⌘K</Kbd>
              </InputGroupAddon>
            </InputGroup>
          </Field>

          <Field>
            <FieldLabel>Serialization</FieldLabel>
            <RadioGroup defaultValue="ttl">
              <RadioGroupItem value="ttl">Turtle</RadioGroupItem>
              <RadioGroupItem value="jsonld">JSON-LD</RadioGroupItem>
              <RadioGroupItem value="nt">N-Triples</RadioGroupItem>
            </RadioGroup>
          </Field>

          <div className="space-y-4">
            <Field>
              <div className="flex items-center justify-between">
                <FieldLabel>Sample size</FieldLabel>
                <span className="text-sm text-muted-foreground">rows</span>
              </div>
              <Slider defaultValue={[40]} />
            </Field>
            <Field orientation="horizontal">
              <Checkbox defaultChecked />
              <FieldLabel>Include headers</FieldLabel>
            </Field>
            <Field orientation="horizontal">
              <Switch checked={notify} onCheckedChange={(d) => setNotify(d.checked === true)} />
              <FieldLabel>Notify on completion</FieldLabel>
            </Field>
          </div>
        </div>
      </Section>
      <Section title="Autocomplete — standalone combobox" nav="Autocomplete" group="Forms">
        <div className="max-w-sm">
          <Combobox
            collection={datasetCollection}
            onInputValueChange={(d) => filterDatasets(d.inputValue)}
          >
            <ComboboxInput placeholder="Filter datasets…" showClear />
            <ComboboxContent>
              <ComboboxEmpty>No matching datasets.</ComboboxEmpty>
              {datasetCollection.items.map((item) => (
                <ComboboxItem key={item.value} item={item}>
                  {item.label}
                </ComboboxItem>
              ))}
            </ComboboxContent>
          </Combobox>
        </div>
      </Section>
      <Section title="Segmented control (SegmentGroup)" nav="Segment group" group="Forms">
        <SegmentGroup
          value={view}
          onValueChange={(d) => d.value && setView(d.value)}
          aria-label="View mode"
          className="w-fit rounded-md bg-muted p-1"
        >
          {[
            { value: "list", label: "List" },
            { value: "grid", label: "Grid" },
            { value: "graph", label: "Graph" },
          ].map((o) => (
            <SegmentGroupItem key={o.value} value={o.value} className="px-3 py-1.5">
              <SegmentGroupItemText className="text-sm font-medium">{o.label}</SegmentGroupItemText>
            </SegmentGroupItem>
          ))}
        </SegmentGroup>
        <p className="text-sm text-muted-foreground">
          The same primitive powers the theme panel (press <Kbd>t</Kbd>).
        </p>
      </Section>
      <GroupHeader id="group-surfaces" title={'Surfaces'} blurb={'Cards, alerts, toasts and the rest of the flat surfaces.'} />
      <Section title="Alerts (was Callout)" nav="Alerts" group="Surfaces">
        <div className="space-y-2">
          <Alert variant="info">
            <AlertTitle>Heads up</AlertTitle>
            <AlertDescription>Change the theme with «t» — everything re-skins from tokens.</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertTitle>Validation failed</AlertTitle>
            <AlertDescription>Two records failed validation.</AlertDescription>
          </Alert>
        </div>
      </Section>
      <Section title="Cards — media · header + action · footer · clickable" nav="Cards" group="Surfaces">
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Header with a CardAction (menu) + a footer with a badge + button. */}
          <Card>
            <CardMedia variant="icon" className="text-muted-foreground">
              <ListBulletIcon />
              <span className="text-xs font-medium">Table dataset</span>
            </CardMedia>
            <CardHeader>
              <CardTitle>customers.ttl</CardTitle>
              <CardDescription>1,204 triples · updated 2h ago</CardDescription>
              <CardAction>
                <Menu>
                  <MenuTrigger asChild>
                    <Button size="icon-sm" variant="ghost" aria-label="Actions">
                      <DotsHorizontalIcon />
                    </Button>
                  </MenuTrigger>
                  <MenuContent>
                    <MenuItem value="edit">
                      <Pencil1Icon /> Edit
                    </MenuItem>
                    <MenuSeparator />
                    <MenuItem value="delete" variant="destructive">
                      <TrashIcon /> Delete
                    </MenuItem>
                  </MenuContent>
                </Menu>
              </CardAction>
            </CardHeader>
            <CardContent className="flex-1 text-sm text-muted-foreground">
              Mapped to the Customer shape.
            </CardContent>
            <CardFooter>
              <Badge variant="success">Mapped</Badge>
              <Button size="sm" variant="outline" className="ms-auto">
                Open
              </Button>
            </CardFooter>
          </Card>

          {/* CardMedia variant="image" — clips to the top radius. A self-contained,
              token-driven cover (no external image dependency; dogfoods the palette). */}
          <Card>
            <CardMedia variant="image" className="h-32">
              <div className="flex size-full items-center justify-center bg-gradient-to-br from-primary via-primary/85 to-accent-foreground/70">
                <DatabaseIcon className="size-8 text-primary-foreground/90" />
              </div>
            </CardMedia>
            <CardHeader>
              <CardTitle>Dataset cover</CardTitle>
              <CardDescription>
                <ImageIcon className="inline size-3.5" /> CardMedia variant="image"
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              The image slot sits above the header and clips to the card's top corners.
            </CardContent>
          </Card>

          {/* Interactive / clickable card — composed with asChild + a link (no variant). */}
          <Card
            asChild
            className="cursor-pointer transition-colors hover:border-primary hover:bg-accent/40 sm:col-span-2"
          >
            <a href="#">
              <CardHeader>
                <CardTitle>Create a dataset</CardTitle>
                <CardDescription>Clickable card — the whole surface is a link.</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Composed the Shark way: <code>{"<Card asChild><a>…</a></Card>"}</code> with hover
                utilities. No <code>interactive</code> prop needed.
              </CardContent>
            </a>
          </Card>
        </div>
      </Section>
      <Section title="Toast" nav="Toast" group="Surfaces">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => toast.create({ title: "Saved", description: "Dataset updated.", type: "success" })}>
            Success
          </Button>
          <Button variant="outline" onClick={() => toast.create({ title: "Validation failed", description: "2 records rejected.", type: "error" })}>
            Error
          </Button>
          <Button variant="outline" onClick={() => toast.create({ title: "Re-indexing…", type: "info" })}>
            Info
          </Button>
        </div>
      </Section>
      <Section title="Collapsible" nav="Collapsible" group="Surfaces">
        <Collapsible defaultOpen>
          <CollapsibleTrigger asChild>
            <Button variant="outline">Toggle details</Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 rounded-md border border-border p-3 text-sm text-muted-foreground">
              This region animates its height open and closed.
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Section>
      <Section title="Feedback & surfaces" nav="Feedback" group="Surfaces">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <Spinner />
            <span className="text-sm text-muted-foreground">Loading…</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => setCmdOpen(true)}>
            Command palette <Kbd>⌘</Kbd> <Kbd>K</Kbd>
          </Button>
          {ranCommand && (
            <span className="text-sm text-muted-foreground">
              Ran: <code className="font-mono text-foreground">{ranCommand}</code>
            </span>
          )}
          <Avatar size="md">
            <AvatarFallback>AL</AvatarFallback>
          </Avatar>
        </div>

        <CommandDialog open={cmdOpen} onOpenChange={(e) => setCmdOpen(e.open)}>
          <CommandDialogContent>
            <Command
              collection={commandCollection}
              onInputValueChange={({ inputValue }) => filterCommands(inputValue)}
              onValueChange={(d) => {
                if (d.value[0]) setRanCommand(d.value[0]);
                setCmdOpen(false);
              }}
            >
              <CommandInput placeholder="Type a command or search…" />
              <CommandContent>
                <CommandEmpty />
                <CommandList>
                  {commandCollection.group().map(([group, items]) => (
                    <CommandGroup heading={group} key={group}>
                      {items.map((item) => (
                        <CommandItem item={item} key={item.value}>
                          {item.label}
                          {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ))}
                </CommandList>
              </CommandContent>
            </Command>
          </CommandDialogContent>
        </CommandDialog>
        <Separator />
        <div className="flex max-w-sm items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      </Section>
      <GroupHeader id="group-overlays" title={'Overlays'} blurb={'Everything that floats above the page — dialogs, popovers, menus, tours.'} />
      <Section title="Context menu — right-click" nav="Context menu" group="Overlays">
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className="flex h-24 w-full items-center justify-center rounded-lg border-2 border-dashed border-border text-sm text-muted-foreground">
              Right-click me
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem value="edit">
              <Pencil1Icon /> Edit
              <ContextMenuShortcut>⌘E</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem value="duplicate">
              <PlusIcon /> Duplicate
              <ContextMenuShortcut>⌘D</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem value="delete" variant="destructive">
              <TrashIcon /> Delete
              <ContextMenuShortcut>⌫</ContextMenuShortcut>
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </Section>
      <Section title="Overlays — Dialog · Popover · Tooltip · Menu" nav="Overlays" group="Overlays">
        <div className="flex flex-wrap items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Open dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader title="Edit dataset" description="Update the display name. Changes apply immediately." />
              <DialogBody>
                <Field>
                  <FieldLabel>Display name</FieldLabel>
                  <Input defaultValue="customers" />
                </Field>
              </DialogBody>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button>Save</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <MagnifyingGlassIcon /> Filters
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-4">
              <PopoverTitle>Filters</PopoverTitle>
              <PopoverDescription>Narrow the results shown in the table.</PopoverDescription>
              <div className="mt-3 flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox /> Only failed
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox /> Only mapped
                </label>
              </div>
            </PopoverContent>
          </Popover>

          <Menu>
            <MenuTrigger asChild>
              <Button size="icon-md" variant="outline" aria-label="Actions">
                <DotsHorizontalIcon />
              </Button>
            </MenuTrigger>
            <MenuContent>
              <MenuItem value="edit">
                <Pencil1Icon /> Edit
              </MenuItem>
              <MenuItem value="duplicate">
                <PlusIcon /> Duplicate
              </MenuItem>
              <MenuSeparator />
              <MenuItem value="delete" variant="destructive">
                <TrashIcon /> Delete
              </MenuItem>
            </MenuContent>
          </Menu>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon-md" variant="ghost" aria-label="Like">
                <HeartIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add to favourites</TooltipContent>
          </Tooltip>
        </div>
      </Section>
      <Section title="Tour — guided walkthrough" nav="Tour" group="Overlays" center>
        <Tour steps={tourSteps}>
          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-4">
            <TourTrigger asChild>
              <Button variant="outline">Start tour</Button>
            </TourTrigger>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor="tour-name">Dataset name</label>
              <Input id="tour-name" placeholder="customers" className="w-48" />
            </div>
            <Button id="tour-save">Save</Button>
          </div>

          <TourContent>
            <TourHeader className="pb-0">
              <TourTitle />
              <TourDescription />
            </TourHeader>
            <TourProgressText className="px-(--space)" />
            <TourActions />
          </TourContent>
        </Tour>
      </Section>
      <GroupHeader id="group-data" title={'Data'} blurb={'Tables and hierarchies, including the TanStack-backed data table.'} />
      <Section title="Data table — TanStack (sort · filter · paginate)" nav="Data table" group="Data" bare>
        <DataTableDemo />
      </Section>
      <Section title="Table — striped + hover" nav="Table" group="Data">
        <Table variant="striped">
          <TableHeader>
            <TableRow>
              <TableHead>Dataset</TableHead>
              <TableHead>Records</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>customers</TableCell>
              <TableCell>1,204</TableCell>
              <TableCell>
                <Badge variant="success">Mapped</Badge>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>orders</TableCell>
              <TableCell>8,912</TableCell>
              <TableCell>
                <Badge variant="warning">Partial</Badge>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Section>
      <Section title="Tree view — shape hierarchy" nav="Tree view" group="Data">
        <div className="max-w-sm rounded-lg border border-border p-2">
          <TreeView collection={shapeTree} aria-label="Shapes" defaultExpandedValue={["customers"]}>
            <TreeViewTree>
              {shapeTree.rootNode.children?.map((node, index) => (
                <ShapeNode indexPath={[index]} key={node.id} node={node} />
              ))}
            </TreeViewTree>
          </TreeView>
        </div>
        <p className="text-sm text-muted-foreground">
          Ark <code>TreeView</code> — keyboard nav, expand/collapse, indentation guides. For SHACL
          shapes / RDF hierarchies in keasy.
        </p>
      </Section>
      <GroupHeader id="group-navigation" title={'Navigation'} blurb={'Tabs, breadcrumbs and the thin toolbar/status strips.'} />
      <Section title="Tabs — animated indicator" nav="Tabs" group="Navigation">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="schema">Schema</TabsTrigger>
            <TabsTrigger value="issues">Issues</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="text-sm text-muted-foreground">
            Dataset overview and summary statistics.
          </TabsContent>
          <TabsContent value="schema" className="text-sm text-muted-foreground">
            The inferred SHACL shape.
          </TabsContent>
          <TabsContent value="issues" className="text-sm text-muted-foreground">
            Validation issues found.
          </TabsContent>
        </Tabs>
      </Section>
      <Section title="Toolbar + StatusBar — thin top/bottom strips (composites)" nav="Toolbar & status" group="Navigation">
        <div className="flex h-40 flex-col overflow-hidden rounded-lg border border-border">
          <Toolbar
            left={<span className="font-medium text-foreground">customers.ttl</span>}
            right={<span>UTF-8 · Turtle</span>}
            actions={
              <>
                {/* Thin-bar icons opt out of the Button press-scale (it reads as a jump on a
                    tiny target) — matching the StatusBar's plain toggle buttons. */}
                <Button size="icon-xs" variant="ghost" clickEffect={false} aria-label="Format"><CodeIcon /></Button>
                <Button size="icon-xs" variant="ghost" clickEffect={false} aria-label="Search"><MagnifyingGlassIcon /></Button>
              </>
            }
          />
          <div className="flex flex-1 items-center justify-center bg-muted/30 text-sm text-muted-foreground">
            Canvas — bookended by a top Toolbar and a bottom StatusBar.
          </div>
          <StatusBar
            left={<span>1,204 triples</span>}
            right={<span>Ln 1, Col 1</span>}
            panels={[{ id: "issues", icon: <ExclamationTriangleIcon />, label: "Issues" }]}
          />
        </div>
      </Section>
      <Section title="Section header + attribution (composites)" nav="Section header" group="Navigation">
        <div className="space-y-4 rounded-lg border border-border p-4">
          <SectionHeader
            title="Dataset settings"
            description="A reusable title + description + actions header (from metadata-form)."
            icon={<DatabaseIcon />}
            bordered
            actions={
              <>
                <Button size="sm" variant="outline">Cancel</Button>
                <Button size="sm">Save</Button>
              </>
            }
          />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Footer attribution →</span>
            <MadeWithKanzo href="#" />
          </div>
        </div>
      </Section>
      <GroupHeader id="group-shells" title={'Shells'} blurb={'The full-page shells — see the App and Workspace scenes for these at real size.'} />
      <Section title="Code editor — CodeMirror (EditorShell)" nav="Code editor" group="Shells" bare>
        <EditorShell
          value={jsonDoc}
          onChange={setJsonDoc}
          extensions={jsonLang}
          lineNumbers
          minHeight="180px"
        />
        <p className="text-sm text-muted-foreground">
          Syntax highlighting from the injected language (<code>@codemirror/lang-json</code>),
          coloured by the <code>--kanzo-syntax-*</code> tokens — re-themes with light/dark. Batteries:
          active line, bracket matching, fold gutter, search (<Kbd>⌘</Kbd> <Kbd>F</Kbd>).
        </p>
        <EditorShell value={ttl} onChange={setTtl} lineNumbers minHeight="120px" />
        <p className="text-sm text-muted-foreground">
          The same surface with no language injected — plain text (Turtle here), for a
          bring-your-own-LSP consumer like fossil.
        </p>
      </Section>
      <Section title="Shells — see the dedicated scenes" nav="App & workspace" group="Shells" bare>
        <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Sidebar</strong> and{" "}
            <strong className="text-foreground">Workspace</strong> live on their own
            full-viewport screens — a shell boxed into a 384px frame needs{" "}
            <code>!important</code> height overrides and tells you nothing about how it
            really behaves.
          </p>
          <p className="mt-2">
            Switch with the scene picker (top right) or <code>⌘J</code>.
          </p>
        </div>
      </Section>

      </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
