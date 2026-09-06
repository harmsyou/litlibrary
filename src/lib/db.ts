import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Topic = Tables<"topics">;
export type Paper = Tables<"papers">;
export type PaperTopicNote = Tables<"paper_topic_notes">;
export type Highlight = Tables<"highlights">;
export type HighlightRect = { x: number; y: number; w: number; h: number };

export function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "topic"
  );
}

function throwIf<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

// ---------- Queries ----------

export const topicsQuery = () =>
  queryOptions({
    queryKey: ["topics"],
    queryFn: async () =>
      throwIf(await supabase.from("topics").select("*").order("name")) as Topic[],
  });

export const papersQuery = () =>
  queryOptions({
    queryKey: ["papers"],
    queryFn: async () =>
      throwIf(
        await supabase.from("papers").select("*").order("created_at", { ascending: false }),
      ) as Paper[],
  });

/** Index of every highlight + note, for counts and search on the home page. */
export const linksQuery = () =>
  queryOptions({
    queryKey: ["links"],
    queryFn: async () => {
      const [h, n] = await Promise.all([
        supabase.from("highlights").select("id, paper_id, topic_id, page, quote, comment_md"),
        supabase.from("paper_topic_notes").select("id, paper_id, topic_id, content_md"),
      ]);
      return {
        highlights: throwIf(h) as Pick<Highlight, "id" | "paper_id" | "topic_id" | "page" | "quote" | "comment_md">[],
        notes: (throwIf(n) as Pick<PaperTopicNote, "id" | "paper_id" | "topic_id" | "content_md">[]).filter(
          (x) => x.content_md.trim().length > 0,
        ),
      };
    },
  });

export const topicBySlugQuery = (slug: string) =>
  queryOptions({
    queryKey: ["topic", slug],
    queryFn: async () => {
      const topic = throwIf(
        await supabase.from("topics").select("*").eq("slug", slug).maybeSingle(),
      ) as Topic | null;
      if (!topic) return null;
      const highlights = throwIf(
        await supabase
          .from("highlights")
          .select("*, papers(id, title, authors, year)")
          .eq("topic_id", topic.id)
          .order("created_at"),
      ) as (Highlight & { papers: Pick<Paper, "id" | "title" | "authors" | "year"> | null })[];
      const notes = (
        throwIf(
          await supabase
            .from("paper_topic_notes")
            .select("*, papers(id, title, authors, year)")
            .eq("topic_id", topic.id)
            .order("updated_at", { ascending: false }),
        ) as (PaperTopicNote & { papers: Pick<Paper, "id" | "title" | "authors" | "year"> | null })[]
      ).filter((n) => n.content_md.trim().length > 0);
      return { topic, highlights, notes };
    },
  });

export const paperQuery = (id: string) =>
  queryOptions({
    queryKey: ["paper", id],
    queryFn: async () =>
      throwIf(await supabase.from("papers").select("*").eq("id", id).maybeSingle()) as Paper | null,
  });

export const paperHighlightsQuery = (paperId: string) =>
  queryOptions({
    queryKey: ["paper", paperId, "highlights"],
    queryFn: async () =>
      throwIf(
        await supabase.from("highlights").select("*").eq("paper_id", paperId).order("page").order("created_at"),
      ) as Highlight[],
  });

export const paperNotesQuery = (paperId: string) =>
  queryOptions({
    queryKey: ["paper", paperId, "notes"],
    queryFn: async () =>
      throwIf(await supabase.from("paper_topic_notes").select("*").eq("paper_id", paperId)) as PaperTopicNote[],
  });

// ---------- Mutations ----------

export async function createTopic(name: string) {
  const base = slugify(name);
  let slug = base;
  for (let i = 2; i < 50; i++) {
    const existing = throwIf(await supabase.from("topics").select("id").eq("slug", slug).maybeSingle());
    if (!existing) break;
    slug = `${base}-${i}`;
  }
  return throwIf(await supabase.from("topics").insert({ name: name.trim(), slug }).select("*").single()) as Topic;
}

export async function updateTopic(id: string, patch: Partial<Pick<Topic, "name" | "synthesis_md">>) {
  return throwIf(
    await supabase.from("topics").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select("*").single(),
  ) as Topic;
}

export async function deleteTopic(id: string) {
  throwIf(await supabase.from("topics").delete().eq("id", id));
}

export async function uploadPaper(file: File, meta: { title: string; authors: string | null; year: number | null }) {
  const id = crypto.randomUUID();
  const path = `${id}.pdf`;
  const up = await supabase.storage.from("papers").upload(path, file, { contentType: "application/pdf" });
  if (up.error) throw new Error(up.error.message);
  return throwIf(
    await supabase.from("papers").insert({ id, file_path: path, ...meta, authors: meta.authors ?? "" }).select("*").single(),
  ) as Paper;
}

export async function updatePaper(
  id: string,
  patch: Partial<
    Pick<
      Paper,
      | "title"
      | "authors"
      | "year"
      | "abstract"
      | "page_count"
      | "field"
      | "question"
      | "standing"
      | "standing_reason"
      | "position"
      | "position_reason"
      | "summary"
      | "analysis_status"
    >
  >,
) {
  return throwIf(
    await supabase.from("papers").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select("*").single(),
  ) as Paper;
}

export async function deletePaper(paper: Paper) {
  await supabase.storage.from("papers").remove([paper.file_path]);
  throwIf(await supabase.from("papers").delete().eq("id", paper.id));
}

export async function getPaperUrl(path: string) {
  const res = await supabase.storage.from("papers").createSignedUrl(path, 60 * 60 * 6);
  if (res.error) throw new Error(res.error.message);
  return res.data.signedUrl;
}

export async function upsertPaperNote(paperId: string, topicId: string, content: string) {
  return throwIf(
    await supabase
      .from("paper_topic_notes")
      .upsert(
        { paper_id: paperId, topic_id: topicId, content_md: content, updated_at: new Date().toISOString() },
        { onConflict: "paper_id,topic_id" },
      )
      .select("*")
      .single(),
  ) as PaperTopicNote;
}

export async function createHighlight(input: {
  paper_id: string;
  topic_id: string | null;
  page: number;
  rects: HighlightRect[];
  quote: string;
  comment_md: string;
}) {
  return throwIf(await supabase.from("highlights").insert(input).select("*").single()) as Highlight;
}

export async function updateHighlight(id: string, patch: Partial<Pick<Highlight, "comment_md" | "topic_id">>) {
  return throwIf(await supabase.from("highlights").update(patch).eq("id", id).select("*").single()) as Highlight;
}

export async function deleteHighlight(id: string) {
  throwIf(await supabase.from("highlights").delete().eq("id", id));
}
