"use client";

// Photos in, a spreadsheet out — and one SHACL document deciding what "a spreadsheet" means.
//
// The arrangement is three panes: the shape, the ledger being filled, and the slip the selected
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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Button,
  ButtonGroup,
  ButtonGroupText,
  cn,
  DataList,
  DataListItem,
  DataListItemLabel,
  DataListItemValue,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  ScrollArea,
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
} from "@kanzo-tech/ui";
import {
  useAiStream,
} from "@kanzo-tech/ai";
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
  CropIcon,
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
import {
  type Finding,
  FindingsBadge,
  PaneHeader,
  PanelRail,
  WorkspaceColumns,
} from "../shared";
import { FieldNotesPreferences } from "./preferences";
import { openLedger, type Column, type Issue, type Ledger, type Row } from "./rudof";
import { SHAPES, SLIP_SHAPE } from "./shape";

/** Turtle, through CodeMirror's legacy stream parser. `extensions` is the seam for a language
 *  brain, and this is defined at module scope so the editor never reconfigures its compartment. */
const TURTLE = StreamLanguage.define(turtle);

/** What extraction said about one cell, beside what it said the cell IS. */
interface CellMeta {
  confidence: number;
  note?: string;
}

type MetaMap = Record<string, Record<string, CellMeta>>;

/** Below this a cell is drawn as unsure.
 *
 *  It was 0.9, and at 0.9 every ink cell on the screen wore a warning: the model reports 0.83–0.89
 *  for handwriting it read perfectly well, so the mark said "this is handwriting" rather than
 *  "check this". 0.75 leaves the two the run is genuinely unsure about — a beast under a mug at
 *  0.61 and a surname that admits two spellings at 0.63 — and nothing else. */
const UNSURE = 0.75;

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

/** One slip, cut out of the photograph it was found in.
 *
 *  ONE framing, and there were two: this used to take a `head` prop that squared the box and showed
 *  the top of the slip, on the grounds that the annotation was up there. It is not — the ink is in
 *  the middle of these slips — and the cost was that the same slip was a different picture in the
 *  ledger than in the panel. A thumbnail and a detail differ in SIZE.
 *
 *  The offsets are a `translate`, not `top`/`left`: a percentage inset resolves against the
 *  CONTAINER, and a percentage translate resolves against the IMAGE, which is the thing being
 *  moved. Physical directions on purpose — a photograph does not mirror in RTL. */
