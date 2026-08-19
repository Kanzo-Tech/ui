"use client";

// Photos in, a spreadsheet out — and one SHACL document deciding what "a spreadsheet" means.
//
// The arrangement is three panes: the shape, the ledger being filled, and the ticket the selected
// row was read from. The middle pane is the point. Extraction gets most cells right and some cells
// wrong, and the only version of this screen that is honest about that puts the paper next to the
// number.
//
// The engine behind the stream is `useAiStream` from the library — the same hook `Complete` and
// `Suggest` run on. It is domain-free by construction, so a run of vision events uses it
// unchanged, and this is its second consumer.
//
// The ledger is `@kanzo-tech/ui/table`, and it is the one call site in this repository whose
// `ColumnDef[]` is built at RUNTIME: the columns come out of a SHACL shape the reader is editing in
// the next pane, so the table is redefined as they type. Nothing else here proves that works.

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Button,
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
  cn,
  DataList,
  DataListItem,
  DataListItemLabel,
  DataListItemValue,
  DownloadTrigger,
  FileUpload,
  FileUploadDropzone,
  FileUploadHiddenInput,
  FileUploadTrigger,
  ImageCropper,
  ImageCropperImage,
  ImageCropperSelection,
  Input,
  NativeSelect,
  NativeSelectOption,
  Resizable,
  ResizablePanel,
  ResizableResizeTrigger,
  ScrollArea,
  SectionActions,
  SectionDescription,
  SectionHeader,
  SectionTitle,
  SectionTitleGroup,
  SegmentGroup,
  SegmentGroupIndicator,
  SegmentGroupItem,
  SegmentGroupItemText,
  Separator,
  ShellAside,
  ShellBody,
  ShellFooter,
  ShellHeader,
  ShellMain,
  ShellRoot,
  Show,
  Spinner,
  Status,
  ToggleGroup,
  ToggleGroupItem,
  useAiStream,
} from "@kanzo-tech/ui";
// TanStack-backed: the `/table` subpath, never the root barrel.
import {
  type ColumnDef,
  DataTableContent,
  DataTableFacetFilter,
  DataTableRoot,
  DataTableSearch,
  DataTableToolbar,
  DataTableViewOptions,
  facetFilterFn,
  sortableHeader,
  useDataTable,
} from "@kanzo-tech/ui/table";
// CodeMirror-backed: the `/editor` subpath, for the same reason.
import { StreamLanguage } from "@codemirror/language";
import { turtle } from "@codemirror/legacy-modes/mode/turtle";
import { CodeEditor } from "@kanzo-tech/ui/editor";
import {
  AlertTriangleIcon,
  DownloadIcon,
  FileCode2Icon,
  ImageIcon,
  PlusIcon,
  ScanTextIcon,
  SquareIcon,
  UploadIcon,
} from "lucide-react";
import { toCsv, csvName } from "./csv";
import {
  blankRow,
  recorded,
  SAMPLE,
  type Crop,
  type ExtractEvent,
  type Extractor,
  type Shot,
} from "./extract";
import { liveExtractor, readKey, writeKey } from "./live";
import { ReceiptsPreferences } from "./preferences";
import { openLedger, type Column, type Issue, type Ledger, type Row } from "./rudof";
import { SHAPES, TICKET_SHAPE } from "./shape";

/** Turtle, through CodeMirror's legacy stream parser. `extensions` is the seam for a language
 *  brain, and this is defined at module scope so the editor never reconfigures its compartment. */
const TURTLE = StreamLanguage.define(turtle);

/** What extraction said about one cell, beside what it said the cell IS. */
interface CellMeta {
  confidence: number;
  note?: string;
}

type MetaMap = Record<string, Record<string, CellMeta>>;

/** Below this a cell is drawn as unsure. Handwriting lands here; print does not. */
const UNSURE = 0.9;

// ── The paper ────────────────────────────────────────────────────────────────

/** An image's natural aspect, needed to give a crop box the right shape. Uploaded photos are not
 *  all 4:3, so it is measured rather than assumed. */
function useAspect(src: string): number | null {
  const [aspect, setAspect] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    const img = new Image();
    img.onload = () => live && setAspect(img.naturalWidth / img.naturalHeight);
    img.src = src;
    return () => {
      live = false;
    };
  }, [src]);
  return aspect;
}

/** One ticket, cut out of the photo it was found in. `head` keeps the box square and shows the
 *  top of the ticket — where the biro annotation is, and the whole reason to look at a thumbnail.
 *
 *  The offsets are a `translate`, not `top`/`left`: a percentage inset resolves against the
 *  CONTAINER, and in `head` the container is a square that has nothing to do with the crop's
 *  height. A percentage translate resolves against the IMAGE, which is the thing being moved.
 *  Physical directions on purpose — a photograph does not mirror in RTL. */
function Ticket({
  className,
  crop,
  head,
  shot,
}: {
  className?: string;
  crop: Crop;
  head?: boolean;
  shot: Shot;
}) {
  const aspect = useAspect(shot.src);

  return (
    <div
      className={cn("relative overflow-hidden rounded-md border bg-muted", className)}
      style={head || !aspect ? undefined : { aspectRatio: (crop.w * aspect) / crop.h }}
    >
      <img
        alt=""
        className="absolute top-0 left-0 max-w-none"
        src={shot.src}
        style={{
          width: `${100 / crop.w}%`,
          transform: `translate(${-crop.x * 100}%, ${-crop.y * 100}%)`,
        }}
      />
    </div>
  );
}

