# Paper table with auto-filled reading intelligence

Turn the Papers list on the home page into a clean table. Every time a PDF is uploaded, the site reads the first pages itself and fills in the columns for you; nothing else about the reader or topics changes.

## What the table shows (left to right)

Column order goes from "what is this" to "should I trust it":

| # | Column | What it holds | Why this position |
|---|--------|---------------|-------------------|
| 1 | Title | Paper title, click opens the reader. Year in small mono under it. | Identity first |
| 2 | Authors | First author + "et al." when more than two authors. Full list on hover. | Identity |
| 3 | Field | One of a fixed neuroscience list: Molecular, Cellular, Systems, Cognitive, Computational, Clinical, Developmental, Methods. Shown as a small mono label. Your own note topics still appear as "# topic" underneath, as today. | Where it sits in the discipline |
| 4 | Question | One sentence: the question the paper is trying to answer. Truncated to two lines, full text on hover. | The substance |
| 5 | Standing | Foundational / Established / Recent / Preprint-fresh | How settled the work is |
| 6 | Position | Consensus / Extends / Contrarian / Tangential, with a one-line reason on hover | Where it sits in the debate |

Standing and Position are rendered as quiet text words (no colored pills), with a single amber dot beside Contrarian so outliers are scannable. Column headers are clickable to sort; default order stays newest upload first. The search box already filters papers and will also match Field, Question and the two verdicts.

Definitions shown in a hover tooltip on the column headers so the scale is always explained:

- Standing: Foundational = widely built upon, canonical result. Established = peer-reviewed and absorbed into the literature. Recent = peer-reviewed within roughly the last three years. Preprint-fresh = not yet peer-reviewed.
- Position: Consensus = restates or confirms the mainstream view. Extends = mainstream framing, adds a new piece. Contrarian = argues against the dominant view. Tangential = outside the main line of argument on the question.

## How auto-fill works

1. On upload, the PDF text from the first few pages (title page, abstract, intro, part of discussion) is extracted in the browser, which already has the PDF engine loaded.
2. That text is sent to a server function that asks Lovable AI for a strict structured answer: title, authors, year, field, question, standing (with reason), position (with reason), and a short one-line summary. The model is told the Standing/Position definitions above verbatim.
3. Results are saved on the paper. The row appears immediately with the title and a subtle "Analyzing" state in the other cells, then fills in within a few seconds.
4. Everything stays editable: the existing paper details dialog gets the new fields (dropdowns for Field / Standing / Position, text for Question) plus a "Re-analyze" button in case the first read was off or you uploaded a scan with no text.
5. Existing papers already in the library get a one-time "Analyze" action in the same dialog and a small "Analyze missing" link above the table.

Layout stays two columns: Topics on the left as it is now, the paper table on the right. On the right column the table shows Title, Authors, Field, Standing, Position by default; Question is revealed as a second line under the title so nothing is hidden. On narrow screens rows stack back into the current list style.

## Technical details

- Database: additive migration on `papers` adding nullable `field text`, `question text`, `standing text`, `standing_reason text`, `position text`, `position_reason text`, `summary text`, `analysis_status text default 'pending'`, `analyzed_at timestamptz`. Regenerate types.
- Text extraction: `src/lib/pdf-text.ts` using the already-installed pdfjs (client-only, dynamic import) to pull text from up to the first 6 pages plus the last 2, capped at ~12k characters.
- Server function: `src/lib/analysis.functions.ts` with `analyzePaper` (`createServerFn`, zod input `{ paperId, text }`), calling the Lovable AI gateway with `google/gemini-3-flash` and a tool/JSON schema response; writes results via the admin client inside the handler; fixed enums for field/standing/position validated with zod before saving. Failures set `analysis_status = 'failed'` so the row shows "Analyze" instead of spinning.
- Upload flow: `uploadPaper` unchanged; `UploadPaperDialog` extracts text after upload and fires `analyzePaper` without blocking navigation to the reader; home query invalidates on completion.
- UI: new `src/components/PaperTable.tsx` using the Shadcn `Table` with hairline rules, `label-mono` for Field/Standing/Position, tooltips for definitions and full authors/question; sortable headers held in local state. `PaperMetaDialog` extended with the new fields and Re-analyze.
- Search in `src/routes/index.tsx` extended to the new text fields.