function Slip({ className, crop, shot }: { className?: string; crop: Crop; shot: Shot }) {
  const aspect = useAspect(shot.src);

  return (
    <div
      className={cn("relative overflow-hidden rounded-md border bg-muted", className)}
      style={aspect ? { aspectRatio: (crop.w * aspect) / crop.h } : undefined}
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
 *  reads as a different slip being chosen. Correcting it is {@link DrawBox}, which is a mode the
 *  reader asks for.
 *
 *  Percentages, because the crop is fractions of the image and the box is the image. `--brand`
 *  through the graph's own rule: a selection is a selection. */
function Sheet({ className, crop, shot }: { className?: string; crop: Crop; shot: Shot }) {
  const aspect = useAspect(shot.src);

  return (
    <div
      className={cn("relative overflow-hidden rounded-md border bg-muted", className)}
      style={{ aspectRatio: aspect ?? undefined }}
    >
      <img alt="" className="block size-full object-contain" src={shot.src} />
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
 * The paper, in the order the questions come.
 *
 * The whole photograph with the box drawn on it answers WHICH slip this row is — a thing you point
 * at, not a thing you read — and the cut answers what it says. So the sheet is what sits there and
 * the cut is a hover away, at the same height, which is one gesture rather than a caption and a
 * mode. Both are the same technique underneath: the crop is fractions of the image, so the box is
 * a percentage inset on the sheet and a percentage translate on the cut.
 *
 * The group is NAMED and the caller owns it: the panel puts `group/paper` on the figure so an edit
 * button can share the same hover, and the ledger puts it on the cell so a row's other columns do
 * not trigger it. An anonymous `group` here would take whichever ancestor happened to have one.
 */
function PaperPreview({
  className,
  crop,
  shot,
}: {
  className?: string;
  crop: Crop;
  shot: Shot;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-md border bg-muted", className)}>
      <Sheet
        className="size-full rounded-none border-0 transition-opacity group-hover/paper:opacity-0 motion-reduce:transition-none!"
        crop={crop}
        shot={shot}
      />
      <span className="absolute inset-0 flex items-center justify-center bg-muted opacity-0 transition-opacity group-hover/paper:opacity-100 motion-reduce:transition-none!">
        <Slip className="h-full w-auto max-w-full rounded-none border-0" crop={crop} shot={shot} />
      </span>
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
 * that moves is the box. That is the answer to a box that seemed to be choosing a different slip,
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
  className,
  onCancel,
  onSave,
  shot,
}: {
  className?: string;
  onCancel: () => void;
  onSave: (crop: Crop) => void;
  shot: Shot;
}) {
  const aspect = useAspect(shot.src);
  const frame = useRef<HTMLDivElement>(null);
  const drawn = useRef<Crop | null>(null);

  return (
    <div className={cn("flex min-h-0 w-full flex-col gap-1.5", className)}>
      {/* TWO boxes, and the space under the picture was what happens with one.
          The outer takes whatever height the dialog gives it; the inner IS the picture — the
          photograph's own ratio against that height, centred. It was a single box carrying both
          jobs: stretched by `flex-1` to fill the dialog and then sized again by the cropper's own
          aspect inside it, which left the difference as dead paper under the image. */}
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <Show when={aspect !== null}>
          <ImageCropper
            // `w-auto` is load-bearing: the recipe ships `w-full`, and a box with a definite
            // width AND a definite height ignores its `aspect-ratio` — the frame took the whole
            // dialog and the photograph sat letterboxed inside it, which also breaks the
            // arithmetic below, because a viewport wider than the picture is no longer the
            // picture's own box.
            className="h-full w-auto max-w-full overflow-hidden rounded-md border bg-muted"
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
      <ButtonGroup aria-label="What to do with the box you drew" className="mx-auto">
        <Button
          onClick={() => {
            const box = drawn.current;
            if (box) onSave(box);
          }}
          size="sm"
        >
          Keep this box
        </Button>
        <Button onClick={onCancel} size="sm" variant="outline">
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
  /** Whether this cell has been typed in. See the note on `touched` — a finding shows on a cell
   *  the reader has touched, and everywhere else it waits to be asked for. */
  touched: (rowId: string, key: string) => boolean;
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
  /** A finding is drawn where the reader has been; the badge is how they ask for the rest. */
  const revealed = ledger.touched(row.id, column.key);
  const unsure = Boolean(value) && (cellMeta?.confidence ?? 1) < UNSURE;
  // A sheet, not a form. Every control here is flush with its cell and carries no chrome of its
  // own until it is focused — a bordered box in each of thirty-five cells reads as a form somebody
  // has to fill in, and this is a ledger somebody is checking.
  //
  // `ring-inset` on the invalid state is not cosmetic: an outset ring is drawn OUTSIDE the cell,
  // so six of them overlap their neighbours and the table looks broken rather than the cells
  // looking wrong.
  const shared = cn(
    "h-8 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-inset",
    // The ring AND the ink are gated on `touched` — see the note there. `Input`'s recipe turns an
    // invalid value red as well as ringing it, and red text in a cell nobody asked about is the
    // same unasked-for second voice the ring was. A hairline where the recipe's ring is three
    // pixels, because a field carries one invalid state and a ledger carries six at once.
    revealed
      ? "aria-invalid:ring-1 aria-invalid:ring-inset"
      : "aria-invalid:text-foreground aria-invalid:ring-0 dark:aria-invalid:text-foreground",
  );
  // `NativeSelect` hands `className` to its WRAPPER, so nothing above reaches the control: the
  // border, the radius and the shadow are on the `select` inside it and have to be addressed there.
  const quietSelect = cn(
    "h-8 w-full",
    "[&_select]:h-8 [&_select]:rounded-none [&_select]:border-0 [&_select]:bg-transparent [&_select]:shadow-none",
    revealed
      ? "[&_select]:aria-invalid:ring-1 [&_select]:aria-invalid:ring-inset"
      : "[&_select]:aria-invalid:ring-0",
  );
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
          data-unread={value ? undefined : true}
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
        className={quietSelect}
        data-unread={value ? undefined : true}
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
      // NOT `"slip"`. A column id has to be unique across the table, and the ids on the right of
      // this list are the shape's own local names — `gs:slip` projects to `slip`, so the thumbnail
      // collided with the slip number: two columns and two header cells answering to one key,
      // which React reported as duplicate children and TanStack keyed one visibility flag for
      // both. A colon cannot occur in an XML local name, so no shape can reach this one.
      id: "kanzo:paper",
      enableHiding: false,
      header: () => <span className="sr-only">The slip</span>,
      cell: ({ row, table }) => {
        const found = metaOf(table.options.meta).cropOf(row.original.id);
        // `m-1.5` because the cells are `p-0` — that override is for the editable ones, whose
        // `Input` has to fill its cell, and the paper is the one cell that wants air.
        return found ? (
          <span className="group/paper m-1.5 block h-10 w-[3.25rem]">
            <PaperPreview className="size-full" crop={found.crop} shot={found.shot} />
          </span>
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

export function FieldNotesShowcase() {
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
  const [slipOpen, setSlipOpen] = useState(true);
  /** Whether the sheet is open in the viewer, where the paper is big enough to read. */
  const [viewing, setViewing] = useState(false);
  /** The row whose box is being drawn, and the only state that turns the pane into a control. */
  const [drawing, setDrawing] = useState<string | null>(null);
  /** Which tally the reader pressed, if any: its cells are marked where they are. */
  const [marking, setMarking] = useState<"unread" | "violations" | null>(null);
  const [shapeText, setShapeText] = useState(SLIP_SHAPE);
  const [shapeError, setShapeError] = useState<string | null>(null);

  const engine = useAiStream<ExtractEvent>("Could not read the photo");
  /**
   * The boxes the reader drew, and the reason a second run does not take them back.
   *
   * `Extract again` re-reads the photographs, and the model reports its own box for every row it
   * finds — including the rows somebody has already corrected by hand. Overwriting those is the
   * one thing a re-run must not do: the reader's box is the only piece of this screen the machine
   * did not produce. A ref rather than state because `apply` reads it inside the stream loop and
   * must not be rebuilt mid-run.
   */
  const handDrawn = useRef<Set<string>>(new Set());
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

  /**
   * Which cells the reader has typed in, and it decides where a finding is DRAWN.
   *
   * The table used to ring every invalid cell the moment it arrived, so a screen with six findings
   * spoke about them in two languages at once: six red boxes that nobody asked for, and a badge
   * that marks the same six when pressed. One of them had to go, and it is the automatic one —
   * `metadata-form` settled this on the form side and the rule is the same here: a finding shows
   * on a cell the reader has TOUCHED, because there it is feedback on what they just typed, and
   * everywhere else it waits for the badge. The `aria-invalid` attribute is on the control either
   * way; it is the ring that is gated, not the state.
   */
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());

  const edit = useCallback((rowId: string, key: string, value: string) => {
    setTouched((prev) => (prev.has(`${rowId}:${key}`) ? prev : new Set(prev).add(`${rowId}:${key}`)));
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, cells: { ...r.cells, [key]: value } } : r)),
    );
  }, []);

  /**
   * The two tallies, as lists rather than as numbers.
   *
   * `unread` is what the MODEL could not read and `violations` is what the SHAPE refuses, and they
   * are not the same set: a cell nobody could read is usually both, and a slip number typed wrong
   * by hand is only the second. Each finding carries the row's position in the ledger, because
   * "row 4" is how a reader holding the paper finds it again.
   */
  const unread = useMemo<Finding[]>(
    () =>
      rows.flatMap((row, index) =>
        columns
          .filter((column) => !row.cells[column.key])
          .map((column) => ({
            message: meta[row.id]?.[column.key]?.note ?? "Not read.",
            where: `row ${index + 1} · ${column.label}`,
          })),
      ),
    [columns, meta, rows],
  );

  const violations = useMemo<Finding[]>(
    () =>
      issues.map((issue) => ({
        message: issue.message,
        where: `row ${rows.findIndex((r) => r.id === issue.rowId) + 1} · ${
          columns.find((c) => c.key === issue.key)?.label ?? issue.key
        }`,
      })),
    [columns, issues, rows],
  );

  const defs = useMemo(() => ledgerColumns(columns), [columns]);

  /**
   * Single selection, and it is the TABLE's rather than a second copy beside it. `getRowId` makes
   * the selection key the row's own id, so `data-state="selected"` — which `DataTableContent`
   * already writes — is the highlight, and the slip pane reads the same one value.
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
      touched: (rowId, key) => touched.has(`${rowId}:${key}`),
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


  // The first row to arrive is the one the slip pane shows, so the pane is never empty while
  // the table is filling. Later rows do not steal it — that would move the paper under the reader.
  useEffect(() => {
    const first = rows[0];
    if (!selected && first) table.setRowSelection({ [first.id]: true });
  }, [rows, selected, table]);

  const apply = useCallback((event: ExtractEvent) => {
    if (event.kind === "row") {
      setCrops((prev) =>
        handDrawn.current.has(event.rowId)
          ? prev
          : { ...prev, [event.rowId]: { shot: event.shot, crop: event.crop } },
      );
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
    // Everything the machine said goes; everything the reader drew stays.
    setCrops((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([id]) => handDrawn.current.has(id))),
    );
    table.resetRowSelection();
    void engine.run((signal) => extractor(shots, signal), apply);
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
  const streaming = engine.status === "loading";
  const blanks = unread.length;

  return (
    <ShellRoot className="h-dvh">
      {/*
        ONE row, and it was two.

        The old arrangement was `metadata-form`'s: a `h-9` utility strip and then a page header
        with a `scale="page"` title under it — 86 px of chrome over a screen whose every other
        surface is `text-xs`, and the word "Field notes" printed twice inside it. What a header
        owes here is the landmark, the verbs and the verdict; the size of the type was carrying
        none of that.

        The shape switcher went with it, into the pane it governs. A control that replaces the
        document one pane is editing belongs against that document, not against the page — and
        with it gone the row fits its verbs without crowding.
      */}
      <ShellHeader>
        <div className="flex h-11 items-center gap-2.5 px-3 text-xs">
          <ScanTextIcon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
          <h1 className="shrink-0 font-heading font-medium text-sm">Field notes</h1>

          {/* Without a key there is no choice to make, and a two-option control that can only land
              on one of them is a lie — so what is left is a statement of fact: this is the demo
              run. The moment a key exists the choice does too, and the segments come back. */}
          {/* With no key there is no choice to make, and what is left is a statement of fact — so it
              is not a control and does not stand among them. It is a watermark in the status strip;
              see the footer. The moment a key exists the CHOICE exists too, and the segments come
              back here, where the verbs are. */}
          <Show fallback={null} when={Boolean(apiKey)}>
            <SegmentGroup
              className="ms-auto shrink-0"
              onValueChange={(d) => setSource(d.value ?? "recorded")}
              value={source}
            >
              <SegmentGroupIndicator />
              <SegmentGroupItem value="recorded">
                <SegmentGroupItemText>Demo run</SegmentGroupItemText>
              </SegmentGroupItem>
              <SegmentGroupItem value="live">
                <SegmentGroupItemText>Live model</SegmentGroupItemText>
              </SegmentGroupItem>
            </SegmentGroup>
          </Show>

          {/* Where the screen's verbs live, and its verdict beside them. The validation badges were
              in the footer, three regions away from the thing they judge; here they sit next to the
              button that would hand somebody the file they are a verdict on. */}
          {/* `ms-auto` lives HERE and not on whatever happens to be to the left of it. It used to
              sit on the demo badge, so the day that badge became a watermark in the footer the
              whole row of verbs slid over against the title. A row's end is a property of the row,
              not of its last optional child. */}
          <div className="ms-auto flex shrink-0 items-center gap-2">
            {/* Both tallies stand from the first row to the last, at zero as much as at eleven.
                They used to appear and disappear as the stream crossed zero and the digits grew,
                so the verbs beside them shuffled sideways on almost every event — the one moment
                the screen is being watched is the one moment it was moving. `FindingsBadge`
                disables itself at zero and pins the number's width. */}
            <Show when={rows.length > 0}>
              <FindingsBadge
                active={marking === "unread"}
                findings={unread}
                label="unread"
                onToggle={() => setMarking((m) => (m === "unread" ? null : "unread"))}
                summary="Cells the model would not guess at, and why."
                tone="warning"
              />
              <FindingsBadge
                active={marking === "violations"}
                findings={violations}
                label="violations"
                onToggle={() => setMarking((m) => (m === "violations" ? null : "violations"))}
                summary="What the shape refuses, straight out of the SHACL validator."
                tone="destructive"
              />
              <Show when={issues.length === 0 && blanks === 0 && !streaming}>
                <Badge pill size="xs" variant="success">
                  Valid
                </Badge>
              </Show>
            </Show>

            {/* The verb stands alone, and it was inside the download group.
                One `ButtonGroup` around «Extract | Download | CSV | Turtle» draws one bordered
                control, and a bordered control means its parts belong together — but the run and
                the file are the two ends of the screen, not two settings of one thing. Worse, the
                only solid button on the page was welded to two outline ones, so the group's own
                seam had to carry a change of variant it was never drawn for. */}
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
                  // The verb changes once there is a ledger to lose, because the same press does a
                  // different thing: a second run REPLACES what is on screen, corrections and
                  // hand-drawn boxes included. Saying so on the button is cheaper than an undo
                  // nobody would find.
                  title={
                    rows.length
                      ? "Read the photographs again. This replaces every row on screen, including anything corrected by hand."
                      : "Read the photographs"
                  }
                >
                  <ScanTextIcon />
                  {rows.length ? "Extract again" : "Extract"}
                </Button>
              }
              when={streaming}
            >
              <Button className="gap-1.5" onClick={() => engine.cancel()} size="sm" variant="outline">
                <SquareIcon />
                Stop
              </Button>
            </Show>

            <ButtonGroup aria-label="The sheet">
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
          </div>
        </div>
      </ShellHeader>

      <ShellBody className="min-h-0">
        <PanelRail
          label="Panels"
          onValueChange={(value) => {
            setShapeOpen(value.includes("shape"));
            setSlipOpen(value.includes("slip"));
          }}
          panels={[
            { icon: FileCode2Icon, label: "The shape", value: "shape" },
            { icon: ImageIcon, label: "The slip", value: "slip" },
          ]}
          value={[...(shapeOpen ? ["shape"] : []), ...(slipOpen ? ["slip"] : [])]}
        />

        <div className="flex min-w-0 flex-1">
          {/* The same three-column workspace `metadata-form` builds, and the same mechanism the
              workspace showcase's dock uses — there is no `Workspace` component in the library, only
              `Resizable` over Shell regions. Keyed on the open set so the panel model re-inits
              cleanly. Logical throughout: start/end, never left/right. */}
          {(() => {
            const columnIds = [
              ...(shapeOpen ? (["shape"] as const) : []),
              "table",
              ...(slipOpen ? (["slip"] as const) : []),
            ] as ("shape" | "table" | "slip")[];

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
                            Drop the photographs of the slips
                          </p>
                          <p className="text-xs">
                            One photograph may hold several slips; each one becomes a row.
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
                          — five slips, three of them partly unreadable.
                        </p>
                      </FileUpload>
                    </div>
                  }
                  when={shots.length > 0}
                >
                  <Show fallback={<PhotoTray shots={shots} />} when={rows.length > 0}>
                    <DataTableRoot table={table}>
                      <div className="flex h-full min-h-0 flex-col">
                        <DataTableToolbar className="h-9 shrink-0 border-b px-3 py-0">
                          {/* The global filter, not a column's: a reviewer holding a piece of
                              paper searches for whatever is written on it — a slip number, a
                              hunter's name — and does not know which column it will land in. */}
                          <DataTableSearch className="h-7 w-48" placeholder="Find a slip…" />
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
                          {/* Pressing a tally MARKS its cells where they are; it does not filter
                              the ledger down to them. Answering "which ones" by removing "out of
                              what" is the wrong trade in a sheet somebody is checking.

                              The mark is a wash on the cell, keyed off attributes the cell already
                              writes — `aria-invalid` is what the shape refused, `data-unread` is
                              what the model would not guess at. No second copy of either list
                              reaches the table, and nothing here has to agree with the badge about
                              which cells they are. */}
                          <DataTableContent<Row>
                            className={cn(
                              "rounded-none border-0 [&_td]:p-0 [&_td]:align-middle",
                              marking === "unread" &&
                                "[&_td:has([data-unread])]:bg-warning-a3 [&_td:has([data-unread])]:ring-1 [&_td:has([data-unread])]:ring-warning-a6 [&_td:has([data-unread])]:ring-inset",
                              marking === "violations" &&
                                "[&_td:has([aria-invalid=true])]:bg-destructive-a3 [&_td:has([aria-invalid=true])]:ring-1 [&_td:has([aria-invalid=true])]:ring-destructive-a6 [&_td:has([aria-invalid=true])]:ring-inset",
                            )}
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
                                if (shots.length) {
                                  setDrawing(id);
                                  setViewing(true);
                                }
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
                      actions={
                        <>
                      {/* An empty value is not a third shape — it is what the select shows once
                          the text stops matching either document, which is the first keystroke a
                          reader types into the editor below. */}
                      <NativeSelect
                        aria-label="Example shape"
                        className="w-44 shrink-0"
                        onChange={(e) => {
                          const picked = SHAPES.find((sh) => sh.id === e.target.value);
                          if (picked) setShapeText(picked.source);
                        }}
                        size="sm"
                        value={SHAPES.find((sh) => sh.source === shapeText)?.id ?? ""}
                      >
                        <NativeSelectOption value="">Edited shape</NativeSelectOption>
                        {SHAPES.map((sh) => (
                          <NativeSelectOption key={sh.id} value={sh.id}>
                            {sh.label}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                        </>
                      }
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
                  aria-label="The slip"
                  className="min-h-0 flex-1 border-s-0 bg-card"
                  side="end"
                >
                  <PaneHeader
                    icon={ImageIcon}
                    title="The slip"
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
                        {selected && selectedCrop ? (
                          /* THE WHOLE PHOTOGRAPH, with the box drawn on it — and the cut on hover.
                             That order is the answer to the question the panel is asked: "which
                             slip is this row" is a thing you point at on the sheet, and the cut
                             alone says what it says but never where.

                             Two things live on the hover, and they are two different verbs. The
                             picture is a button and opens the CUT at full size, which is the
                             reading gesture. `Edit` is a button of its own, positioned over the
                             corner rather than nested inside the other one — a button inside a
                             button is invalid markup and the inner one is what a screen reader
                             announces — and it goes straight to the cropper. */
                          <figure className="group/paper relative">
                            <button
                              className="block w-full cursor-zoom-in overflow-hidden rounded-lg shadow-sm outline-none ring-1 ring-border focus-visible:ring-[3px] focus-visible:ring-ring"
                              onClick={() => setViewing(true)}
                              title="Open the cut"
                              type="button"
                            >
                              <PaperPreview
                                className="rounded-none border-0"
                                crop={selectedCrop.crop}
                                shot={selectedCrop.shot}
                              />
                            </button>
                            <Button
                              className="absolute end-2 bottom-2 opacity-0 shadow-sm transition-opacity focus-visible:opacity-100 group-hover/paper:opacity-100 motion-reduce:transition-none!"
                              onClick={() => {
                                setDrawing(selected);
                                setViewing(true);
                              }}
                              size="sm"
                              variant="secondary"
                            >
                              <CropIcon />
                              Edit the box
                            </Button>
                          </figure>
                        ) : null}
                        {/* The whole record, not the broken part of it. A panel that listed only
                            the findings could not answer "what did it read here?", which is the
                            question somebody holding the paper actually has — and it made a clean
                            slip show an empty pane.

                            `DataList` is Shark's, adopted the day this became its second renderer;
                            the messages live INSIDE the value, because a `dl > div` may hold
                            nothing but `dt` and `dd`. */}
                        {selectedRow ? (
                          <DataList className="min-w-0 flex-1">
                            {columns.map((column) => {
                              const cellIssues = issuesAt(selectedRow.id, column.key);
                              const cellMeta = meta[selectedRow.id]?.[column.key];
                              const value = selectedRow.cells[column.key] ?? "";
                              const unsure =
                                Boolean(value) && (cellMeta?.confidence ?? 1) < UNSURE;
                              return (
                                <DataListItem
                                  className="items-start gap-3 border-border/64 border-b py-1.5 last:border-0"
                                  key={column.key}
                                >
                                  <DataListItemLabel className="w-20 shrink-0 pt-0.5 text-xs">
                                    {column.label}
                                  </DataListItemLabel>
                                  <DataListItemValue
                                    className={cn(
                                      "min-w-0 flex-1 break-words",
                                      column.type !== "string" && "tabular-nums",
                                      !value && "text-muted-foreground",
                                      unsure &&
                                        "underline decoration-warning decoration-dotted decoration-2 underline-offset-4",
                                    )}
                                  >
                                    {value || "—"}
                                    {/* A finding and a note are two different claims about the
                                        same cell — the shape refusing it, and the model saying why
                                        it could not read it — so they are drawn as two different
                                        marks rather than as two colours of the same one. Both live
                                        INSIDE the value, because a `dl > div` may hold nothing but
                                        `dt` and `dd`. */}
                                    {cellIssues.map((issue, i) => (
                                      <span
                                        className="mt-1 flex items-start gap-1.5 text-destructive text-xs"
                                        key={i}
                                      >
                                        <Status className="mt-1 size-1.5" variant="destructive" />
                                        {issue.message}
                                      </span>
                                    ))}
                                    <Show when={Boolean(cellMeta?.note)}>
                                      <span className="mt-1 flex items-start gap-1.5 text-muted-foreground text-xs">
                                        <Status className="mt-1 size-1.5" variant="warning" />
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

            return (
              <WorkspaceColumns
                columns={columnIds.map((id) => ({
                  id,
                  minSize: id === "table" ? 34 : 18,
                  node: columnNode(id),
                }))}
                defaultSize={
                  columnIds.length === 3
                    ? [30, 42, 28]
                    : columnIds[0] === "table"
                      ? [70, 30]
                      : [34, 66]
                }
              />
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
        {/* The watermark. It was a `Badge` in the header, in the row where `Extract` and the
            downloads live, and a fact does not belong among verbs — a pill up there reads as
            something you can press. Here it is what it is: small, quiet, at the far end of the
            strip that already says how many rows and how many photographs. */}
        <Show when={!apiKey}>
          <span
            className="ms-auto shrink-0 text-[0.625rem] text-muted-foreground/64 uppercase tracking-[0.2em]"
            title="A recorded run of a real extraction, replayed. Paste your Anthropic key in Preferences to run the model live."
          >
            demo run
          </span>
        </Show>
      </ShellFooter>

      {/*
        The sheet, at a size a person can read — and the one place drawing a box makes sense.

        The panel is 414 px wide and a slip is a fifth as wide as it is tall, so nothing that fits
        in that column answers "does the paper say what the row says". This does: the whole
        photograph at up to a 7xl dialog, with the row's box drawn on it, and `Redraw` swaps the
        picture for the cropper in the same frame rather than sending the reader back to the pane.

        THE FRAME IS FIXED, and that is what `h-[86vh]` is doing. `Redraw` swaps a picture for a
        cropper of a different natural height, and a dialog that sizes to its content jumps a
        hundred pixels and re-centres itself under the pointer that pressed the button — the box
        you were about to drag moves before you reach it. So the dialog claims its height once and
        both states fill it; only the picture inside changes.
      */}
      <Dialog onOpenChange={(d) => !d.open && (setViewing(false), setDrawing(null))} open={viewing}>
        <Show when={Boolean(sheet)}>
          <DialogContent className="flex h-[86vh] flex-col p-0" size="6xl">
            <DialogHeader className="border-b px-4 py-2.5">
              <DialogTitle className="font-heading text-sm">
                {drawing ? "Draw the box" : "The slip"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {drawing
                  ? "Drag the box onto the slip this row was read from."
                  : selectedRow
                    ? `Row ${rows.findIndex((r) => r.id === selectedRow.id) + 1} of ${rows.length} · ${sheet?.name}`
                    : sheet?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
              {drawing && sheet ? (
                <DrawBox
                  className="size-full"
                  onCancel={() => setDrawing(null)}
                  onSave={(crop) => {
                    handDrawn.current.add(drawing);
                    setCrops((prev) => ({ ...prev, [drawing]: { shot: sheet.id, crop } }));
                    setDrawing(null);
                  }}
                  shot={sheet}
                />
              ) : selectedCrop ? (
                /* The CUT, at the size the panel could not give it. The panel already answers
                   "where on the sheet" — it stands there with the box drawn on the photograph —
                   so what is left for the viewer is the paper itself, big enough to read, framed
                   the way it is framed everywhere else. The sheet comes back the moment the
                   reader presses `Redraw the box`, because placing a box needs the whole
                   photograph and reading one does not. */
                <Slip
                  className="h-full w-auto max-w-full shadow-sm"
                  crop={selectedCrop.crop}
                  shot={selectedCrop.shot}
                />
              ) : null}
            </div>
            <Show when={!drawing && Boolean(selected)}>
              <DialogFooter className="border-t px-4 py-2.5">
                <Button onClick={() => setDrawing(selected)} size="sm" variant="outline">
                  <CropIcon />
                  Redraw the box
                </Button>
              </DialogFooter>
            </Show>
          </DialogContent>
        </Show>
      </Dialog>

      {/* The library's own FAB, bottom-end, which is where a preference belongs: it is not one of
          this screen's verbs, and in the header it stood beside two that are. */}
      <FieldNotesPreferences
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
/**
 * The photographs, before anything has been read out of them.
 *
 * This state did not exist: uploading went straight to an empty table, and `Extract` quietly fell
 * back to the sample photo when nothing had been dropped. Showing the paper first is also what
 * makes the button honest — you can see what it is about to read.
 */
/**
 * One uploaded photograph, in a box the same size as every other one.
 *
 * Two things were wrong and they are not the same thing. The frame used to be `object-COVER` into
 * whatever height the grid gave it, which CROPS the picture to fit — so the tray showed a
 * photograph the panel would then show differently. And when the frame took each image's own
 * aspect instead, the grid stopped being a grid: twelve photographs at twelve heights read as a
 * pile. A gallery wants one box; a picture wants its own rectangle. `object-contain` in a fixed
 * `4/3` box gives both — every tile is the same size and nothing is cut.
 */
function ShotThumb({ shot }: { shot: Shot }) {
  return (
    <figure className="min-w-0 space-y-1.5">
      <div className="aspect-[4/3] overflow-hidden rounded-md border bg-muted">
        <img alt="" className="block size-full object-contain" src={shot.src} />
      </div>
      <figcaption className="truncate text-muted-foreground text-xs" title={shot.name}>
        {shot.name}
      </figcaption>
    </figure>
  );
}

function PhotoTray({ shots }: { shots: Shot[] }) {
  return (
    <ScrollArea className="h-full">
      <div className="space-y-3 p-4">
        <p className="text-muted-foreground text-xs">
          {shots.length} {shots.length === 1 ? "photograph" : "photographs"}, not read yet. Every
          slip in {shots.length === 1 ? "it" : "them"} becomes a row.
        </p>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(14rem,1fr))]">
          {shots.map((shot) => (
            <ShotThumb key={shot.id} shot={shot} />
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}

export default FieldNotesShowcase;
