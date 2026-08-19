"use client";

// Photos in, a spreadsheet out — and one SHACL document deciding what "a spreadsheet" means.
//
// The arrangement is three panes: what was uploaded, the ledger being filled, and the ticket the
// selected row was read from. The middle pane is the point. Extraction gets most cells right and
// some cells wrong, and the only version of this screen that is honest about that puts the
// paper next to the number.
//
// The engine behind the stream is `useAiStream` from the library — the same hook `Complete` and
// `Suggest` run on. It is domain-free by construction, so a run of vision events uses it
// unchanged, and this is its second consumer.

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Button,
  ButtonGroup,
  cn,
  DownloadTrigger,
  FileUpload,
  FileUploadDropzone,
  FileUploadHiddenInput,
  FileUploadTrigger,
  Input,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useAiStream,
} from "@kanzo-tech/ui";
// CodeMirror-backed: the `/editor` subpath, never the root barrel.
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
import { liveExtractor, liveReady } from "./live";
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

// ── The ledger ───────────────────────────────────────────────────────────────

function Cell({
  column,
  issues,
  meta,
  onChange,
  value,
}: {
  column: Column;
  issues: Issue[];
  meta?: CellMeta;
  onChange: (value: string) => void;
  value: string;
}) {
  const invalid = issues.length > 0;
  const unsure = Boolean(value) && (meta?.confidence ?? 1) < UNSURE;
  const shared = "h-8 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-inset";
  // `text-decoration` does not render on a <select>, so an unsure option says so in the aside
  // rather than wearing a mark no browser draws.
  const unsureMark =
    "underline decoration-warning decoration-dotted decoration-2 underline-offset-4";

  return (
    <TableCell className="p-0 align-middle">
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
            onChange={(e) => onChange(e.target.value)}
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
          onChange={(e) => onChange(e.target.value)}
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
    </TableCell>
  );
}

// ── The showcase ─────────────────────────────────────────────────────────────

