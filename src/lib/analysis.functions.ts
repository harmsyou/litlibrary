import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { FIELDS, POSITIONS, STANDINGS, STANDING_DEFS, POSITION_DEFS } from "@/lib/paper-analysis";

const Input = z.object({
  paperId: z.string().uuid(),
  text: z.string().min(1).max(20000),
  hint: z.object({ title: z.string(), authors: z.string(), year: z.number().nullable() }).optional(),
  /** Fresh upload: let the AI overwrite title/authors/year with what the PDF says. */
  overwriteIdentity: z.boolean().default(false),
});

const Result = z.object({
  title: z.string(),
  authors: z.string(),
  year: z.number().nullable(),
  field: z.enum(FIELDS),
  question: z.string(),
  standing: z.enum(STANDINGS),
  standing_reason: z.string(),
  position: z.enum(POSITIONS),
  position_reason: z.string(),
  summary: z.string(),
});
export type AnalysisResult = z.infer<typeof Result>;

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "authors", "year", "field", "question", "standing", "standing_reason", "position", "position_reason", "summary"],
  properties: {
    title: { type: "string" },
    authors: { type: "string" },
    year: { type: ["integer", "null"] },
    field: { type: "string", enum: [...FIELDS] },
    question: { type: "string" },
    standing: { type: "string", enum: [...STANDINGS] },
    standing_reason: { type: "string" },
    position: { type: "string", enum: [...POSITIONS] },
    position_reason: { type: "string" },
    summary: { type: "string" },
  },
};

function systemPrompt(today: string) {
  return `You are a neuroscience research librarian. Read the extracted text of a paper and fill in a library card.
Today is ${today}.

Rules:
- title: the paper's actual title (clean, no line-break artifacts).
- authors: full author list as "A. Surname, B. Surname, C. Surname" (max 8 names; if more, list the first 7 then "et al.").
- year: publication year as an integer, or null if unknown.
- field: the single best fit from ${FIELDS.join(", ")}.
- question: ONE sentence (under 25 words) stating the question the paper is trying to answer.
- standing — how settled the work is:
${STANDINGS.map((s) => `  - ${s}: ${STANDING_DEFS[s]}`).join("\n")}
  Use publication venue, year relative to today, whether it is a preprint (bioRxiv, arXiv, medRxiv, "not peer reviewed"), and how canonical the result reads.
- standing_reason: one short clause (under 15 words) justifying the standing.
- position — where it sits in the debate on its question:
${POSITIONS.map((p) => `  - ${p}: ${POSITION_DEFS[p]}`).join("\n")}
  Judge from how the paper frames prior work: does it confirm, add to, argue against, or sit outside the main dialogue?
- position_reason: one short clause (under 15 words) justifying the position.
- summary: one plain sentence (under 30 words) of what the paper found.
Be decisive; never leave fields empty.`;
}

async function callGateway(apiKey: string, text: string, hint: z.infer<typeof Input>["hint"]) {
  const userContent = `${hint ? `Metadata entered by the reader (may be incomplete or wrong): title="${hint.title}", authors="${hint.authors}", year=${hint.year ?? "unknown"}.\n\n` : ""}Extracted text:\n${text}`;
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "openai/gpt-5.6-sol",
      input: [
        { role: "system", content: systemPrompt(new Date().toISOString().slice(0, 10)) },
        { role: "user", content: userContent },
      ],
      text: { format: { type: "json_schema", name: "paper_card", strict: true, schema } },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let msg = `AI request failed (${res.status})`;
    try {
      const j = JSON.parse(body) as { error?: { message?: string } | string; message?: string };
      msg = (typeof j.error === "string" ? j.error : j.error?.message) ?? j.message ?? msg;
    } catch {
      /* keep default */
    }
    throw Object.assign(new Error(msg), { status: res.status });
  }
  const json = (await res.json()) as {
    output_text?: string;
    output?: { type: string; content?: { type: string; text?: string }[] }[];
  };
  const raw =
    json.output_text ??
    json.output
      ?.filter((o) => o.type === "message")
      .flatMap((o) => o.content ?? [])
      .find((c) => c.type === "output_text")?.text;
  if (!raw) throw new Error("AI returned no content");
  return Result.parse(JSON.parse(raw));
}

/** Reads a paper's extracted text, asks Lovable AI for the library card, and saves it. */
export const analyzePaper = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin.from("papers").update({ analysis_status: "running" }).eq("id", data.paperId);

    try {
      const r = await callGateway(apiKey, data.text, data.hint);
      const patch = {
        field: r.field,
        question: r.question,
        standing: r.standing,
        standing_reason: r.standing_reason,
        position: r.position,
        position_reason: r.position_reason,
        summary: r.summary,
        analysis_status: "done",
        analyzed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...(data.overwriteIdentity
          ? { title: r.title || data.hint?.title || "Untitled", authors: r.authors, year: r.year ?? data.hint?.year ?? null }
          : {}),
      };
      const { error } = await supabaseAdmin.from("papers").update(patch).eq("id", data.paperId);
      if (error) throw new Error(error.message);
      return { ok: true as const, result: r };
    } catch (e) {
      await supabaseAdmin.from("papers").update({ analysis_status: "failed" }).eq("id", data.paperId);
      const err = e as Error & { status?: number };
      console.error("analyzePaper failed", err.message);
      return { ok: false as const, error: err.message, status: err.status ?? null };
    }
  });
