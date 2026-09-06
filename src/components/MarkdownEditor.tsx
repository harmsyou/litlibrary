import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown as MarkdownExt } from "@tiptap/markdown";
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

type Status = "saved" | "dirty" | "saving" | "error";

export function MarkdownEditor({ value, onSave, placeholder, className, resetKey }: Props) {
  const [status, setStatus] = useState<Status>("saved");
  const timer = useRef<number | null>(null);
  const latest = useRef(value);
  const saveRef = useRef(onSave);
  saveRef.current = onSave;

  const flush = async (v: string) => {
    if (v === latest.current) {
      setStatus("saved");
      return;
    }
    setStatus("saving");
    try {
      await saveRef.current(v);
      latest.current = v;
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      MarkdownExt,
      Placeholder.configure({ placeholder: placeholder ?? "Write…" }),
    ],
    content: value,
    contentType: "markdown",
    editorProps: {
      attributes: {
        class:
          "prose-notes min-h-[240px] w-full flex-1 font-sans text-[15px] leading-relaxed outline-none",
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor }) => {
      const md = editor.getMarkdown();
      setStatus("dirty");
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => flush(md), 800);
    },
    onBlur: ({ editor }) => {
      if (timer.current) window.clearTimeout(timer.current);
      void flush(editor.getMarkdown());
    },
  });

  // Reset when switching documents
  useEffect(() => {
    if (!editor) return;
    latest.current = value;
    setStatus("saved");
    if (editor.getMarkdown() !== value) {
      editor.commands.setContent(value, { contentType: "markdown", emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, editor]);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e?.isActive("bold") ?? false,
      italic: e?.isActive("italic") ?? false,
      bullet: e?.isActive("bulletList") ?? false,
      ordered: e?.isActive("orderedList") ?? false,
      heading: e?.isActive("heading", { level: 2 }) ?? false,
    }),
  });

  const Btn = ({
    on,
    label,
    title,
    onClick,
    className: c,
  }: {
    on?: boolean | undefined;
    label: string;
    title: string;
    onClick: () => void;
    className?: string | undefined;
  }) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={on}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
        on && "bg-secondary text-foreground",
        c,
      )}
    >
      {label}
    </button>
  );

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="-ml-1.5 flex items-center gap-0.5">
          <Btn
            label="Aa"
            title="Heading"
            on={active?.heading}
            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          />
          <Btn
            label="B"
            title="Bold"
            className="font-semibold"
            on={active?.bold}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          />
          <Btn
            label="I"
            title="Italic"
            className="italic"
            on={active?.italic}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          />
          <span className="mx-1 h-4 w-px bg-border" />
          <Btn
            label="•"
            title="Bulleted list"
            on={active?.bullet}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          />
          <Btn
            label="1."
            title="Numbered list"
            on={active?.ordered}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          />
        </div>
        <span className="label-mono">
          {status === "saved" && "Saved"}
          {status === "dirty" && "Editing"}
          {status === "saving" && "Saving…"}
          {status === "error" && <span className="text-destructive">Save failed</span>}
        </span>
      </div>
      <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-auto">
        <EditorContent editor={editor} className="flex flex-1 flex-col [&>div]:flex-1" />
      </div>
    </div>
  );
}
