import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { lazy, Suspense, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { PaperNotes } from "@/components/reader/PaperNotes";
import { PaperMetaDialog } from "@/components/reader/PaperMetaDialog";
import { Button } from "@/components/ui/button";
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
import { deletePaper, paperHighlightsQuery, paperNotesQuery, paperQuery, topicsQuery } from "@/lib/db";
import { cn } from "@/lib/utils";

const PdfReader = lazy(() => import("@/components/reader/PdfReader"));

export const Route = createFileRoute("/papers/$id")({
  validateSearch: z.object({ h: z.string().optional() }),
  loader: async ({ context, params }) => {
    const [paper] = await Promise.all([
      context.queryClient.ensureQueryData(paperQuery(params.id)),
      context.queryClient.ensureQueryData(topicsQuery()),
      context.queryClient.ensureQueryData(paperHighlightsQuery(params.id)),
      context.queryClient.ensureQueryData(paperNotesQuery(params.id)),
    ]);
    if (!paper) throw notFound();
    return { title: paper.title };
  },
  head: ({ loaderData }) => {
    const title = loaderData?.title ?? "Paper";
    return {
      meta: [
        { title: `${title} — Reading Room` },
        { name: "description", content: `Annotated reading of ${title} with highlights, comments and notes.` },
        { property: "og:title", content: `${title} — Reading Room` },
        { property: "og:description", content: `Annotated reading of ${title}.` },
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
      Paper not found.{" "}
      <Link to="/" className="underline">
        Back home
      </Link>
    </div>
  ),
  component: PaperPage,
});

function PaperPage() {
  const { id } = Route.useParams();
  const { h } = Route.useSearch();
  const { data: paper } = useSuspenseQuery(paperQuery(id));
  const { data: topics } = useSuspenseQuery(topicsQuery());
  const { data: highlights } = useSuspenseQuery(paperHighlightsQuery(id));
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(h ?? null);
  const [notesOpen, setNotesOpen] = useState(true);

  const remove = useMutation({
    mutationFn: () => deletePaper(paper!),
    onSuccess: () => {
      qc.invalidateQueries();
      navigate({ to: "/" });
    },
    onError: (e) => toast.error(e.message),
  });

  if (!paper) return null;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <SiteHeader
        crumb={paper.title}
        right={
          <>
            <PaperMetaDialog paper={paper} />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this paper?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The PDF, all highlights, comments and per-paper notes are removed permanently.
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
      <div
        className={cn(
          "grid min-h-0 flex-1 transition-[grid-template-columns] duration-300 ease-out",
          notesOpen
            ? "grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_440px]"
            : "grid-cols-1",
        )}
      >
        <div className="relative z-20 min-h-0 bg-paper">
          <div className="h-full overflow-hidden">
            <ClientOnly fallback={<ReaderFallback />}>
              <Suspense fallback={<ReaderFallback />}>
                <PdfReader
                  paper={paper}
                  topics={topics}
                  highlights={highlights}
                  activeTopicId={activeTopicId}
                  focusedId={focusedId}
                  onFocus={setFocusedId}
                />
              </Suspense>
            </ClientOnly>
          </div>
          <button
            type="button"
            aria-label={notesOpen ? "Hide notes" : "Show notes"}
            onClick={() => setNotesOpen((o) => !o)}
            className={cn(
              "absolute top-1/2 z-[100] hidden -translate-y-1/2 items-center justify-center rounded-full border border-mark-strong/40 bg-background shadow-md lg:flex size-8 hover:border-mark-strong hover:text-foreground text-muted-foreground transition-colors",
              notesOpen ? "right-0 translate-x-1/2" : "right-3 translate-x-0",
            )}
          >
            {notesOpen ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </button>
        </div>
        <aside
          className={cn(
            "relative z-10 min-h-0 overflow-hidden border-t border-border bg-background lg:border-l lg:border-t-0",
            !notesOpen && "hidden",
          )}
        >
          <PaperNotes paper={paper} topics={topics} activeTopicId={activeTopicId} onTopicChange={setActiveTopicId} />
        </aside>
      </div>
    </div>
  );
}

function ReaderFallback() {
  return (
    <div className="flex h-full items-center justify-center">
      <span className="label-mono">Loading paper…</span>
    </div>
  );
}