export function ReceiptsShowcase() {
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [boot, setBoot] = useState<string | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [meta, setMeta] = useState<MetaMap>({});
  const [crops, setCrops] = useState<Record<string, { shot: string; crop: Crop }>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [source, setSource] = useState("recorded");
  const [live, setLive] = useState<{ ready: boolean; reason?: string } | null>(null);
  const [shapeOpen, setShapeOpen] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(true);
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

  useEffect(() => {
    const controller = new AbortController();
    void liveReady(controller.signal).then((r) => setLive(r));
    return () => controller.abort();
  }, []);

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

  const apply = useCallback((event: ExtractEvent) => {
    if (event.kind === "row") {
      setCrops((prev) => ({ ...prev, [event.rowId]: { shot: event.shot, crop: event.crop } }));
      setRows((prev) =>
        prev.some((r) => r.id === event.rowId) ? prev : [...prev, { id: event.rowId, cells: {} }],
      );
      setSelected((prev) => prev ?? event.rowId);
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
    () => (source === "live" && live?.ready ? liveExtractor(columns) : recorded),
    [columns, live, source],
  );

  const run = useCallback(() => {
    setRows([]);
    setMeta({});
    setCrops({});
    setSelected(null);
    const shot = shots.length ? shots : [SAMPLE];
    engine.start((signal) => extractor(shot, signal));
    void (async () => {
      for (;;) {
        const event = await engine.next();
        if (event == null) break;
        apply(event);
      }
      engine.idle();
    })();
  }, [apply, engine, extractor, shots]);

  const onFiles = useCallback((files: File[]) => {
    setShots(
      files.map((file, i) => ({
        id: `${file.name}-${i}`,
        name: file.name,
        src: URL.createObjectURL(file),
      })),
    );
  }, []);

  const shotById = useMemo(() => {
    const all = shots.length ? shots : [SAMPLE];
    return new Map(all.map((s) => [s.id, s]));
  }, [shots]);

  const selectedRow = rows.find((r) => r.id === selected) ?? null;
  const selectedCrop = selected ? crops[selected] : undefined;
  const selectedShot = selectedCrop ? shotById.get(selectedCrop.shot) : undefined;

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
  const blanks = rows.reduce(
    (n, r) => n + columns.filter((c) => !r.cells[c.key]).length,
    0,
  );

  return (
    <ShellRoot className="h-dvh">
      {/* The utility strip `metadata-form` uses — h-9 and text-xs, a small icon and the controls.
          A title-and-subtitle block would be a shape no other showcase in this repo has. */}
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

        <SegmentGroup
          className="ms-auto"
          onValueChange={(d) => setSource(d.value ?? "recorded")}
          value={source}
        >
          <SegmentGroupIndicator />
          <SegmentGroupItem value="recorded">
            <SegmentGroupItemText>Recorded</SegmentGroupItemText>
          </SegmentGroupItem>
          <SegmentGroupItem
            disabled={!live?.ready}
            title={live?.ready ? undefined : live?.reason}
            value="live"
          >
            <SegmentGroupItemText>Live model</SegmentGroupItemText>
          </SegmentGroupItem>
        </SegmentGroup>

        <ButtonGroup aria-label="Extraction and export">
          <Show
            fallback={
              <Button className="gap-1.5" disabled={!ledger} onClick={run} size="sm">
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
          {/* One menu, two serialisations of the same graph — the shape of `job-studio`'s save. */}
          <Menu positioning={{ gutter: 4, placement: "bottom-end" }}>
            <MenuTrigger asChild>
              <Button className="gap-1.5" disabled={!rows.length} size="sm" variant="outline">
                <DownloadIcon />
                Export
              </Button>
            </MenuTrigger>
            <MenuContent>
              <DownloadTrigger
                asChild
                data={csv}
                fileName={csvName(columns, rows)}
                mimeType="text/csv"
              >
                <MenuItem value="csv">CSV — the sheet, for Excel</MenuItem>
              </DownloadTrigger>
              <DownloadTrigger
                asChild
                data={turtle}
                fileName={csvName(columns, rows).replace(/\.csv$/, ".ttl")}
                mimeType="text/turtle"
              >
                <MenuItem value="turtle">Turtle — the same rows as a graph</MenuItem>
              </DownloadTrigger>
            </MenuContent>
          </Menu>
        </ButtonGroup>

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

          <SectionActions className="gap-1.5">
            <Button
              className="gap-1.5"
              onClick={() => setShapeOpen((o) => !o)}
              size="sm"
              variant={shapeOpen ? "secondary" : "outline"}
            >
              <FileCode2Icon />
              Shape
            </Button>
            <Button
              className="gap-1.5"
              onClick={() => setTicketOpen((o) => !o)}
              size="sm"
              variant={ticketOpen ? "secondary" : "outline"}
            >
              <ImageIcon />
              Ticket
            </Button>
          </SectionActions>
        </SectionHeader>
      </ShellHeader>

      <ShellBody className="min-h-0">
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
            when={rows.length > 0 || shots.length > 0}
          >
            <ScrollArea className="h-full">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead className="w-14" />
                    {columns.map((column) => (
                      <TableHead
                        key={column.key}
                        // The shape's own `sh:description`. It is what the model is told; showing
                        // it here means the reviewer is told the same thing.
                        title={column.description}
                        className={cn(
                          "whitespace-nowrap",
                          (column.type === "decimal" || column.type === "integer") && "text-end",
                        )}
                      >
                        {column.label}
                        <Show when={column.required}>
                          <span aria-hidden className="ms-0.5 text-destructive">
                            *
                          </span>
                        </Show>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const crop = crops[row.id];
                    const shot = crop ? shotById.get(crop.shot) : undefined;
                    return (
                      <TableRow
                        key={row.id}
                        className={cn(
                          "cursor-pointer",
                          selected === row.id && "bg-accent/48 hover:bg-accent/48",
                        )}
                        onClick={() => setSelected(row.id)}
                      >
                        <TableCell className="p-1">
                          {crop && shot ? (
                            <Ticket className="size-10" crop={crop.crop} head shot={shot} />
                          ) : null}
                        </TableCell>
                        {columns.map((column) => (
                          <Cell
                            key={column.key}
                            column={column}
                            issues={issuesAt(row.id, column.key)}
                            meta={meta[row.id]?.[column.key]}
                            onChange={(value) =>
                              setRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id
                                    ? { ...r, cells: { ...r.cells, [column.key]: value } }
                                    : r,
                                ),
                              )
                            }
                            value={row.cells[column.key] ?? ""}
                          />
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <div className="flex items-center gap-2 p-2">
                <Button
                  onClick={() => {
                    added.current += 1;
                    const id = `manual-${added.current}`;
                    setRows((prev) => [...prev, blankRow(id, columns.map((c) => c.key))]);
                    setSelected(id);
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
                  <div className="flex items-center gap-2 border-b px-3 py-2 text-muted-foreground text-xs">
                    <FileCode2Icon aria-hidden className="size-3.5" />
                    The shape
                    <Show when={Boolean(shapeError)}>
                      <span className="ms-auto text-destructive">{shapeError}</span>
                    </Show>
                  </div>
                  {/* CodeMirror-backed, so it comes from the `/editor` subpath and never the root
                      barrel — a static import of an optional peer there breaks `import { Button }`
                      for everyone who did not install it. */}
                  <CodeEditor
                    chrome={false}
                    className="min-h-0 flex-1 text-[11px]"
                    extensions={TURTLE}
                    invalid={Boolean(shapeError)}
                    lineNumbers
                    onChange={setShapeText}
                    value={shapeText}
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
              <ScrollArea className="h-full">
                <div className="space-y-3 p-3">
                  <Show
                    fallback={
                      <p className="text-muted-foreground text-sm">
                        Pick a row to see the paper it came from.
                      </p>
                    }
                    when={Boolean(selectedRow)}
                  >
                    {selectedRow ? (
                      <ItemGroup className="gap-2">
                        {columns.map((column) => {
                          const cellIssues = issuesAt(selectedRow.id, column.key);
                          const cellMeta = meta[selectedRow.id]?.[column.key];
                          if (!cellIssues.length && !cellMeta?.note) return null;
                          return (
                            <Item key={column.key} variant="outline">
                              <ItemMedia>
                                <AlertTriangleIcon
                                  className={
                                    cellIssues.length ? "text-destructive" : "text-warning"
                                  }
                                />
                              </ItemMedia>
                              <ItemContent>
                                <ItemTitle>{column.label}</ItemTitle>
                                {cellIssues.map((issue, i) => (
                                  <ItemDescription key={i}>{issue.message}</ItemDescription>
                                ))}
                                <Show when={Boolean(cellMeta?.note)}>
                                  <ItemDescription>{cellMeta?.note}</ItemDescription>
                                </Show>
                              </ItemContent>
                              <Show when={Boolean(cellMeta?.note)}>
                                <ItemActions>
                                  <Badge variant="outline">reading</Badge>
                                </ItemActions>
                              </Show>
                            </Item>
                          );
                        })}
                      </ItemGroup>
                    ) : null}
                    {selectedCrop && selectedShot ? (
                      <Ticket crop={selectedCrop.crop} shot={selectedShot} />
                    ) : null}
                  </Show>
                </div>
              </ScrollArea>
              </ShellAside>
            );
          };

          const panels = columnIds.map((id) => ({ id, minSize: id === "table" ? 34 : 16 }));
          const defaultSize =
            columnIds.length === 3
              ? [26, 46, 28]
              : columnIds[0] === "table"
                ? [70, 30]
                : [30, 70];

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
      </ShellBody>
      <ShellFooter className="flex h-8 flex-row items-center gap-3 px-4 text-muted-foreground text-xs">
        <Show when={Boolean(boot)}>
          <span className="text-destructive">The shape did not load: {boot}</span>
        </Show>
        <span>{rows.length} rows</span>
        <Separator className="h-3" orientation="vertical" />
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
        <Show when={issues.length === 0 && rows.length > 0}>
          <Badge pill size="xs" variant="success">
            Valid
          </Badge>
        </Show>
        <Show when={Boolean(engine.error)}>
          <span className="text-destructive">{engine.error}</span>
        </Show>

      </ShellFooter>
    </ShellRoot>
  );
}

export default ReceiptsShowcase;
