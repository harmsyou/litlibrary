import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updatePaper, type Paper } from "@/lib/db";
import { FIELDS, POSITIONS, STANDINGS } from "@/lib/paper-analysis";
import { useAnalyzePaper } from "@/lib/useAnalyzePaper";

const UNSET = "__unset__";

export function PaperMetaDialog({ paper }: { paper: Paper }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(paper.title);
  const [authors, setAuthors] = useState(paper.authors);
  const [year, setYear] = useState(paper.year ? String(paper.year) : "");
  const [abstract, setAbstract] = useState(paper.abstract);
  const [field, setField] = useState(paper.field ?? UNSET);
  const [question, setQuestion] = useState(paper.question ?? "");
  const [standing, setStanding] = useState(paper.standing ?? UNSET);
  const [position, setPosition] = useState(paper.position ?? UNSET);
  const [analyzing, setAnalyzing] = useState(false);
  const qc = useQueryClient();
  const analyze = useAnalyzePaper();

  const load = (p: Paper) => {
    setTitle(p.title);
    setAuthors(p.authors);
    setYear(p.year ? String(p.year) : "");
    setAbstract(p.abstract);
    setField(p.field ?? UNSET);
    setQuestion(p.question ?? "");
    setStanding(p.standing ?? UNSET);
    setPosition(p.position ?? UNSET);
  };

  const m = useMutation({
    mutationFn: () =>
      updatePaper(paper.id, {
        title: title.trim(),
        authors: authors.trim(),
        year: year ? Number(year) : null,
        abstract,
        field: field === UNSET ? null : field,
        question: question.trim() || null,
        standing: standing === UNSET ? null : standing,
        position: position === UNSET ? null : position,
        ...(field !== UNSET && standing !== UNSET && position !== UNSET ? { analysis_status: "done" } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["paper", paper.id] });
      qc.invalidateQueries({ queryKey: ["papers"] });
      setOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const reanalyze = async () => {
    setAnalyzing(true);
    const r = await analyze({ ...paper, title, authors, year: year ? Number(year) : null }, { overwriteIdentity: false });
    setAnalyzing(false);
    if (r) {
      setField(r.field);
      setQuestion(r.question);
      setStanding(r.standing);
      setPosition(r.position);
      toast.success("Card refreshed from the PDF.");
    }
  };

  const Pick = ({
    label,
    value,
    onChange,
    options,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: readonly string[];
  }) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNSET}>—</SelectItem>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) load(paper);
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

          <div className="flex items-baseline justify-between border-t border-border pt-4">
            <span className="label-mono">Library card</span>
            <button
              type="button"
              onClick={reanalyze}
              disabled={analyzing}
              className="text-xs underline underline-offset-4 hover:text-foreground disabled:opacity-50"
            >
              {analyzing ? "Reading the PDF…" : paper.analysis_status === "done" ? "Re-analyze" : "Analyze"}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Pick label="Field" value={field} onChange={setField} options={FIELDS} />
            <Pick label="Standing" value={standing} onChange={setStanding} options={STANDINGS} />
            <Pick label="Position" value={position} onChange={setPosition} options={POSITIONS} />
          </div>
          <div className="space-y-1.5">
            <Label>Question the paper answers</Label>
            <Textarea rows={2} value={question} onChange={(e) => setQuestion(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Abstract / summary</Label>
            <Textarea rows={4} value={abstract} onChange={(e) => setAbstract(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={m.isPending}>
            Save
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
