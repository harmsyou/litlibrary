import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onSave: (value: string) => Promise<unknown>;
  placeholder?: string;
  className?: string;
  /** Reset internal draft when this changes (e.g. switching topic). */
  resetKey?: string;
};

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("prose-notes", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}

export function MarkdownEditor({ value, onSave, placeholder, className, resetKey }: Props) {
  const [draft, setDraft] = useState(value);
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [status, setStatus] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const timer = useRef<number | null>(null);
  const latest = useRef(value);

  // Reset when switching documents
  useEffect(() => {
    setDraft(value);
    latest.current = value;
    setStatus("saved");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const flush = async (v: string) => {
    if (v === latest.current) {
      setStatus("saved");
      return;
    }
    setStatus("saving");
    try {
      await onSave(v);
      latest.current = v;
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

  const onChange = (v: string) => {
    setDraft(v);
    setStatus("dirty");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => flush(v), 800);
  };

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex gap-3 text-xs">
          {(["write", "preview"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "label-mono transition-colors hover:text-foreground",
                mode === m && "text-foreground underline underline-offset-4",
              )}
            >
              {m}
            </button>
          ))}
        </div>
        <span className="label-mono">
          {status === "saved" && "Saved"}
          {status === "dirty" && "Editing"}
          {status === "saving" && "Saving…"}
          {status === "error" && <span className="text-destructive">Save failed</span>}
        </span>
      </div>
      {mode === "write" ? (
        <textarea
          value={draft}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => flush(draft)}
          placeholder={placeholder}
          spellCheck
          className="mt-3 min-h-[240px] w-full flex-1 resize-none bg-transparent font-sans text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground/60"
        />
      ) : (
        <div className="mt-3 flex-1 overflow-auto">
          {draft.trim() ? (
            <Markdown>{draft}</Markdown>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing written yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