/** The whole sheet, with the row's box drawn on it. Read only, and that is the point: the answer
 *  to "where did this number come from" is not a control, and a box that moves under a pointer
 *  reads as a different ticket being chosen. Correcting it is {@link DrawBox}, which is a mode the
 *  reader asks for.
 *
 *  Percentages, because the crop is fractions of the image and the box is the image. `--brand`
 *  through the graph's own rule: a selection is a selection. */
function Sheet({ crop, shot }: { crop: Crop; shot: Shot }) {
  return (
    <div className="relative overflow-hidden rounded-md border bg-muted">
      <img alt="" className="block w-full" src={shot.src} />
      <div
        className="pointer-events-none absolute rounded-xs ring-2 ring-primary"
        style={{
          insetInlineStart: `${crop.x * 100}%`,
          insetBlockStart: `${crop.y * 100}%`,
          width: `${crop.w * 100}%`,
          height: `${crop.h * 100}%`,
          backgroundColor: "var(--brand-a3)",
        }}
      />
    </div>
  );
}

/**
 * Drawing the box: the one gesture that was missing, and the only paper a row typed by hand has
 * ever had.
 *
 * Two things it has to get right, and both are about the frame rather than the cropper.
 *
 * **The frame is the picture's own aspect.** Ark contains the image inside the viewport and reports
 * the selection against the VIEWPORT, so at any other ratio the picture is letterboxed and the two
 * boxes stop agreeing. Measured with `useAspect`, not assumed.
 *
 * **`maxZoom={1}` is what keeps the picture still.** At zoom 1 the pan offset clamps to zero, so
 * the wheel and a drag on the image do nothing — the sheet stays where it is and the only thing
 * that moves is the box. That is the answer to a box that seemed to be choosing a different ticket,
 * and it also makes the arithmetic exact: viewport pixels over frame pixels ARE fractions of the
 * image once the two are the same box.
 *
 * The ref is on the cropper ROOT, not on the bordered box around it, and the two are not the same
 * rectangle: a border is two pixels of the outer one that the viewport never had, which reported
 * every fraction about half a percent short. Measured inside the change handler rather than watched,
 * because a `ResizeObserver`'s callbacks are delivered on the rendering loop — in a background tab
 * it never fires at all, and a component that waits for one renders an empty box forever.
 */
function DrawBox({
  onCancel,
  onSave,
  shot,
}: {
  onCancel: () => void;
  onSave: (crop: Crop) => void;
  shot: Shot;
}) {
  const aspect = useAspect(shot.src);
  const frame = useRef<HTMLDivElement>(null);
  const drawn = useRef<Crop | null>(null);

  return (
    <div className="space-y-1.5">
      <div
        className="overflow-hidden rounded-md border bg-muted"
        style={{ aspectRatio: aspect ?? undefined }}
      >
        <Show when={aspect !== null}>
          <ImageCropper
            maxZoom={1}
            onCropChange={({ crop }) => {
              const box = frame.current?.getBoundingClientRect();
              if (!box?.width || !box.height) return;
              drawn.current = {
                x: crop.x / box.width,
                y: crop.y / box.height,
                w: crop.width / box.width,
                h: crop.height / box.height,
              };
            }}
            ref={frame}
            style={{ aspectRatio: aspect ?? undefined }}
          >
            <ImageCropperImage alt="" src={shot.src} />
            <ImageCropperSelection />
          </ImageCropper>
        </Show>
      </div>
      <ButtonGroup aria-label="What to do with the box you drew" className="w-full">
        <Button
          className="flex-1"
          onClick={() => {
            const box = drawn.current;
            if (box) onSave(box);
          }}
          size="sm"
        >
          Keep this box
        </Button>
        <Button className="flex-1" onClick={onCancel} size="sm" variant="outline">
          Cancel
        </Button>
      </ButtonGroup>
    </div>
  );
}

// ── The ledger ───────────────────────────────────────────────────────────────

/**
 * What a cell renderer needs that a column definition cannot close over.
 *
 * TanStack's `meta` rather than a closure, and this is the whole reason the table survives being
 * edited: a `ColumnDef[]` rebuilt on every keystroke gives every column a new identity, and column
 * visibility, sizing and the header groups are all keyed off that. So the definitions are a pure
 * function of the SHACL columns — they change when the SHAPE changes and at no other time — and
 * everything that moves per keystroke arrives through here.
 */
interface LedgerMeta {
  cropOf: (rowId: string) => { crop: Crop; shot: Shot } | undefined;
  edit: (rowId: string, key: string, value: string) => void;
  issuesAt: (rowId: string, key: string) => Issue[];
  metaAt: (rowId: string, key: string) => CellMeta | undefined;
}

const metaOf = (meta: unknown) => meta as LedgerMeta;

