import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Markdown, MarkdownEditor } from "@/components/MarkdownEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteTopic, topicBySlugQuery, updateTopic } from "@/lib/db";

export const Route = createFileRoute("/topics/$slug")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(topicBySlugQuery(params.slug));
    if (!data) throw notFound();
    return { name: data.topic.name };
  },
  head: ({ loaderData }) => {
    const name = loaderData?.name ?? "Topic";
    return {
      meta: [
        { title: `${name} — Reading Room` },
        { name: "description", content: `Centralized notes, quotes and comments on ${name}.` },
        { property: "og:title", content: `${name} — Reading Room` },
        { property: "og:description", content: `Centralized notes, quotes and comments on ${name}.` },
        ...(loaderData ? [] : [{ name: "robots", content: "noindex" }]),
      ],
    };
  },
  errorComponent: ({ error }) => (
    <div role="alert" className="p-8 text-sm text-destructive">
      {error.message}
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-8 text-sm">
      Topic not found.{" "}
      <Link to="/" className="underline">
        Back home
      </Link>
    </div>
  ),
  component: TopicPage,
});

function TopicPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(topicBySlugQuery(slug));
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");

  // Loader throws notFound() when missing, so data is always present here.
  const { topic, highlights, notes } = data!;


  const rename = useMutation({
    mutationFn: (n: string) => updateTopic(topic.id, { name: n }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["topic", slug] });
      qc.invalidateQueries({ queryKey: ["topics"] });
      setEditing(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: () => deleteTopic(topic.id),
    onSuccess: () => {
      qc.invalidateQueries();
      navigate({ to: "/" });
    },
    onError: (e) => toast.error(e.message),
  });

  const byPaper = new Map<string, { paper: NonNullable<(typeof highlights)[number]["papers"]>; items: typeof highlights }>();
  for (const h of highlights) {
    if (!h.papers) continue;
    const g = byPaper.get(h.papers.id) ?? { paper: h.papers, items: [] };
    g.items.push(h);
    byPaper.set(h.papers.id, g);
  }

  const paperCount = new Set([...byPaper.keys(), ...notes.map((n) => n.paper_id)]).size;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        crumb={topic.name}
        right={
          <>
            <Button variant="ghost" size="sm" onClick={() => { setName(topic.name); setEditing(true); }}>
              Rename
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete “{topic.name}”?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Your synthesis and per-paper notes for this topic are removed. Highlights stay on their papers but lose this topic.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => remove.mutate()}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        }
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-24 pt-14">
        <p className="label-mono mb-3">Topic</p>
        {editing ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) rename.mutate(name.trim());
            }}
          >
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="text-lg" />
            <Button type="submit" size="sm">Save</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </form>
        ) : (
          <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl">{topic.name}</h1>
        )}
        <p className="mt-3 text-sm text-muted-foreground">
          {paperCount} {paperCount === 1 ? "paper" : "papers"} · {notes.length}{" "}
          {notes.length === 1 ? "note" : "notes"} · {highlights.length} {highlights.length === 1 ? "quote" : "quotes"}
        </p>

        <section className="mt-14">
          <h2 className="mb-6 border-b border-foreground pb-2 text-sm font-semibold">Notes from papers</h2>
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No paper notes yet. While reading a paper, pick this topic in the notes panel and write — it shows up here.
            </p>
          ) : (
            <div className="space-y-12">
              {notes.map((n) => (
                <article key={n.id}>
                  {n.papers && (
                    <Link to="/papers/$id" params={{ id: n.papers.id }} className="group block">
                      <p className="text-[15px] font-medium leading-snug group-hover:underline group-hover:underline-offset-4">
                        {n.papers.title}
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {[n.papers.authors, n.papers.year].filter(Boolean).join(" · ")}
                      </p>
                    </Link>
                  )}
                  <Markdown className="mt-4">{n.content_md}</Markdown>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-16">
          <h2 className="mb-3 border-b border-foreground pb-2 text-sm font-semibold">Synthesis</h2>
          <MarkdownEditor
            resetKey={topic.id}
            value={topic.synthesis_md}
            placeholder="Your own understanding of this topic, in your words…"
            onSave={async (v) => {
              await updateTopic(topic.id, { synthesis_md: v });
              qc.invalidateQueries({ queryKey: ["topic", slug] });
            }}
          />
        </section>

        <section className="mt-16">
          <h2 className="mb-6 border-b border-foreground pb-2 text-sm font-semibold">Quotes &amp; comments</h2>
          {byPaper.size === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing routed here yet. While reading a paper, highlight text and pick this topic in the comment box.
            </p>
          ) : (
            <div className="space-y-12">
              {[...byPaper.values()].map(({ paper, items }) => (
                <div key={paper.id}>
                  <Link
                    to="/papers/$id"
                    params={{ id: paper.id }}
                    className="group block"
                  >
                    <p className="text-[15px] font-medium leading-snug group-hover:underline group-hover:underline-offset-4">
                      {paper.title}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {[paper.authors, paper.year].filter(Boolean).join(" · ")}
                    </p>
                  </Link>
                  <ul className="mt-4 space-y-6">
                    {items.map((h) => (
                      <li key={h.id} className="grid gap-3 md:grid-cols-[56px_1fr]">
                        <Link
                          to="/papers/$id"
                          params={{ id: paper.id }}
                          search={{ h: h.id }}
                          className="label-mono pt-1 hover:text-foreground"
                        >
                          p. {h.page}
                        </Link>
                        <div>
                          {h.comment_md.trim() && (
                            <Markdown className="text-[15px] leading-relaxed text-foreground">{h.comment_md}</Markdown>
                          )}
                          <blockquote className={cn("border-l border-foreground/20 pl-3 text-[15px] leading-relaxed text-muted-foreground", h.comment_md.trim() && "mt-3")}>
                            <span className="bg-mark/40 box-decoration-clone px-0.5">{h.quote}</span>
                          </blockquote>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
