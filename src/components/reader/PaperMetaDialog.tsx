import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updatePaper, type Paper } from "@/lib/db";

export function PaperMetaDialog({ paper }: { paper: Paper }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(paper.title);
  const [authors, setAuthors] = useState(paper.authors);
  const [year, setYear] = useState(paper.year ? String(paper.year) : "");
  const [abstract, setAbstract] = useState(paper.abstract);
  const qc = useQueryClient();

  const m = useMutation({
    mutationFn: () =>
      updatePaper(paper.id, { title: title.trim(), authors: authors.trim(), year: year ? Number(year) : null, abstract }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["paper", paper.id] });
      qc.invalidateQueries({ queryKey: ["papers"] });
      setOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setTitle(paper.title);
          setAuthors(paper.authors);
          setYear(paper.year ? String(paper.year) : "");
          setAbstract(paper.abstract);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          Details
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Paper details</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) m.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-[1fr_88px] gap-3">
            <div className="space-y-1.5">
              <Label>Authors</Label>
              <Input value={authors} onChange={(e) => setAuthors(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Year</Label>
              <Input value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Abstract / summary</Label>
            <Textarea rows={5} value={abstract} onChange={(e) => setAbstract(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={m.isPending}>
            Save
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