function Cell({
  column,
  ledger,
  row,
}: {
  column: Column;
  ledger: LedgerMeta;
  row: Row;
}) {
  const issues = ledger.issuesAt(row.id, column.key);
  const cellMeta = ledger.metaAt(row.id, column.key);
  const value = row.cells[column.key] ?? "";
  const invalid = issues.length > 0;
  const unsure = Boolean(value) && (cellMeta?.confidence ?? 1) < UNSURE;
  const shared = "h-8 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-inset";
  // `text-decoration` does not render on a <select>, so an unsure option says so in the aside
  // rather than wearing a mark no browser draws.
  const unsureMark =
    "underline decoration-warning decoration-dotted decoration-2 underline-offset-4";

  return (
    <Show
      fallback={
        <Input
          aria-invalid={invalid}
          aria-label={column.label}
          className={cn(
            shared,
            column.type !== "string" && "tabular-nums",
            (column.type === "decimal" || column.type === "integer") && "text-end",
            unsure && unsureMark,
          )}
          onChange={(e) => ledger.edit(row.id, column.key, e.target.value)}
          placeholder={invalid ? "—" : ""}
          value={value}
        />
      }
      when={Boolean(column.options)}
    >
      <NativeSelect
        aria-invalid={invalid}
        aria-label={column.label}
        className={shared}
        onChange={(e) => ledger.edit(row.id, column.key, e.target.value)}
        value={value}
      >
        <NativeSelectOption value="">—</NativeSelectOption>
        {(column.options ?? []).map((option) => (
          <NativeSelectOption key={option} value={option}>
            {option}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Show>
  );
}

/**
 * The shape's columns as TanStack's.
 *
 * `sh:name` is the header, `sh:order` the order the projection already sorted by, `sh:datatype`
 * whether the cell is an `Input` or a `NativeSelect`, and `sh:description` the header's `title`.
 * The thumbnail column is ours and cannot be hidden: it is the only thing on the row that says
 * which piece of paper this is.
 */
function ledgerColumns(columns: Column[]): ColumnDef<Row>[] {
  const numeric = (column: Column) => column.type === "decimal" || column.type === "integer";

  return [
    {
      // NOT `"ticket"`. A column id has to be unique across the table, and the ids on the right of
      // this list are the shape's own local names — `tk:ticket` projects to `ticket`, so the
      // thumbnail collided with N TICKET: two columns and two header cells answering to one key,
      // which React reported as duplicate children and TanStack keyed one visibility flag for
      // both. A colon cannot occur in an XML local name, so no shape can reach this one.
      id: "kanzo:paper",
      enableHiding: false,
      header: () => <span className="sr-only">The ticket</span>,
      cell: ({ row, table }) => {
        const found = metaOf(table.options.meta).cropOf(row.original.id);
        // `m-1.5` because the cells are `p-0` — that override is for the editable ones, whose
        // `Input` has to fill its cell, and the paper is the one cell that wants air.
        return found ? (
          <Ticket className="m-1.5 size-10" crop={found.crop} head shot={found.shot} />
        ) : null;
      },
    },
    ...columns.map<ColumnDef<Row>>((column) => ({
      id: column.key,
      accessorFn: (row) => row.cells[column.key] ?? "",
      // `sortableHeader` rather than a bare label, and it earns its place on a ledger under
      // review: sorting by a column is how a reviewer gathers the empty cells of one field
      // together. `align` follows the datatype, so a number sorts from the edge its digits sit on.
      header: sortableHeader<Row, unknown>(
        <span
          className="whitespace-nowrap"
          // The shape's own `sh:description`. It is what the model is told; showing it here means
          // the reviewer is told the same thing.
          title={column.description}
        >
          {column.label}
          <Show when={column.required}>
            <span aria-hidden className="ms-0.5 text-destructive">
              *
            </span>
          </Show>
        </span>,
        { align: numeric(column) ? "end" : "start" },
      ),
      // A closed vocabulary IS a facet — `sh:in` already enumerated it, so the filter's options are
      // the shape's rather than a list typed beside it.
      filterFn: column.options ? facetFilterFn : undefined,
      enableColumnFilter: Boolean(column.options),
      cell: ({ row, table }) => (
        <Cell column={column} ledger={metaOf(table.options.meta)} row={row.original} />
      ),
    })),
  ];
}

// ── The showcase ─────────────────────────────────────────────────────────────

export function ReceiptsShowcase() {
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [boot, setBoot] = useState<string | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [meta, setMeta] = useState<MetaMap>({});
  const [crops, setCrops] = useState<Record<string, { shot: string; crop: Crop }>>({});
  const [source, setSource] = useState("recorded");
  /** The visitor's own key. Read once on mount — `localStorage` is not there during the server
   *  render, and a value read at the top would be a hydration mismatch on the very first paint. */
  const [apiKey, setApiKey] = useState("");
  const [shapeOpen, setShapeOpen] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(true);
  /** Whether the ticket pane shows the cut or the sheet it was cut from. */
  const [whole, setWhole] = useState(false);
  /** The row whose box is being drawn, and the only state that turns the pane into a control. */
  const [drawing, setDrawing] = useState<string | null>(null);
  const [shapeText, setShapeText] = useState(TICKET_SHAPE);
  const [shapeError, setShapeError] = useState<string | null>(null);

  const engine = useAiStream<ExtractEvent>("Could not read the photo");
  /** Whether a ledger was ever parsed — a later failure is an edit, not a boot failure. */
  const ledgerRef = useRef<Ledger | null>(null);
  const added = useRef(0);

  /**
   * The shape is parsed in wasm, and everything below reads the result — re-parsed as it is
   * edited, so the table's columns, the model's schema, the validation and the CSV all move with
   * it. Debounced because each pass is a real parse, and a failed parse KEEPS the last good
   * ledger: a half-typed `sh:in (` should mark the editor invalid, not empty the screen.
   */
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      openLedger(shapeText).then(
        (l) => {
          if (!alive) return;
          setLedger(l);
          setShapeError(null);
        },
        (e: unknown) => {
          if (!alive) return;
          const message = e instanceof Error ? e.message : String(e);
          setShapeError(message);
          setBoot((prev) => prev ?? (ledgerRef.current ? null : message));
        },
      );
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [shapeText]);

  useEffect(() => setApiKey(readKey()), []);

  // Memoised because it is a dependency of three other memos: `?? []` is a fresh array every
  // render, which would defeat all of them.
  const columns = useMemo(() => ledger?.columns ?? [], [ledger]);
  ledgerRef.current = ledger;

  // Real SHACL, on every keystroke. Five rows is nothing; the validator is in wasm and the graph
  // never leaves it.
  const issues = useMemo(
    () => (ledger && rows.length ? ledger.validate(rows) : []),
    [ledger, rows],
  );

  const issuesAt = useCallback(
    (rowId: string, key: string) => issues.filter((i) => i.rowId === rowId && i.key === key),
    [issues],
  );

  const shotById = useMemo(() => new Map(shots.map((s) => [s.id, s])), [shots]);

  const cropOf = useCallback(
    (rowId: string) => {
      const found = crops[rowId];
      const shot = found && shotById.get(found.shot);
      return shot ? { crop: found.crop, shot } : undefined;
    },
    [crops, shotById],
  );

  const edit = useCallback((rowId: string, key: string, value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, cells: { ...r.cells, [key]: value } } : r)),
    );
  }, []);

  const defs = useMemo(() => ledgerColumns(columns), [columns]);

  /**
   * Single selection, and it is the TABLE's rather than a second copy beside it. `getRowId` makes
   * the selection key the row's own id, so `data-state="selected"` — which `DataTableContent`
   * already writes — is the highlight, and the ticket pane reads the same one value.
   */
  const table = useDataTable<Row>({
    columns: defs,
    data: rows,
    enableMultiRowSelection: false,
    getRowId: (row) => row.id,
    meta: {
      cropOf,
      edit,
      issuesAt,
      metaAt: (rowId, key) => meta[rowId]?.[key],
    } satisfies LedgerMeta,
    // No pagination on screen, so the page has to hold whatever twelve photos produce.
    pageSize: 500,
  });

  const selected = Object.keys(table.getState().rowSelection)[0] ?? null;
  const selectedRow = rows.find((r) => r.id === selected) ?? null;
  const selectedCrop = selected ? cropOf(selected) : undefined;
  /** The photograph the pane is about: the selected row's, or the first uploaded one for a row
   *  that has no box yet. */
  const sheet = selectedCrop?.shot ?? shots[0];

  // The first row to arrive is the one the ticket pane shows, so the pane is never empty while
  // the table is filling. Later rows do not steal it — that would move the paper under the reader.
  useEffect(() => {
    const first = rows[0];
    if (!selected && first) table.setRowSelection({ [first.id]: true });
  }, [rows, selected, table]);

  const apply = useCallback((event: ExtractEvent) => {
    if (event.kind === "row") {
      setCrops((prev) => ({ ...prev, [event.rowId]: { shot: event.shot, crop: event.crop } }));
      setRows((prev) =>
        prev.some((r) => r.id === event.rowId) ? prev : [...prev, { id: event.rowId, cells: {} }],
      );
      return;
    }
    setRows((prev) =>
      prev.map((r) =>
        r.id === event.rowId ? { ...r, cells: { ...r.cells, [event.key]: event.value } } : r,
      ),
    );
    setMeta((prev) => ({
      ...prev,
      [event.rowId]: {
        ...prev[event.rowId],
        [event.key]: { confidence: event.confidence, note: event.note },
      },
    }));
  }, []);

  const extractor: Extractor = useMemo(
    () => (source === "live" && apiKey ? liveExtractor(columns, apiKey) : recorded),
    [apiKey, columns, source],
  );

  const run = useCallback(() => {
    if (!shots.length) return;
    setRows([]);
    setMeta({});
    setCrops({});
    table.resetRowSelection();
    engine.start((signal) => extractor(shots, signal));
    void (async () => {
      for (;;) {
        const event = await engine.next();
        if (event == null) break;
        apply(event);
      }
      engine.idle();
    })();
  }, [apply, engine, extractor, shots, table]);

  const onFiles = useCallback((files: File[]) => {
    setShots(
      files.map((file, i) => ({
        id: `${file.name}-${i}`,
        name: file.name,
        src: URL.createObjectURL(file),
      })),
    );
  }, []);

  // The CSV is written from the rows READ BACK OUT of the graph, not from the editable array —
  // `ledger.table` runs the star projection so the claim "one serialisation, then another" is a
  // thing the code does rather than a thing the docs say.
  const csv = useMemo(
    () => toCsv(columns, ledger && rows.length ? ledger.table(rows) : rows),
    [columns, ledger, rows],
  );
  // The same rows, serialised the other way. Not a second model of the data — `validate` already
  // builds this graph on every keystroke; this is the button that admits it exists.
  const turtle = useMemo(() => (ledger && rows.length ? ledger.turtle(rows) : ""), [ledger, rows]);
  const streaming = engine.status === "streaming";
  const blanks = rows.reduce((n, r) => n + columns.filter((c) => !r.cells[c.key]).length, 0);

  return (
    <ShellRoot className="h-dvh">
      {/* The utility strip `metadata-form` uses — h-9 and text-xs, a small icon and the controls —
          and then the page header proper. Two rows, which is what that showcase does too. */}
      <ShellHeader>
        <div className="flex h-9 items-center gap-2.5 border-b px-3 text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <ScanTextIcon aria-hidden className="size-3.5" />
            Receipts
          </span>

          <span className="ms-1 text-muted-foreground">Shape</span>
          <NativeSelect
            aria-label="Example shape"
            className="w-64"
            size="sm"
            onChange={(e) => {
              const picked = SHAPES.find((sh) => sh.id === e.target.value);
              if (picked) setShapeText(picked.source);
            }}
            value={SHAPES.find((sh) => sh.source === shapeText)?.id ?? ""}
          >
            <NativeSelectOption value="">Edited shape</NativeSelectOption>
            {SHAPES.map((sh) => (
              <NativeSelectOption key={sh.id} value={sh.id}>
                {sh.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>

          {/* Without a key there is no choice to make, and a two-option control that can only land
              on one of them is a lie — so what is left is a statement of fact: this is the recorded
              run. The moment a key exists the choice does too, and the segments come back. */}
          <Show
            fallback={
              <Badge
                className="ms-auto"
                pill
                size="xs"
                title="A recorded run of a real extraction. Paste your Anthropic key in Preferences to run it live."
                variant="secondary"
              >
                Recorded run
              </Badge>
            }
            when={Boolean(apiKey)}
          >
            <SegmentGroup
              className="ms-auto"
              onValueChange={(d) => setSource(d.value ?? "recorded")}
              value={source}
            >
              <SegmentGroupIndicator />
              <SegmentGroupItem value="recorded">
                <SegmentGroupItemText>Recorded</SegmentGroupItemText>
              </SegmentGroupItem>
              <SegmentGroupItem value="live">
                <SegmentGroupItemText>Live model</SegmentGroupItemText>
              </SegmentGroupItem>
            </SegmentGroup>
          </Show>
        </div>

        <SectionHeader className="px-6 py-3" scale="page">
          <SectionTitleGroup>
            <SectionTitle className="font-heading" level={1} scale="page">
              Receipts
            </SectionTitle>
            <SectionDescription className="truncate text-xs">
              the shape → the photographs → the sheet
            </SectionDescription>
          </SectionTitleGroup>

          {/* Where the screen's verbs live, and its verdict beside them. The validation badges were
              in the footer, three regions away from the thing they judge; here they sit next to the
              button that would hand somebody the file they are a verdict on. */}
          <SectionActions className="gap-2">
            <Show when={rows.length > 0}>
              <Show when={blanks > 0}>
                <Badge pill size="xs" variant="warning">
                  {blanks} unread
                </Badge>
              </Show>
              <Show when={issues.length > 0}>
                <Badge pill size="xs" variant="destructive">
                  {issues.length} violations
                </Badge>
              </Show>
              <Show when={issues.length === 0 && blanks === 0}>
                <Badge pill size="xs" variant="success">
                  Valid
                </Badge>
              </Show>
            </Show>

            <ButtonGroup aria-label="Extraction and the sheet">
              <Show
                fallback={
                  <Button
                    className="gap-1.5"
                    // Nothing to read is a different state from nothing to read it WITH, and both
                    // are off: no shape parsed, or no photograph on screen. The run used to fall
                    // back to the sample photo, which extracted something the reader never chose.
                    disabled={!ledger || shots.length === 0}
                    onClick={run}
                    size="sm"
                  >
                    <ScanTextIcon />
                    Extract
                  </Button>
                }
                when={streaming}
              >
                <Button className="gap-1.5" onClick={() => engine.abort()} size="sm" variant="outline">
                  <SquareIcon />
                  Stop
                </Button>
              </Show>

              <ButtonGroupSeparator />

              {/* Two options, both on screen. «Export» named a category of operation and then hid
                  half of what it could do behind a caret — and the two are not a default and an
                  afterthought: the sheet is what a bookkeeper wants and the graph is what the next
                  system wants, and neither is a variant of the other. So the group says the verb
                  once and offers the two nouns, which is what `ButtonGroupText` is for. */}
              <ButtonGroupText>
                <DownloadIcon aria-hidden />
                Download
              </ButtonGroupText>
              <DownloadTrigger
                asChild
                data={csv}
                fileName={csvName(columns, rows)}
                mimeType="text/csv"
              >
                <Button disabled={!rows.length} size="sm" title="The sheet, for Excel" variant="outline">
                  CSV
                </Button>
              </DownloadTrigger>
              <DownloadTrigger
                asChild
                data={turtle}
                fileName={csvName(columns, rows).replace(/\.csv$/, ".ttl")}
                mimeType="text/turtle"
              >
                <Button
                  disabled={!rows.length}
                  size="sm"
                  title="The same rows as a graph"
                  variant="outline"
                >
                  Turtle
                </Button>
              </DownloadTrigger>
            </ButtonGroup>
          </SectionActions>
        </SectionHeader>
      </ShellHeader>

      <ShellBody className="min-h-0">
        {/* The activity bar: which panes are open, drawn as icons on the edge they open on. It is
            a MULTIPLE, deselectable `ToggleGroup` because the two panes are independent — the
            workspace's dock is the same machine with `multiple={false}`, because there exactly one
            panel shows at a time. Either way the machine owns the pressed state and the roving
            focus; a Button row would hand-roll `aria-pressed` and get one of the two wrong. */}
        <ToggleGroup
          aria-label="Panels"
          className="shrink-0 border-e border-border bg-card px-1.5 py-2"
          multiple
          onValueChange={(d) => {
            setShapeOpen(d.value.includes("shape"));
            setTicketOpen(d.value.includes("ticket"));
          }}
          orientation="vertical"
          size="sm"
          spacing={2}
          value={[...(shapeOpen ? ["shape"] : []), ...(ticketOpen ? ["ticket"] : [])]}
        >
          <ToggleGroupItem aria-label="The shape" title="The shape" value="shape">
            <FileCode2Icon />
          </ToggleGroupItem>
          <ToggleGroupItem aria-label="The ticket" title="The ticket" value="ticket">
            <ImageIcon />
          </ToggleGroupItem>
        </ToggleGroup>

        <div className="flex min-w-0 flex-1">
          {/* The same three-column workspace `metadata-form` builds, and the same mechanism the
              workspace showcase's dock uses — there is no `Workspace` component in the library, only
              `Resizable` over Shell regions. Keyed on the open set so the panel model re-inits
              cleanly. Logical throughout: start/end, never left/right. */}
          {(() => {
            const columnIds = [
              ...(shapeOpen ? (["shape"] as const) : []),
              "table",
              ...(ticketOpen ? (["ticket"] as const) : []),
            ] as ("shape" | "table" | "ticket")[];

            const tableMain = (
              <ShellMain className="min-w-0 bg-background p-0">
                <Show
                  fallback={
                    <div className="grid h-full place-items-center p-8">
                      <FileUpload
                        accept="image/*"
                        className="w-full max-w-xl"
                        maxFiles={12}
                        onFileAccept={(d) => onFiles(d.files)}
                      >
                        <FileUploadDropzone className="py-16">
                          <UploadIcon aria-hidden className="size-6" />
                          <p className="font-medium text-foreground text-sm">
                            Drop the photos of the tickets
                          </p>
                          <p className="text-xs">
                            One photo may hold several tickets; each one becomes a row.
                          </p>
                          <FileUploadTrigger asChild>
                            <Button className="mt-2" size="sm" variant="outline">
                              <ImageIcon />
                              Choose photos
                            </Button>
                          </FileUploadTrigger>
                        </FileUploadDropzone>
                        <FileUploadHiddenInput />
                        <p className="mt-3 text-center text-muted-foreground text-xs">
                          Or use{" "}
                          <Button
                            className="h-auto p-0 text-xs"
                            onClick={() => setShots([SAMPLE])}
                            variant="link"
                          >
                            the sample photo
                          </Button>{" "}
                          — five tickets, two of them partly unreadable.
                        </p>
                      </FileUpload>
                    </div>
                  }
                  when={shots.length > 0}
                >
                  <Show fallback={<PhotoTray shots={shots} />} when={rows.length > 0}>
                    <DataTableRoot table={table}>
                      <div className="flex h-full min-h-0 flex-col">
                        <DataTableToolbar className="shrink-0 border-b px-3 py-1.5">
                          {/* The global filter, not a column's: a reviewer holding a piece of
                              paper searches for whatever is printed on it — a ticket number, a
                              plate — and does not know which column it will land in. */}
                          <DataTableSearch className="h-7 w-48" placeholder="Find a ticket…" />
                          {/* One per closed vocabulary the shape declares, and none if it declares
                              none. `sh:in` is the option list. */}
                          {columns
                            .filter((column) => column.options)
                            .map((column) => (
                              <DataTableFacetFilter
                                className="h-7"
                                column={column.key}
                                key={column.key}
                                label={column.label}
                              />
                            ))}
                          {/* Seven columns in a pane somebody else's dock is squeezing. The
                              projection decides which columns EXIST; this decides which of them
                              this reader is looking at, which is a different question. */}
                          <DataTableViewOptions className="ms-auto" />
                        </DataTableToolbar>

                        <ScrollArea className="min-h-0 flex-1">
                          {/* `[&_td]:p-0`, and it is the one thing this call site overrides: the
                              cells hold an `Input` each, and a padded cell around a bordered-none
                              input reads as a form in a table rather than as a sheet you type in.
                              `stickyHeader` with no `maxHeight` pins the header to the enclosing
                              scroller, which is this `ScrollArea`. */}
                          <DataTableContent<Row>
                            className="rounded-none border-0 [&_td]:p-0 [&_td]:align-middle"
                            empty="Nothing read yet."
                            onRowClick={(row) => table.setRowSelection({ [row.id]: true })}
                            stickyHeader
                          />

                          <div className="flex items-center gap-2 p-2">
                            <Button
                              onClick={() => {
                                added.current += 1;
                                const id = `manual-${added.current}`;
                                setRows((prev) => [
                                  ...prev,
                                  blankRow(id, columns.map((c) => c.key)),
                                ]);
                                // A row typed by hand used to arrive with no paper at all, which
                                // is the one place this screen stopped being about the paper next
                                // to the number. It opens the pane in drawing mode instead, so the
                                // first thing the reader does is say which piece of paper it is.
                                table.setRowSelection({ [id]: true });
                                if (shots.length) setDrawing(id);
                              }}
                              size="sm"
                              variant="ghost"
                            >
                              <PlusIcon />
                              Row by hand
                            </Button>
                            <Show when={streaming}>
                              <span className="flex items-center gap-2 text-muted-foreground text-xs">
                                <Spinner className="size-3" />
                                Reading…
                              </span>
                            </Show>
                          </div>
                        </ScrollArea>
                      </div>
                    </DataTableRoot>
                  </Show>
                </Show>
              </ShellMain>
            );

            // No aside open → the table owns the body and no splitter is needed.
            if (columnIds.length === 1) return tableMain;

            const columnNode = (id: (typeof columnIds)[number]) => {
              if (id === "table") return tableMain;
              if (id === "shape") {
                return (
                  <ShellAside
                    aria-label="The shape"
                    className="min-h-0 flex-1 border-e-0 bg-card"
                    side="start"
                  >
                    <PaneHeader
                      icon={FileCode2Icon}
                      title="The shape"
                      tone={shapeError ? "destructive" : "success"}
                      // Short enough to survive a narrow pane: the header is one line and the
                      // pane is the one a reader squeezes first.
                      detail={shapeError ?? `${columns.length} columns`}
                    />
                    {/* CodeMirror-backed, so it comes from the `/editor` subpath and never the root
                        barrel — a static import of an optional peer there breaks `import { Button }`
                        for everyone who did not install it. */}
                    {/* `wrap={false}`: a shape is read down its indentation — `sh:path`,
                        `sh:name`, `sh:datatype` line up under the `sh:property [` that opens the
                        block, and a reflowed URI breaks that column. Sideways scrolling costs a
                        gesture; a wrapped list costs the structure. */}
                    <CodeEditor
                      chrome={false}
                      className="min-h-0 flex-1 text-[11px]"
                      extensions={TURTLE}
                      invalid={Boolean(shapeError)}
                      lineNumbers
                      onChange={setShapeText}
                      value={shapeText}
                      wrap={false}
                    />
                  </ShellAside>
                );
              }
              return (
                <ShellAside
                  aria-label="The ticket"
                  className="min-h-0 flex-1 border-s-0 bg-card"
                  side="end"
                >
                  <PaneHeader
                    icon={ImageIcon}
                    title="The ticket"
                    tone={
                      selectedRow && issues.some((i) => i.rowId === selectedRow.id)
                        ? "destructive"
                        : "info"
                    }
                    detail={
                      selectedRow
                        ? `row ${rows.findIndex((r) => r.id === selectedRow.id) + 1} of ${rows.length}`
                        : "nothing selected"
                    }
                  />
                  <ScrollArea className="min-h-0 flex-1">
                    <div className="space-y-3 p-3">
                      <Show
                        fallback={
                          <p className="text-muted-foreground text-sm">
                            Pick a row to see the paper it came from.
                          </p>
                        }
                        when={Boolean(selectedRow)}
                      >
                        {drawing && drawing === selected && sheet ? (
                          /* The mode the reader asked for, and the only one where the pane is a
                             control. It replaces the figure rather than sitting beside it: two
                             copies of the same photograph, one of them live, is the arrangement
                             that makes a reader wonder which box counts. */
                          <DrawBox
                            onCancel={() => setDrawing(null)}
                            onSave={(crop) => {
                              setCrops((prev) => ({ ...prev, [drawing]: { shot: sheet.id, crop } }));
                              setDrawing(null);
                              setWhole(true);
                            }}
                            shot={sheet}
                          />
                        ) : selected && selectedCrop ? (
                          /* The paper, and the one question a thumbnail cannot answer: WHERE on
                             the photograph this came from. Pressing the cut swaps it for the whole
                             sheet with the box drawn on it — the same gesture a map gives you, and
                             nothing on it moves. It is a `figure`, so the caption belongs to the
                             image rather than floating under it. */
                          <figure className="space-y-1.5">
                            <Show
                              fallback={
                                <button
                                  className="block w-full cursor-zoom-in overflow-hidden rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
                                  onClick={() => setWhole(true)}
                                  type="button"
                                >
                                  <Ticket crop={selectedCrop.crop} shot={selectedCrop.shot} />
                                </button>
                              }
                              when={whole}
                            >
                              <Sheet crop={selectedCrop.crop} shot={selectedCrop.shot} />
                            </Show>
                            {/* What you are looking at first, and only then which file it came
                                from: the pane is the narrow one, and it is the file name that can
                                afford to be cut. */}
                            <figcaption className="flex items-center gap-1.5 text-muted-foreground text-xs">
                              <Show
                                fallback={<span className="shrink-0">the ticket</span>}
                                when={whole}
                              >
                                <Button
                                  className="shrink-0 px-1.5 font-normal text-muted-foreground text-xs"
                                  onClick={() => setWhole(false)}
                                  size="sm"
                                  variant="ghost"
                                >
                                  back to the cut
                                </Button>
                                <Button
                                  className="shrink-0 px-1.5 font-normal text-muted-foreground text-xs"
                                  onClick={() => setDrawing(selected)}
                                  size="sm"
                                  variant="ghost"
                                >
                                  redraw the box
                                </Button>
                              </Show>
                              <span className="min-w-0 truncate" title={selectedCrop.shot.name}>
                                · {selectedCrop.shot.name}
                              </span>
                            </figcaption>
                          </figure>
                        ) : null}
                        {/* The whole record, not the broken part of it. A panel that listed only
                            the findings could not answer "what did it read here?", which is the
                            question somebody holding the paper actually has — and it made a clean
                            ticket show an empty pane.

                            `DataList` is Shark's, adopted the day this became its second renderer;
                            the messages live INSIDE the value, because a `dl > div` may hold
                            nothing but `dt` and `dd`. */}
                        {selectedRow ? (
                          <DataList orientation="vertical">
                            {columns.map((column) => {
                              const cellIssues = issuesAt(selectedRow.id, column.key);
                              const cellMeta = meta[selectedRow.id]?.[column.key];
                              const value = selectedRow.cells[column.key] ?? "";
                              const unsure =
                                Boolean(value) && (cellMeta?.confidence ?? 1) < UNSURE;
                              return (
                                <DataListItem className="gap-0.5 py-0" key={column.key}>
                                  <DataListItemLabel className="flex items-center gap-1.5 text-xs">
                                    {column.label}
                                    <Show when={cellIssues.length > 0 || unsure}>
                                      <AlertTriangleIcon
                                        aria-hidden
                                        className={cn(
                                          "size-3",
                                          cellIssues.length ? "text-destructive" : "text-warning",
                                        )}
                                      />
                                    </Show>
                                  </DataListItemLabel>
                                  <DataListItemValue
                                    className={cn(
                                      "break-all",
                                      column.type !== "string" && "tabular-nums",
                                      !value && "text-muted-foreground",
                                    )}
                                  >
                                    {value || "—"}
                                    {cellIssues.map((issue, i) => (
                                      <span
                                        className="mt-0.5 block text-destructive text-xs"
                                        key={i}
                                      >
                                        {issue.message}
                                      </span>
                                    ))}
                                    <Show when={Boolean(cellMeta?.note)}>
                                      <span className="mt-0.5 block text-muted-foreground text-xs">
                                        {cellMeta?.note}
                                      </span>
                                    </Show>
                                  </DataListItemValue>
                                </DataListItem>
                              );
                            })}
                          </DataList>
                        ) : null}
                      </Show>
                    </div>
                  </ScrollArea>
                </ShellAside>
              );
            };

            const panels = columnIds.map((id) => ({ id, minSize: id === "table" ? 34 : 18 }));
            const defaultSize =
              columnIds.length === 3
                ? [30, 42, 28]
                : columnIds[0] === "table"
                  ? [70, 30]
                  : [34, 66];

            return (
              <Resizable defaultSize={defaultSize} key={columnIds.join("-")} panels={panels}>
                {columnIds.map((id, i) => (
                  <Fragment key={id}>
                    <Show when={i > 0}>
                      <ResizableResizeTrigger id={`${columnIds[i - 1]}:${id}`} withHandle />
                    </Show>
                    <ResizablePanel className="flex min-w-0 flex-col overflow-hidden" id={id}>
                      {columnNode(id)}
                    </ResizablePanel>
                  </Fragment>
                ))}
              </Resizable>
            );
          })()}
        </div>
      </ShellBody>

      <ShellFooter className="flex h-8 flex-row items-center gap-3 px-4 text-muted-foreground text-xs">
        <Show when={Boolean(boot)}>
          <span className="text-destructive">The shape did not load: {boot}</span>
        </Show>
        <span>
          {rows.length} {rows.length === 1 ? "row" : "rows"}
        </span>
        <Show when={shots.length > 0}>
          <Separator className="h-3" orientation="vertical" />
          <span>
            {shots.length} {shots.length === 1 ? "photo" : "photos"}
          </span>
        </Show>
        <Show when={Boolean(engine.error)}>
          <Separator className="h-3" orientation="vertical" />
          <span className="text-destructive">{engine.error}</span>
        </Show>
      </ShellFooter>

      {/* The library's own FAB, bottom-end, which is where a preference belongs: it is not one of
          this screen's verbs, and in `SectionActions` it stood beside two that are. */}
      <ReceiptsPreferences
        apiKey={apiKey}
        onApiKey={(key) => {
          setApiKey(key);
          writeKey(key);
          if (!key) setSource("recorded");
        }}
      />
    </ShellRoot>
  );
}

/**
 * One line of pane chrome: what this pane is, and one fact about its state.
 *
 * A dot rather than a coloured word, because the word is already the name of the pane — `Status`
 * is `aria-hidden` and the detail beside it carries the meaning in text, which is 1.4.1 satisfied
 * by construction rather than by a second sentence somewhere.
 */
function PaneHeader({
  detail,
  icon: Icon,
  title,
  tone,
}: {
  detail: string;
  icon: typeof FileCode2Icon;
  title: string;
  tone: "destructive" | "info" | "success";
}) {
  return (
    <div className="flex h-9 shrink-0 items-center gap-2 border-b px-3">
      <Icon aria-hidden className="size-3.5 text-muted-foreground" />
      <span className="font-medium text-xs">{title}</span>
      <span className="ms-auto flex min-w-0 items-center gap-1.5">
        <Status
          className="size-1.5"
          variant={tone === "destructive" ? "destructive" : tone === "success" ? "success" : "info"}
        />
        <span className="truncate text-muted-foreground text-xs" title={detail}>
          {detail}
        </span>
      </span>
    </div>
  );
}

/**
 * The photographs, before anything has been read out of them.
 *
 * This state did not exist: uploading went straight to an empty table, and `Extract` quietly fell
 * back to the sample photo when nothing had been dropped. Showing the paper first is also what
 * makes the button honest — you can see what it is about to read.
 */
function PhotoTray({ shots }: { shots: Shot[] }) {
  return (
    <ScrollArea className="h-full">
      <div className="space-y-3 p-4">
        <p className="text-muted-foreground text-xs">
          {shots.length} {shots.length === 1 ? "photograph" : "photographs"}, not read yet. Every
          ticket in {shots.length === 1 ? "it" : "them"} becomes a row.
        </p>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(12rem,1fr))]">
          {shots.map((shot) => (
            <figure className="min-w-0 space-y-1.5" key={shot.id}>
              <img
                alt=""
                className="w-full rounded-md border bg-muted object-cover"
                src={shot.src}
              />
              <figcaption className="truncate text-muted-foreground text-xs" title={shot.name}>
                {shot.name}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}

export default ReceiptsShowcase;
