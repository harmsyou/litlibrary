import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createHighlight,
  deleteHighlight,
  getPaperUrl,
  updateHighlight,
  updatePaper,
  type Highlight,
  type HighlightRect,
  type Paper,
  type Topic,
} from "@/lib/db";
import { Markdown } from "@/components/MarkdownEditor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

const MARGIN_W = 264; // comment column width
const GAP = 24;
const NONE = "__none__";
const PENDING = "__pending__";
const CARD_GAP = 8;
const DEFAULT_H = 64;
const CLUSTER_H = 40;
const CLUSTER_RANGE = 24; // px: anchors closer than this belong to the same cluster
const CLUSTER_MIN = 3;

type Props = {
  paper: Paper;
  topics: Topic[];
  highlights: Highlight[];
  activeTopicId: string | null;
  focusedId: string | null;
  onFocus: (id: string | null) => void;
};

type PendingSelection = {
  page: number;
  rects: HighlightRect[];
  quote: string;
  anchorTop: number; // px within pages container
};

type Unit =
  | { kind: "item"; id: string; anchor: number; h: Highlight }
  | { kind: "cluster"; id: string; anchor: number; items: { h: Highlight; anchor: number }[] }
  | { kind: "pending"; id: string; anchor: number };

/** Two-directional stacking: the priority card sits at its anchor, others are pushed away from it. */
function layoutCallouts(units: Unit[], heights: Map<string, number>, priorityId: string | null) {
  const h = (u: Unit) => heights.get(u.id) ?? (u.kind === "cluster" ? CLUSTER_H : DEFAULT_H);
  const tops = units.map((u) => u.anchor);
  if (!units.length) return tops;
  let p = units.findIndex((u) => u.id === priorityId);
  if (p < 0) p = 0;
  tops[p] = units[p]!.anchor;
  for (let i = p + 1; i < units.length; i++) {
    tops[i] = Math.max(units[i]!.anchor, tops[i - 1]! + h(units[i - 1]!) + CARD_GAP);
  }
  for (let i = p - 1; i >= 0; i--) {
    tops[i] = Math.min(units[i]!.anchor, tops[i + 1]! - h(units[i]!) - CARD_GAP);
  }
  const min = Math.min(...tops);
  if (min < 0) for (let i = 0; i < tops.length; i++) tops[i] = tops[i]! - min;
  return tops;
}

