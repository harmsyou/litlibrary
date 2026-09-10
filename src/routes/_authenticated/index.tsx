import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { NewTopicDialog } from "@/components/NewTopicDialog";
import { UploadPaperDialog } from "@/components/UploadPaperDialog";
import { PaperTable } from "@/components/PaperTable";
import { DrawingBoard } from "@/components/DrawingBoard";
import { FirstNamePrompt } from "@/components/FirstNamePrompt";
import { useFirstName } from "@/hooks/useFirstName";
import { linksQuery, papersQuery, topicsQuery } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Reading Room — Papers & Topic Notes" },
      { name: "description", content: "A personal research library: annotated papers and centralized notes per topic." },
      { property: "og:title", content: "Reading Room — Papers & Topic Notes" },
      { property: "og:description", content: "A personal research library: annotated papers and centralized notes per topic." },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(topicsQuery()),
      context.queryClient.ensureQueryData(papersQuery()),
      context.queryClient.ensureQueryData(linksQuery()),
    ]),
  errorComponent: ({ error }) => (
    <div role="alert" className="p-8 text-sm text-destructive">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-8 text-sm">Nothing here.</div>,
  component: Index,
});

function Index() {
  const { data: topics } = useSuspenseQuery(topicsQuery());
  const { data: papers } = useSuspenseQuery(papersQuery());
  const { data: links } = useSuspenseQuery(linksQuery());
  const [q, setQ] = useState("");
  const { firstName, suggested, loading: nameLoading, save: saveFirstName } = useFirstName();

  const stats = useMemo(() => {
    const topicPapers = new Map<string, Set<string>>();
    const topicQuotes = new Map<string, number>();
    const paperTopics = new Map<string, Set<string>>();
    for (const h of links.highlights) {
      if (!h.topic_id) continue;
      topicQuotes.set(h.topic_id, (topicQuotes.get(h.topic_id) ?? 0) + 1);
      (topicPapers.get(h.topic_id) ?? topicPapers.set(h.topic_id, new Set()).get(h.topic_id)!).add(h.paper_id);
      (paperTopics.get(h.paper_id) ?? paperTopics.set(h.paper_id, new Set()).get(h.paper_id)!).add(h.topic_id);
    }
    for (const n of links.notes) {
      (topicPapers.get(n.topic_id) ?? topicPapers.set(n.topic_id, new Set()).get(n.topic_id)!).add(n.paper_id);
      (paperTopics.get(n.paper_id) ?? paperTopics.set(n.paper_id, new Set()).get(n.paper_id)!).add(n.topic_id);
    }
    return { topicPapers, topicQuotes, paperTopics };
  }, [links]);

  const topicById = useMemo(() => new Map(topics.map((t) => [t.id, t])), [topics]);
  const paperById = useMemo(() => new Map(papers.map((p) => [p.id, p])), [papers]);
  const needle = q.trim().toLowerCase();
  const has = (s: string | null | undefined) => !!needle && !!s && s.toLowerCase().includes(needle);

  // Matches inside comments and notes
  const matches = useMemo(() => {
    if (!needle) return [];
    const out: {
      key: string;
      kind: "comment" | "paper note" | "synthesis";
      text: string;
      context: string;
      paperId?: string;
      highlightId?: string;
      topicSlug?: string;
      paperIdForFilter?: string | undefined;
      topicIdForFilter?: string | undefined;
    }[] = [];
    for (const h of links.highlights) {
      if (has(h.quote) || has(h.comment_md)) {
        const p = paperById.get(h.paper_id);
        out.push({
          key: "h" + h.id,
          kind: "comment",
          text: has(h.comment_md) ? h.comment_md : h.quote,
          context: `${p?.title ?? "Paper"} · p. ${h.page}${h.topic_id ? ` · # ${topicById.get(h.topic_id)?.name ?? ""}` : ""}`,
          paperId: h.paper_id,
          highlightId: h.id,
          paperIdForFilter: h.paper_id,
          topicIdForFilter: h.topic_id ?? undefined,
        });
      }
    }
    for (const n of links.notes) {
      if (has(n.content_md)) {
        const p = paperById.get(n.paper_id);
        out.push({
          key: "n" + n.id,
          kind: "paper note",
          text: n.content_md,
          context: `${p?.title ?? "Paper"} · # ${topicById.get(n.topic_id)?.name ?? ""}`,
          paperId: n.paper_id,
          paperIdForFilter: n.paper_id,
          topicIdForFilter: n.topic_id,
        });
      }
    }
    for (const t of topics) {
      if (has(t.synthesis_md)) {
        out.push({ key: "t" + t.id, kind: "synthesis", text: t.synthesis_md, context: `# ${t.name}`, topicSlug: t.slug, topicIdForFilter: t.id });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needle, links, topics, paperById, topicById]);

  const matchedPaperIds = new Set(matches.map((m) => m.paperIdForFilter).filter(Boolean));
  const matchedTopicIds = new Set(matches.map((m) => m.topicIdForFilter).filter(Boolean));
  const filteredTopics = topics.filter((t) => !needle || has(t.name) || matchedTopicIds.has(t.id));
  const filteredPapers = papers.filter(
    (p) =>
      !needle ||
      has(p.title) ||
      has(p.authors) ||
      has(p.abstract) ||
      has(p.field) ||
      has(p.question) ||
      has(p.standing) ||
      has(p.position) ||
      has(p.summary) ||
      matchedPaperIds.has(p.id),
  );
  const topicsByPaper = useMemo(() => {
    const m = new Map<string, typeof topics>();
    for (const [pid, ids] of stats.paperTopics) {
      m.set(pid, [...ids].map((id) => topicById.get(id)).filter((t): t is (typeof topics)[number] => !!t));
    }
    return m;
  }, [stats, topicById]);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        right={
          <>
            <NewTopicDialog />
            <UploadPaperDialog />
          </>
        }
      />
      <FirstNamePrompt open={!nameLoading && !firstName} suggested={suggested} onSave={saveFirstName} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-5 pb-24 pt-10">
        <h1 className="sr-only">Reading Room</h1>
        <p className="mb-8 text-[11px] uppercase tracking-[0.14em] text-muted-foreground label-mono">
          {firstName ? `${firstName}'s Personal Research Library` : "Personal Research Library"}
        </p>
        <div className="mb-10">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search topics, papers, comments and notes"
            className="h-10 w-full border-b border-border bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/70 focus:border-foreground md:w-96"
          />
        </div>

        {needle && (
          <section className="mb-14">
            <div className="flex items-baseline justify-between border-b border-foreground pb-2">
              <h2 className="text-sm font-semibold">In comments &amp; notes</h2>
              <span className="label-mono">{matches.length}</span>
            </div>
            {matches.length === 0 ? (
              <p className="pt-4 text-sm text-muted-foreground">No comments or notes mention “{q.trim()}”.</p>
            ) : (
              <ul>
                {matches.slice(0, 30).map((m) => {
                  const inner = (
                    <>
                      <p className="label-mono mb-1 normal-case tracking-normal">
                        {m.kind} · {m.context}
                      </p>
                      <p className="text-[15px] leading-relaxed">{snippet(m.text, needle)}</p>
                    </>
                  );
                  const cls = "block py-3.5 transition-colors hover:bg-accent/60";
                  return (
                    <li key={m.key} className="border-b border-border">
                      {m.topicSlug ? (
                        <Link to="/topics/$slug" params={{ slug: m.topicSlug }} className={cls}>
                          {inner}
                        </Link>
                      ) : (
                        <Link
                          to="/papers/$id"
                          params={{ id: m.paperId! }}
                          search={m.highlightId ? { h: m.highlightId } : {}}
                          className={cls}
                        >
                          {inner}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        <div className="grid gap-16 lg:grid-cols-[minmax(220px,1fr)_minmax(0,2.6fr)]">
          {/* Topics */}
          <section>
            <div className="flex items-baseline justify-between border-b border-foreground pb-2">
              <h2 className="text-sm font-semibold">Topics</h2>
              <span className="label-mono">{filteredTopics.length}</span>
            </div>
            {filteredTopics.length === 0 ? (
              <p className="pt-6 text-sm text-muted-foreground">
                No topics yet. Create one to start collecting notes and quotes.
              </p>
            ) : (
              <ul>
                {filteredTopics.map((t) => (
                  <li key={t.id} className="border-b border-border">
                    <Link
                      to="/topics/$slug"
                      params={{ slug: t.slug }}
                      className="group flex items-baseline justify-between gap-4 py-3.5 transition-colors hover:bg-accent/60"
                    >
                      <span className="text-[15px] font-medium group-hover:underline group-hover:underline-offset-4">
                        {t.name}
                      </span>
                      <span className="label-mono shrink-0 normal-case tracking-normal">
                        {stats.topicPapers.get(t.id)?.size ?? 0} papers · {stats.topicQuotes.get(t.id) ?? 0} quotes
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <DrawingBoard />
          </section>

          {/* Papers */}
          <section className="min-w-0">
            <div className="flex items-baseline justify-between border-b border-foreground pb-2">
              <h2 className="text-sm font-semibold">Papers</h2>
              <span className="label-mono">{filteredPapers.length}</span>
            </div>
            {filteredPapers.length === 0 ? (
              <p className="pt-6 text-sm text-muted-foreground">No papers yet. Upload a PDF to start reading.</p>
            ) : (
              <PaperTable papers={filteredPapers} topicsByPaper={topicsByPaper} />
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

/** Short excerpt around the first match, with the match emphasised. */
function snippet(text: string, needle: string) {
  const flat = text.replace(/\s+/g, " ").trim();
  const i = flat.toLowerCase().indexOf(needle);
  if (i < 0) return flat.slice(0, 160);
  const start = Math.max(0, i - 60);
  const end = Math.min(flat.length, i + needle.length + 100);
  return (
    <>
      {start > 0 && "…"}
      {flat.slice(start, i)}
      <mark className="bg-mark px-0.5">{flat.slice(i, i + needle.length)}</mark>
      {flat.slice(i + needle.length, end)}
      {end < flat.length && "…"}
    </>
  );
}
