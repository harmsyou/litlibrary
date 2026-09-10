import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import {
  createScratchNote,
  deleteScratchNote,
  scratchNotesQuery,
  updateScratchNote,
  type ScratchNote,
} from "@/lib/db";

function when(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function DrawingBoard() {
  const qc = useQueryClient();
  const { data: notes = [] } = useQuery(scratchNotesQuery());
  const [openId, setOpenId] = useState<string | null>(null);
  const open = notes.find((n) => n.id === openId) ?? null;

  const refresh = () => qc.invalidateQueries({ queryKey: ["scratch-notes"] });

  const add = useMutation({
    mutationFn: () => createScratchNote(""),
    onSuccess: async (n: ScratchNote) => {
      await refresh();
      setOpenId(n.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: deleteScratchNote,
    onSuccess: async () => {
      setOpenId(null);
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="mt-[45vh]">
      <div className="flex items-baseline justify-between border-b border-foreground pb-2">
        <h2 className="text-sm font-semibold italic text-foreground">Drawing Board</h2>
        <span className="label-mono">{notes.length}</span>
      </div>

      <button
        type="button"
        onClick={() => add.mutate()}
        disabled={add.isPending}
        aria-label="New loose note"
        className="label-mono mt-2 py-1 text-muted-foreground/80 transition-colors hover:text-foreground"
      >
        + Note
      </button>

      {notes.length > 0 && (
        <ul className="mt-1">
          {notes.map((n) => (
            <li key={n.id} className="border-b border-border/60">
              <button
                type="button"
                onClick={() => setOpenId(n.id)}
                className="flex w-full items-baseline justify-between gap-3 py-2.5 text-left transition-colors hover:bg-accent/60"
              >
                <span className="truncate text-[14px]">
                  {n.title.trim() || firstLine(n.content_md) || "Untitled"}
                </span>
                <span className="label-mono shrink-0 normal-case tracking-normal">{when(n.updated_at)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="flex h-[80vh] max-w-2xl flex-col">
          <DialogHeader className="space-y-0">
            <DialogTitle className="sr-only">Note</DialogTitle>
            {open && (
              <input
                defaultValue={open.title}
                key={open.id}
                placeholder="Untitled"
                onBlur={async (e) => {
                  if (e.target.value !== open.title) {
                    await updateScratchNote(open.id, { title: e.target.value });
                    refresh();
                  }
                }}
                className="w-full border-b border-border bg-transparent pb-2 text-[17px] font-medium outline-none placeholder:text-muted-foreground/60 focus:border-foreground"
              />
            )}
          </DialogHeader>
          {open && (
            <MarkdownEditor
              key={open.id}
              resetKey={open.id}
              className="min-h-0 flex-1"
              value={open.content_md}
              placeholder="Anything you're thinking through…"
              onSave={async (v) => {
                await updateScratchNote(open.id, { content_md: v });
                refresh();
              }}
            />
          )}
          {open && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => remove.mutate(open.id)}
                className="label-mono text-muted-foreground transition-colors hover:text-destructive"
              >
                Delete
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function firstLine(md: string) {
  return md.replace(/[#*_`>-]/g, "").split("\n").map((s) => s.trim()).find(Boolean) ?? "";
}
