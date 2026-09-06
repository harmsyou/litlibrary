import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Paper, Topic } from "@/lib/db";
import { POSITION_DEFS, STANDING_DEFS, shortAuthors } from "@/lib/paper-analysis";
import { useAnalyzePaper } from "@/lib/useAnalyzePaper";
import { cn } from "@/lib/utils";

type SortKey = "title" | "authors" | "field" | "standing" | "position" | "created";

const STANDING_ORDER = ["Foundational", "Established", "Recent", "Preprint-fresh"];
const POSITION_ORDER = ["Consensus", "Extends", "Contrarian", "Tangential"];

export function PaperTable({
  papers,
  topicsByPaper,
}: {
  papers: Paper[];
  topicsByPaper: Map<string, Topic[]>;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "created", dir: -1 });
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const analyze = useAnalyzePaper();

  const sorted = useMemo(() => {
    const v = (p: Paper): string | number => {
      switch (sort.key) {
        case "title":
          return p.title.toLowerCase();
        case "authors":
          return shortAuthors(p.authors).toLowerCase();
        case "field":
          return p.field ?? "~";
        case "standing":
          return p.standing ? STANDING_ORDER.indexOf(p.standing) : 99;
        case "position":
          return p.position ? POSITION_ORDER.indexOf(p.position) : 99;
        default:
          return p.created_at;
      }
    };
    return [...papers].sort((a, b) => {
      const x = v(a), y = v(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [papers, sort]);

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "created" ? -1 : 1 }));

  const runOne = async (p: Paper) => {
    setBusy((s) => new Set(s).add(p.id));
    await analyze(p, { overwriteIdentity: !p.authors.trim() });
    setBusy((s) => {
      const n = new Set(s);
      n.delete(p.id);
      return n;
    });
  };

  const missing = papers.filter((p) => p.analysis_status !== "done" && p.analysis_status !== "running");

  const Head = ({ k, label, tip, className }: { k: SortKey; label: string; tip?: string; className?: string }) => {
    const active = sort.key === k;
    const btn = (
      <button
        type="button"
        onClick={() => toggle(k)}
        className={cn(
          "label-mono inline-flex items-center gap-1 whitespace-nowrap transition-colors hover:text-foreground",
          active && "text-foreground",
        )}
      >
        {label}
        <span className={cn("text-[9px]", !active && "opacity-0")}>{sort.dir === 1 ? "↑" : "↓"}</span>
      </button>
    );
    return (
      <th scope="col" className={cn("py-2 pr-4 text-left font-normal", className)}>
        {tip ? (
          <Tooltip>
            <TooltipTrigger asChild>{btn}</TooltipTrigger>
            <TooltipContent side="bottom" align="start" className="max-w-xs whitespace-pre-line text-left">
              {tip}
            </TooltipContent>
          </Tooltip>
        ) : (
          btn
        )}
      </th>
    );
  };

  const defs = (d: Record<string, string>) =>
    Object.entries(d)
      .map(([k, v]) => `${k} — ${v}`)
      .join("\n");

  return (
    <TooltipProvider delayDuration={200}>
      {missing.length > 0 && (
        <p className="pt-3 text-xs text-muted-foreground">
          {missing.length} paper{missing.length > 1 ? "s" : ""} without a full card.{" "}
          <button
            type="button"
            className="underline underline-offset-4 hover:text-foreground"
            onClick={async () => {
              for (const p of missing) await runOne(p);
            }}
          >
            Analyze missing
          </button>
        </p>
      )}
      <table className="mt-1 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            <Head k="title" label="Paper" className="w-[38%]" />
            <Head k="authors" label="Authors" />
            <Head k="field" label="Field" />
            <Head k="standing" label="Standing" tip={defs(STANDING_DEFS)} />
            <Head k="position" label="Position" tip={defs(POSITION_DEFS)} className="pr-0" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => {
            const ts = topicsByPaper.get(p.id) ?? [];
            const pending = p.analysis_status === "running" || busy.has(p.id);
            const dim = "text-muted-foreground/60 italic";
            return (
              <tr key={p.id} className="group border-b border-border align-top transition-colors hover:bg-accent/60">
                <td className="py-3.5 pr-4">
                  <Link to="/papers/$id" params={{ id: p.id }} className="block">
                    <span className="text-[15px] font-medium leading-snug group-hover:underline group-hover:underline-offset-4">
                      {p.title}
                    </span>
                    <span className="label-mono ml-2 normal-case tracking-normal">{p.year ?? ""}</span>
                  </Link>
                  {p.question ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-muted-foreground">{p.question}</p>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" align="start" className="max-w-sm">
                        <p>{p.question}</p>
                        {p.summary && <p className="mt-1 opacity-70">{p.summary}</p>}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <p className={cn("mt-1 text-[13px]", dim)}>
                      {pending ? "Analyzing…" : p.analysis_status === "failed" ? "Analysis failed" : "Not analyzed"}
                      {!pending && (
                        <>
                          {" · "}
                          <button type="button" className="not-italic underline underline-offset-4" onClick={() => runOne(p)}>
                            Analyze
                          </button>
                        </>
                      )}
                    </p>
                  )}
                  {ts.length > 0 && (
                    <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                      {ts.map((t) => (
                        <span key={t.id} className="label-mono normal-case tracking-normal">
                          # {t.name}
                        </span>
                      ))}
                    </p>
                  )}
                </td>
                <td className="py-3.5 pr-4 text-[13px]">
                  {p.authors ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="whitespace-nowrap">{shortAuthors(p.authors)}</span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" align="start" className="max-w-sm">
                        {p.authors}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className={dim}>{pending ? "…" : "—"}</span>
                  )}
                </td>
                <td className="py-3.5 pr-4">
                  <span className="label-mono whitespace-nowrap text-foreground">{p.field ?? (pending ? "…" : "—")}</span>
                </td>
                <td className="py-3.5 pr-4">
                  <Verdict value={p.standing} reason={p.standing_reason} pending={pending} />
                </td>
                <td className="py-3.5">
                  <Verdict value={p.position} reason={p.position_reason} pending={pending} flag={p.position === "Contrarian"} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TooltipProvider>
  );
}

function Verdict({ value, reason, pending, flag }: { value: string | null; reason: string | null; pending: boolean; flag?: boolean }) {
  if (!value) return <span className="label-mono text-muted-foreground/60">{pending ? "…" : "—"}</span>;
  const inner = (
    <span className="label-mono inline-flex items-center gap-1.5 whitespace-nowrap text-foreground">
      {flag && <span aria-hidden className="inline-block size-1.5 rounded-full bg-mark-strong" />}
      {value}
    </span>
  );
  if (!reason) return inner;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{inner}</TooltipTrigger>
      <TooltipContent side="bottom" align="start" className="max-w-xs">
        {reason}
      </TooltipContent>
    </Tooltip>
  );
}
