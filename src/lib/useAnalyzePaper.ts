import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { analyzePaper } from "@/lib/analysis.functions";
import { extractPdfText } from "@/lib/pdf-text";
import { getPaperUrl, type Paper } from "@/lib/db";

/** Extracts text from a paper's PDF in the browser and runs the AI analysis. */
export function useAnalyzePaper() {
  const qc = useQueryClient();
  const run = useServerFn(analyzePaper);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["papers"] });
    qc.invalidateQueries({ queryKey: ["paper"] });
  };

  return async (paper: Pick<Paper, "id" | "file_path" | "title" | "authors" | "year">, opts: { file?: Blob; overwriteIdentity?: boolean } = {}) => {
    try {
      const blob = opts.file ?? (await (await fetch(await getPaperUrl(paper.file_path))).blob());
      const { text } = await extractPdfText(blob);
      if (!text) {
        toast.error("This PDF has no readable text (scanned?). Fill the details by hand.");
        return null;
      }
      const res = await run({
        data: {
          paperId: paper.id,
          text,
          hint: { title: paper.title, authors: paper.authors, year: paper.year },
          overwriteIdentity: opts.overwriteIdentity ?? false,
        },
      });
      refresh();
      if (!res.ok) {
        toast.error(res.status === 402 ? "AI credits are used up — add credits to keep analyzing papers." : `Analysis failed: ${res.error}`);
        return null;
      }
      return res.result;
    } catch (e) {
      refresh();
      toast.error((e as Error).message);
      return null;
    }
  };
}
