import { useEffect } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { NewTopicDialog } from "@/components/NewTopicDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { paperNotesQuery, upsertPaperNote, type Paper, type Topic } from "@/lib/db";

export function PaperNotes({
  paper,
  topics,
  activeTopicId,
  onTopicChange,
}: {
  paper: Paper;
  topics: Topic[];
  activeTopicId: string | null;
  onTopicChange: (id: string | null) => void;
}) {
  const { data: notes } = useSuspenseQuery(paperNotesQuery(paper.id));
  const qc = useQueryClient();

  // Default to first topic that already has notes for this paper, else first topic
  useEffect(() => {
    // Only pick a default when nothing is chosen; never silently switch away from a chosen topic
    if (activeTopicId) return;
    const withNotes = notes.find((n) => n.content_md.trim());
    const first = withNotes?.topic_id ?? topics[0]?.id ?? null;
    if (first !== activeTopicId) onTopicChange(first);
  }, [topics, notes, activeTopicId, onTopicChange]);

  const active = topics.find((t) => t.id === activeTopicId) ?? null;
  const note = notes.find((n) => n.topic_id === activeTopicId);
  const notedTopicIds = new Set(notes.filter((n) => n.content_md.trim()).map((n) => n.topic_id));

  return (
    <div className="flex h-full flex-col px-5 pb-5 pt-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="label-mono mb-1.5">Notes on this paper, as they relate to</p>
          <Select value={activeTopicId ?? ""} onValueChange={(v) => onTopicChange(v)}>
            <SelectTrigger className="h-9 w-full border-x-0 border-t-0 border-b border-border px-0 shadow-none focus:ring-0 focus-visible:ring-0">
              <SelectValue placeholder={topics.length ? "Choose a topic" : "No topics yet"} />
            </SelectTrigger>
            <SelectContent>
              {topics.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  <span className="flex items-center gap-2">
                    {t.name}
                    {notedTopicIds.has(t.id) && <span className="size-1.5 rounded-full bg-mark-strong" />}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <NewTopicDialog
          navigateAfter={false}
          onCreated={(t) => onTopicChange(t.id)}
          trigger={
            <button type="button" className="label-mono mt-5 shrink-0 hover:text-foreground">
              + Topic
            </button>
          }
        />
      </div>

      {active ? (
        <MarkdownEditor
          key={active.id}
          resetKey={active.id}
          className="min-h-0 flex-1"
          value={note?.content_md ?? ""}
          placeholder={`What does this paper tell you about ${active.name}? These notes stay with the paper.`}
          onSave={async (v) => {
            await upsertPaperNote(paper.id, active.id, v);
            qc.invalidateQueries({ queryKey: ["paper", paper.id, "notes"] });
            qc.invalidateQueries({ queryKey: ["links"] });
            qc.invalidateQueries({ queryKey: ["topic"] });
          }}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Create a topic to start taking notes on this paper.</p>
      )}
    </div>
  );
}