export default function PdfReader({ paper, topics, highlights, activeTopicId, focusedId, onFocus }: Props) {
  const qc = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const pageEls = useRef(new Map<number, HTMLDivElement>());
  const [numPages, setNumPages] = useState(0);
  const [fitWidth, setFitWidth] = useState(600);
  const [zoom, setZoom] = useState(1);
  const pageWidth = Math.round(fitWidth * zoom);
  const [layout, setLayout] = useState<Record<number, { top: number; height: number }>>({});
  const [pending, setPending] = useState<PendingSelection | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [openCluster, setOpenCluster] = useState<string | null>(null);

  const { data: url, error: urlError } = useQuery({
    queryKey: ["paper", paper.id, "url", paper.file_path],
    queryFn: () => getPaperUrl(paper.file_path),
    staleTime: 1000 * 60 * 60 * 5,
  });

  // Fit page width to available space
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth - MARGIN_W - GAP * 3;
      setFitWidth(Math.max(320, Math.min(860, w)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Measure page positions (for callouts)
  const measure = useCallback(() => {
    const container = pagesRef.current;
    if (!container) return;
    const base = container.getBoundingClientRect().top;
    const next: Record<number, { top: number; height: number }> = {};
    pageEls.current.forEach((el, n) => {
      const r = el.getBoundingClientRect();
      next[n] = { top: r.top - base, height: r.height };
    });
    setLayout(next);
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [numPages, pageWidth, measure]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["paper", paper.id, "highlights"] });
  const invalidateAll = () => {
    invalidate();
    qc.invalidateQueries({ queryKey: ["links"] });
    qc.invalidateQueries({ queryKey: ["topic"] });
  };

  const create = useMutation({
    mutationFn: createHighlight,
    onSuccess: (h) => {
      setPending(null);
      onFocus(h.id);
      invalidateAll();
    },
    onError: (e) => toast.error(e.message),
  });
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateHighlight>[1] }) => updateHighlight(id, patch),
    onSuccess: invalidateAll,
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: deleteHighlight,
    onSuccess: () => {
      onFocus(null);
      invalidateAll();
    },
    onError: (e) => toast.error(e.message),
  });

  // Selection → pending highlight
  const onMouseUp = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const startEl = (range.startContainer.nodeType === 3 ? range.startContainer.parentElement : (range.startContainer as Element)) as
      | Element
      | null;
    const pageEl = startEl?.closest<HTMLElement>("[data-page-number]");
    if (!pageEl || !pagesRef.current) return;
    const page = Number(pageEl.dataset['pageNumber']);
    const pr = pageEl.getBoundingClientRect();
    const rects: HighlightRect[] = [];
    for (const r of Array.from(range.getClientRects())) {
      if (r.width < 1 || r.height < 1) continue;
      // ignore rects outside this page
      if (r.top < pr.top - 2 || r.bottom > pr.bottom + 2) continue;
      const rect = {
        x: (r.left - pr.left) / pr.width,
        y: (r.top - pr.top) / pr.height,
        w: r.width / pr.width,
        h: r.height / pr.height,
      };
      // merge near-duplicate rects (text layer spans often overlap)
      const dup = rects.find((o) => Math.abs(o.y - rect.y) < 0.002 && Math.abs(o.x - rect.x) < 0.002 && Math.abs(o.w - rect.w) < 0.002);
      if (!dup) rects.push(rect);
    }
    if (!rects.length) return;
    const quote = sel.toString().replace(/\s+/g, " ").trim();
    if (!quote) return;
    const base = pagesRef.current.getBoundingClientRect().top;
    setPending({ page, rects, quote, anchorTop: pr.top - base + (rects[0]?.y ?? 0) * pr.height });
    onFocus(null);
  };

  // Scroll to focused highlight (deep link)
  const didScroll = useRef<string | null>(null);
  useEffect(() => {
    if (!focusedId || didScroll.current === focusedId) return;
    const h = highlights.find((x) => x.id === focusedId);
    const l = layout[h?.page ?? -1];
    if (!h || !l || !scrollRef.current) return;
    const rects = h.rects as HighlightRect[];
    const y = l.top + (rects[0]?.y ?? 0) * l.height;
    scrollRef.current.scrollTo({ top: Math.max(0, y - 160), behavior: "smooth" });
    didScroll.current = focusedId;
  }, [focusedId, highlights, layout]);

  const byPage = useMemo(() => {
    const m = new Map<number, Highlight[]>();
    for (const h of highlights) (m.get(h.page) ?? m.set(h.page, []).get(h.page)!).push(h);
    return m;
  }, [highlights]);

  const cardHeights = useRef(new Map<string, number>());
  const [, force] = useState(0);
  const onMeasure = useCallback((id: string, h: number) => {
    if (cardHeights.current.get(id) !== h) {
      cardHeights.current.set(id, h);
      force((x) => x + 1);
    }
  }, []);

  const expandedId = focusedId; // hover must never re-flow the column
  const priorityId = pending ? PENDING : expandedId;

  // Build units (single cards, clusters, and the pending box) in anchor order
  const units = useMemo<Unit[]>(() => {
    const items = highlights
      .map((h) => {
        const l = layout[h.page];
        if (!l) return null;
        const rects = h.rects as HighlightRect[];
        return { h, anchor: l.top + (rects[0]?.y ?? 0) * l.height };
      })
      .filter(Boolean) as { h: Highlight; anchor: number }[];
    items.sort((a, b) => a.anchor - b.anchor);

    const groups: { h: Highlight; anchor: number }[][] = [];
    for (const it of items) {
      const g = groups[groups.length - 1];
      if (g && Math.abs(it.anchor - g[0]!.anchor) < CLUSTER_RANGE) g.push(it);
      else groups.push([it]);
    }

    const out: Unit[] = [];
    for (const g of groups) {
      const clusterId = "cluster-" + g[0]!.h.id;
      const active = openCluster === clusterId || g.some((x) => x.h.id === expandedId);
      if (g.length >= CLUSTER_MIN && !active) {
        out.push({ kind: "cluster", id: clusterId, anchor: g[0]!.anchor, items: g });
      } else {
        for (const x of g) out.push({ kind: "item", id: x.h.id, anchor: x.anchor, h: x.h });
      }
    }
    if (pending) out.push({ kind: "pending", id: PENDING, anchor: pending.anchorTop });
    out.sort((a, b) => a.anchor - b.anchor);
    return out;
  }, [highlights, layout, expandedId, openCluster, pending]);

  const tops = useMemo(() => layoutCallouts(units, cardHeights.current, priorityId), [units, priorityId, cardHeights.current.size, force]);

  // Keep the box you're writing in on screen
  const pendingKey = pending ? `${pending.page}:${pending.anchorTop}` : null;
  const scrolledPending = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingKey || scrolledPending.current === pendingKey) return;
    const i = units.findIndex((u) => u.kind === "pending");
    const el = scrollRef.current;
    if (i < 0 || !el) return;
    const top = tops[i] ?? 0;
    const visTop = el.scrollTop;
    const visBottom = visTop + el.clientHeight;
    if (top < visTop + 60 || top + 220 > visBottom) {
      el.scrollTo({ top: Math.max(0, top - 120), behavior: "smooth" });
    }
    scrolledPending.current = pendingKey;
  }, [pendingKey, units, tops]);

  const topicName = (id: string | null) => topics.find((t) => t.id === id)?.name ?? null;

  if (urlError) {
    return <div className="p-8 text-sm text-destructive">Couldn't load the PDF: {urlError.message}</div>;
  }

  return (
    <div
      ref={scrollRef}
      className="relative h-full overflow-auto"
      onMouseDown={(e) => {
        // click on empty space clears focus
        if ((e.target as HTMLElement).closest("[data-callout],[data-highlight],[data-popover]")) return;
        onFocus(null);
        setOpenCluster(null);
      }}
    >
      <div
        data-popover
        className="sticky top-3 z-20 float-right mr-3 flex items-center gap-0.5 rounded-lg border border-border bg-background/95 px-1 py-0.5 backdrop-blur"
      >
        <button
          type="button"
          aria-label="Zoom out"
          disabled={zoom <= 0.6}
          onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.1).toFixed(2)))}
          className="flex size-7 items-center justify-center rounded-md text-base text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40"
        >
          −
        </button>
        <button
          type="button"
          aria-label="Reset zoom"
          onClick={() => setZoom(1)}
          className="label-mono min-w-11 text-center hover:text-foreground"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          aria-label="Zoom in"
          disabled={zoom >= 2}
          onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))}
          className="flex size-7 items-center justify-center rounded-md text-base text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40"
        >
          +
        </button>
      </div>
      <div ref={pagesRef} className="relative mx-auto" style={{ width: pageWidth + MARGIN_W + GAP, padding: `${GAP}px 0` }}>
        <div style={{ width: pageWidth }} onMouseUp={onMouseUp}>
          {url && (
            <Document
              file={url}
              loading={<div className="label-mono p-8">Rendering…</div>}
              error={<div className="p-8 text-sm text-destructive">This PDF could not be rendered.</div>}
              onLoadSuccess={({ numPages }) => {
                setNumPages(numPages);
                if (paper.page_count !== numPages) updatePaper(paper.id, { page_count: numPages }).catch(() => {});
              }}
            >
              {Array.from({ length: numPages }, (_, i) => i + 1).map((n) => (
                <div
                  key={n}
                  data-page-number={n}
                  ref={(el) => {
                    if (el) pageEls.current.set(n, el);
                    else pageEls.current.delete(n);
                  }}
                  className="relative mb-4 shadow-[0_0_0_1px_var(--color-border)]"
                >
                  <Page
                    pageNumber={n}
                    width={pageWidth}
                    renderAnnotationLayer={false}
                    renderTextLayer
                    onRenderSuccess={measure}
                    loading={<div style={{ width: pageWidth, height: pageWidth * 1.3 }} className="bg-white" />}
                  />
                  {/* Highlights */}
                  <div className="pointer-events-none absolute inset-0">
                    {(byPage.get(n) ?? []).map((h) =>
                      (h.rects as HighlightRect[]).map((r, i) => (
                        <div
                          key={h.id + i}
                          data-highlight
                          onMouseEnter={() => setHovered(h.id)}
                          onMouseLeave={() => setHovered(null)}
                          onClick={(e) => {
                            e.stopPropagation();
                            onFocus(h.id);
                          }}
                          className={cn(
                            "pointer-events-auto absolute cursor-pointer bg-mark mix-blend-multiply transition-opacity",
                            focusedId === h.id || hovered === h.id ? "opacity-100" : "opacity-60",
                          )}
                          style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }}
                        />
                      )),
                    )}
                    {pending?.page === n &&
                      pending.rects.map((r, i) => (
                        <div
                          key={"p" + i}
                          className="absolute bg-mark-strong/50 mix-blend-multiply"
                          style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }}
                        />
                      ))}
                  </div>
                </div>
              ))}
            </Document>
          )}
        </div>

        {/* Margin column */}
        <div className="absolute top-0" style={{ left: pageWidth + GAP, width: MARGIN_W, height: "100%" }}>
          {units.map((u, i) => {
            const top = tops[i] ?? u.anchor;
            const offset = u.anchor - top;
            if (u.kind === "pending") {
              if (!pending) return null;
              return (
                <NewCommentBox
                  key={u.id}
                  top={top}
                  offset={offset}
                  quote={pending.quote}
                  topics={topics}
                  defaultTopicId={activeTopicId}
                  busy={create.isPending}
                  onMeasure={(hgt) => onMeasure(PENDING, hgt)}
                  onCancel={() => setPending(null)}
                  onSave={(comment, topicId) =>
                    create.mutate({
                      paper_id: paper.id,
                      topic_id: topicId,
                      page: pending.page,
                      rects: pending.rects,
                      quote: pending.quote,
                      comment_md: comment,
                    })
                  }
                />
              );
            }
            if (u.kind === "cluster") {
              return (
                <ClusterMarker
                  key={u.id}
                  top={top}
                  count={u.items.length}
                  page={u.items[0]!.h.page}
                  onMeasure={(hgt) => onMeasure(u.id, hgt)}
                  onOpen={() => {
                    setOpenCluster(u.id);
                    onFocus(u.items[0]!.h.id);
                  }}
                />
              );
            }
            const h = u.h;
            return (
              <Callout
                key={h.id}
                highlight={h}
                top={top}
                offset={offset}
                topics={topics}
                topicName={topicName(h.topic_id)}
                focused={focusedId === h.id}
                hovered={hovered === h.id}
                onHover={setHovered}
                onFocus={() => onFocus(h.id)}
                onMeasure={(hgt) => onMeasure(h.id, hgt)}
                onSave={(patch) => update.mutate({ id: h.id, patch })}
                onDelete={() => remove.mutate(h.id)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Line from the highlight anchor to the card, drawn even when the card is displaced. */
function Connector({ offset, height, visible }: { offset: number; height: number; visible: boolean }) {
  const y = Math.min(Math.max(offset, 6), Math.max(height - 6, 6));
  const from = Math.min(y, 16);
  const to = Math.max(y, 16);
  return (
    <span
      aria-hidden
      className={cn("pointer-events-none absolute transition-opacity", visible ? "opacity-100" : "opacity-0")}
      style={{ left: -GAP, top: 0, width: GAP }}
    >
      <span className="absolute h-px bg-mark-strong" style={{ top: y, left: 0, width: GAP / 2 }} />
      <span className="absolute w-px bg-mark-strong" style={{ left: GAP / 2, top: from, height: Math.max(1, to - from) }} />
      <span className="absolute h-px bg-mark-strong" style={{ top: 16, left: GAP / 2, width: GAP / 2 }} />
    </span>
  );
}

function TopicPicker({
  topics,
  value,
  onChange,
}: {
  topics: Topic[];
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
      <SelectTrigger className="h-7 w-full border-0 bg-muted px-2 text-xs shadow-none focus:ring-0 focus-visible:ring-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>No topic</SelectItem>
        {topics.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            {t.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ClusterMarker({
  top,
  count,
  page,
  onMeasure,
  onOpen,
}: {
  top: number;
  count: number;
  page: number;
  onMeasure: (h: number) => void;
  onOpen: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    if (ref.current) onMeasure(ref.current.offsetHeight);
  });
  return (
    <button
      ref={ref}
      type="button"
      data-callout
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      onMouseDown={(e) => e.stopPropagation()}
      className="absolute left-0 right-0 z-0 flex items-center justify-between rounded-xl border border-border/70 bg-popover px-3 py-2 text-left shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-colors hover:border-border"
      style={{ top }}
    >
      <span className="label-mono normal-case tracking-normal">{count} comments here</span>
      <span className="label-mono shrink-0">p. {page}</span>
    </button>
  );
}

function NewCommentBox({
  top,
  offset,
  quote,
  topics,
  defaultTopicId,
  busy,
  onSave,
  onCancel,
  onMeasure,
}: {
  top: number;
  offset: number;
  quote: string;
  topics: Topic[];
  defaultTopicId: string | null;
  busy: boolean;
  onSave: (comment: string, topicId: string | null) => void;
  onCancel: () => void;
  onMeasure: (h: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [comment, setComment] = useState("");
  const [topicId, setTopicId] = useState<string | null>(defaultTopicId);
  useLayoutEffect(() => {
    if (ref.current) onMeasure(ref.current.offsetHeight);
  });
  return (
    <div
      ref={ref}
      data-popover
      className="absolute left-0 right-0 z-30 rounded-xl border border-mark-strong/50 bg-popover p-3.5 shadow-[0_4px_16px_rgba(0,0,0,0.12)]"
      style={{ top }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Connector offset={offset} height={ref.current?.offsetHeight ?? 160} visible />
      <p className="label-mono mb-2">New comment</p>
      <p className="mb-2 line-clamp-3 border-l-2 border-mark-strong pl-2 text-xs leading-relaxed text-muted-foreground">{quote}</p>
      <textarea
        autoFocus
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onSave(comment, topicId);
          if (e.key === "Escape") onCancel();
        }}
        placeholder="Your comment (markdown ok)…"
        rows={3}
        className="w-full resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted-foreground/60"
      />
      <div className="mt-2 space-y-2">
        <div>
          <p className="label-mono mb-1">Route to topic</p>
          <TopicPicker topics={topics} value={topicId} onChange={setTopicId} />
        </div>
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" disabled={busy} onClick={() => onSave(comment, topicId)}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

function firstLine(md: string) {
  return md
    .replace(/[#>*_`]/g, "")
    .split("\n")
    .map((l) => l.trim())
    .find(Boolean);
}

function Callout({
  highlight: h,
  top,
  offset,
  topics,
  topicName,
  focused,
  hovered,
  onHover,
  onFocus,
  onMeasure,
  onSave,
  onDelete,
}: {
  highlight: Highlight;
  top: number;
  offset: number;
  topics: Topic[];
  topicName: string | null;
  focused: boolean;
  hovered: boolean;
  onHover: (id: string | null) => void;
  onFocus: () => void;
  onMeasure: (h: number) => void;
  onSave: (patch: { comment_md?: string; topic_id?: string | null }) => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(h.comment_md);
  const expanded = focused || hovered;

  useLayoutEffect(() => {
    if (ref.current) onMeasure(ref.current.offsetHeight);
  });

  useEffect(() => {
    if (!focused) setEditing(false);
  }, [focused]);

  const preview = firstLine(h.comment_md) ?? `“${h.quote}”`;

  return (
    <div
      ref={ref}
      data-callout
      onMouseEnter={() => onHover(h.id)}
      onMouseLeave={() => onHover(null)}
      onClick={onFocus}
      className={cn(
        "absolute left-0 right-0 cursor-pointer rounded-xl border bg-popover p-3.5 text-sm transition-[transform,box-shadow,border-color] duration-200",
        focused
          ? "z-20 -translate-x-3 border-mark-strong/60 shadow-[0_4px_16px_rgba(0,0,0,0.12)]"
          : hovered
            ? "z-10 -translate-x-1 border-border shadow-[0_2px_10px_rgba(0,0,0,0.08)]"
            : "z-0 border-border/70 shadow-[0_1px_3px_rgba(0,0,0,0.05)]",
      )}
      style={{ top }}
    >
      <Connector offset={offset} height={ref.current?.offsetHeight ?? DEFAULT_H} visible={expanded || Math.abs(offset) > 4} />
      <div className={cn("flex items-center justify-between gap-2", expanded && "mb-1.5")}>
        <span className="label-mono truncate normal-case tracking-normal">{topicName ? `# ${topicName}` : "No topic"}</span>
        <span className="label-mono shrink-0">p. {h.page}</span>
      </div>

      {!expanded && <p className="line-clamp-1 text-xs leading-relaxed text-muted-foreground">{preview}</p>}

      {expanded && (
        <p className="mb-2 border-l-2 border-mark-strong pl-2 text-xs leading-relaxed text-muted-foreground">{h.quote}</p>
      )}

      {expanded &&
        (editing ? (
          <div onMouseDown={(e) => e.stopPropagation()}>
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  onSave({ comment_md: draft });
                  setEditing(false);
                }
              }}
              rows={3}
              className="w-full resize-none bg-transparent text-sm leading-relaxed outline-none"
            />
            <div className="flex justify-end gap-1">
              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setEditing(false); setDraft(h.comment_md); }}>
                Cancel
              </Button>
              <Button size="sm" onClick={(e) => { e.stopPropagation(); onSave({ comment_md: draft }); setEditing(false); }}>
                Save
              </Button>
            </div>
          </div>
        ) : h.comment_md.trim() ? (
          <Markdown className={cn("mt-1 text-sm", !focused && "line-clamp-4")}>{h.comment_md}</Markdown>
        ) : (
          <p className="mt-1 text-xs italic text-muted-foreground">No comment</p>
        ))}

      {focused && !editing && (
        <div className="mt-3 space-y-2 border-t border-border pt-2" onMouseDown={(e) => e.stopPropagation()}>
          <TopicPicker topics={topics} value={h.topic_id} onChange={(v) => onSave({ topic_id: v })} />
          <div className="flex justify-between">
            <button
              type="button"
              className="label-mono text-destructive hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              Delete
            </button>
            <button
              type="button"
              className="label-mono hover:text-foreground hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                setDraft(h.comment_md);
                setEditing(true);
              }}
            >
              Edit comment
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
