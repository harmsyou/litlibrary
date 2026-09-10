import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function FirstNamePrompt({
  open,
  suggested,
  onSave,
}: {
  open: boolean;
  suggested: string;
  onSave: (value: string) => Promise<void>;
}) {
  const [value, setValue] = useState(suggested);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setValue(suggested);
  }, [suggested]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    setBusy(true);
    try {
      await onSave(value);
    } catch {
      toast.error("Could not save your name");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-sm [&>button]:hidden">
        <DialogHeader>
          <DialogTitle>What's your first name?</DialogTitle>
          <DialogDescription>It shows at the top of your reading room.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="mt-2">
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="First name"
            className="h-10 w-full border-b border-border bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/70 focus:border-foreground"
          />
          <button
            type="submit"
            disabled={busy || !value.trim()}
            className="mt-6 flex h-10 w-full items-center justify-center border border-foreground text-sm font-medium transition-colors hover:bg-foreground hover:text-background disabled:opacity-50"
          >
            {busy ? "Saving…" : "Continue"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
