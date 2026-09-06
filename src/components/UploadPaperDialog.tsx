import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { uploadPaper } from "@/lib/db";
import { useAnalyzePaper } from "@/lib/useAnalyzePaper";
import { cn } from "@/lib/utils";

export function UploadPaperDialog() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const analyze = useAnalyzePaper();

  const m = useMutation({
    mutationFn: (file: File) =>
      uploadPaper(file, {
        // Placeholder until the AI analysis reads the real title from the PDF.
        title: file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " "),
        authors: null,
        year: null,
      }),
    onSuccess: (p, file) => {
      qc.invalidateQueries({ queryKey: ["papers"] });
      // Fill in title, authors, year and the profile from the PDF itself.
      void analyze(p, { file, overwriteIdentity: true });
      setOpen(false);
      setBusy(null);
      navigate({ to: "/papers/$id", params: { id: p.id } });
    },
    onError: (e) => {
      setBusy(null);
      toast.error(e.message);
    },
  });

  const pick = (f: File | undefined) => {
    if (!f || m.isPending) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Please choose a PDF file.");
      return;
    }
    setBusy(f.name);
    m.mutate(f);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !m.isPending && setOpen(v)}>
      <DialogTrigger asChild>
        <Button size="sm">Upload paper</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload a paper</DialogTitle>
        </DialogHeader>
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
            "flex h-32 cursor-pointer flex-col items-center justify-center border border-dashed border-border text-sm text-muted-foreground transition-colors hover:border-foreground",
            drag && "border-foreground bg-accent",
            m.isPending && "pointer-events-none opacity-60",
          )}
        >
          {busy ? (
            <>
              <span className="font-medium text-foreground">{busy}</span>
              <span className="label-mono mt-1">Uploading & reading…</span>
            </>
          ) : (
            <>
              <span>Drop a PDF here or click to choose</span>
              <span className="label-mono mt-1">Title, authors and year are read from the PDF</span>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
