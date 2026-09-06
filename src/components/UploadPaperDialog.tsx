import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadPaper } from "@/lib/db";
import { cn } from "@/lib/utils";

export function UploadPaperDialog() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [year, setYear] = useState("");
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Please choose a PDF file.");
      return;
    }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " "));
  };

  const m = useMutation({
    mutationFn: () =>
      uploadPaper(file!, {
        title: title.trim(),
        authors: authors.trim(),
        year: year ? Number(year) : null,
      }),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["papers"] });
      setOpen(false);
      setFile(null);
      setTitle("");
      setAuthors("");
      setYear("");
      navigate({ to: "/papers/$id", params: { id: p.id } });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Upload paper</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload a paper</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (file && title.trim()) m.mutate();
          }}
          className="space-y-4"
        >
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              pick(e.dataTransfer.files[0]);
            }}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex h-28 cursor-pointer flex-col items-center justify-center border border-dashed border-border text-sm text-muted-foreground transition-colors hover:border-foreground",
              drag && "border-foreground bg-accent",
            )}
          >
            {file ? (
              <>
                <span className="font-medium text-foreground">{file.name}</span>
                <span className="label-mono mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
              </>
            ) : (
              <>
                <span>Drop a PDF here or click to choose</span>
                <span className="label-mono mt-1">Up to 50 MB</span>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => pick(e.target.files?.[0])}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="grid grid-cols-[1fr_88px] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="authors">Authors</Label>
              <Input id="authors" value={authors} onChange={(e) => setAuthors(e.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="year">Year</Label>
              <Input id="year" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={!file || !title.trim() || m.isPending}>
            {m.isPending ? "Uploading…" : "Add to library"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
