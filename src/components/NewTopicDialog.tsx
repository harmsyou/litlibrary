import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTopic, type Topic } from "@/lib/db";

export function NewTopicDialog({
  trigger,
  onCreated,
  navigateAfter = true,
}: {
  trigger?: React.ReactNode;
  onCreated?: (t: Topic) => void;
  navigateAfter?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const qc = useQueryClient();
  const navigate = useNavigate();

  const m = useMutation({
    mutationFn: createTopic,
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["topics"] });
      setOpen(false);
      setName("");
      onCreated?.(t);
      if (navigateAfter) navigate({ to: "/topics/$slug", params: { slug: t.slug } });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            New topic
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New topic</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) m.mutate(name);
          }}
          className="space-y-4"
        >
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Memory consolidation" />
          <Button type="submit" className="w-full" disabled={m.isPending || !name.trim()}>
            {m.isPending ? "Creating…" : "Create topic"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
