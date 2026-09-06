import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { NewTopicDialog } from "@/components/NewTopicDialog";
import { UploadPaperDialog } from "@/components/UploadPaperDialog";
import { linksQuery, papersQuery, topicsQuery } from "@/lib/db";

export const Route = createFileRoute("/")({
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
  const needle = q.trim().toLowerCase();
  const filteredTopics = topics.filter((t) => !needle || t.name.toLowerCase().includes(needle));
  const filteredPapers = papers.filter(
    (p) => !needle || p.title.toLowerCase().includes(needle) || p.authors.toLowerCase().includes(needle),
  );

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
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-24 pt-14">
        <div className="mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="label-mono mb-3">Personal research library</p>
            <h1 className="max-w-2xl text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl">
              Reading Room
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
              Papers on the left, notes on the right. Every highlight you route to a topic collects here, in one
              place, alongside your own synthesis.
            </p>
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search topics and papers"
            className="h-9 w-full border-b border-border bg-transparent text-sm outline-none placeholder:text-muted-foreground/70 focus:border-foreground md:w-72"
          />
        </div>

        <div className="grid gap-16 md:grid-cols-[2fr_3fr]">
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
          </section>

          {/* Papers */}
          <section>
            <div className="flex items-baseline justify-between border-b border-foreground pb-2">
              <h2 className="text-sm font-semibold">Papers</h2>
              <span className="label-mono">{filteredPapers.length}</span>
            </div>
            {filteredPapers.length === 0 ? (
              <p className="pt-6 text-sm text-muted-foreground">No papers yet. Upload a PDF to start reading.</p>
            ) : (
              <ul>
                {filteredPapers.map((p) => {
                  const ts = [...(stats.paperTopics.get(p.id) ?? [])]
                    .map((id) => topicById.get(id))
                    .filter(Boolean);
                  return (
                    <li key={p.id} className="border-b border-border">
                      <Link
                        to="/papers/$id"
                        params={{ id: p.id }}
                        className="group grid gap-1 py-4 transition-colors hover:bg-accent/60 md:grid-cols-[1fr_auto] md:gap-6"
                      >
                        <div className="min-w-0">
                          <p className="text-[15px] font-medium leading-snug group-hover:underline group-hover:underline-offset-4">
                            {p.title}
                          </p>
                          <p className="mt-1 truncate text-sm text-muted-foreground">
                            {[p.authors, p.year].filter(Boolean).join(" · ") || "No author info"}
                          </p>
                          {ts.length > 0 && (
                            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                              {ts.map((t) => (
                                <span key={t!.id} className="label-mono normal-case tracking-normal">
                                  # {t!.name}
                                </span>
                              ))}
                            </p>
                          )}
                        </div>
                        <span className="label-mono self-start pt-1">
                          {new Date(p.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
