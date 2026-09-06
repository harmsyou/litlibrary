/** Browser-only: pull text from the first pages (and last two) of a PDF for analysis. */
export async function extractPdfText(file: Blob, opts: { firstPages?: number; lastPages?: number; maxChars?: number } = {}) {
  const { firstPages = 6, lastPages = 2, maxChars = 12000 } = opts;
  const { pdfjs } = await import("react-pdf");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const n = doc.numPages;
  const pages = new Set<number>();
  for (let i = 1; i <= Math.min(firstPages, n); i++) pages.add(i);
  for (let i = Math.max(1, n - lastPages + 1); i <= n; i++) pages.add(i);
  let out = "";
  for (const p of [...pages].sort((a, b) => a - b)) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const text = content.items
      .map((it) => ("str" in it ? it.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    out += `\n\n[Page ${p}]\n${text}`;
    if (out.length > maxChars) break;
  }
  await doc.destroy();
  return { text: out.slice(0, maxChars).trim(), pageCount: n };
}
