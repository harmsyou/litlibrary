# Personal Research Reader & Topic Notes

A private-feeling (but open, no login) research site: upload PDFs, read them in their original layout, highlight and comment in the margin, take per-paper notes under topics on the right, and see your quotes + comments flow into a centralized page per topic.

## Pages

**Home (landing)**
- Two columns: **Topics** (your centralized notes, with paper/quote counts) and **Papers** (title, authors, year, date added, topics touched).
- "New topic" and "Upload paper" actions live here. Search/filter across both lists.

**Topic page** (`/topics/:slug`)
- Top: your freeform synthesis — a markdown editor only written here, autosaved.
- Below: **Quotes & comments** gathered from every paper routed to this topic, grouped by paper. Each item shows the highlighted passage, your comment, page number, and a link that opens the paper scrolled to that highlight.
- Rename / delete topic.

**Paper reader** (`/papers/:id`) — split view
- **Left: the PDF** rendered page-by-page in its original layout. Select text to highlight; a small popover lets you add a comment and pick which topic it routes to (defaults to the topic currently open on the right, or "no topic").
- Highlights are drawn over the page in a soft color; comments appear as **margin callouts** beside the PDF (Google-Docs style), aligned to their highlight, with a connector on hover. Click a highlight to focus its callout and vice versa.
- **Right: notes for this paper only.** A topic dropdown at the top switches between topic "tabs" for this paper; each tab is a markdown editor holding your notes about *this paper* as it relates to *that topic*. You can create a new topic from the dropdown. These per-paper notes stay on the paper and are not shown on the topic page (per your answer; easy to flip later).
- Paper metadata (title, authors, year, abstract/summary) editable in a small header; delete paper.

**Upload flow**
- Drag-and-drop PDF from home; title prefilled from the file/metadata, editable before saving.

## Look & feel

- Sans-serif throughout, inspired by and-now / Works in Progress: generous whitespace, strict typographic hierarchy, hairline rules instead of cards, restrained monochrome palette with one warm highlight color for marks and callouts, small-caps/mono metadata labels. No shadows, no gradients.
- Reader chrome stays minimal so the paper dominates; the notes column is calm and text-first.

## Technical details

- **Lovable Cloud** for storage and data (enabled first). Open access, no auth: all tables and the `papers` bucket get anonymous read/write policies. (Anyone with the URL could edit; you chose this — fine for a personal tool, can add a login later.)
- **Data model**
  - `topics` (id, name, slug, synthesis_md, created_at)
  - `papers` (id, title, authors, year, abstract, file_path, page_count, created_at)
  - `paper_topic_notes` (paper_id, topic_id, content_md, updated_at) — per-paper notes per topic
  - `highlights` (id, paper_id, topic_id nullable, page, rects jsonb, quote text, color, comment_md, created_at)
- **PDF rendering**: `pdfjs-dist` via `react-pdf`, loaded client-only (dynamic import behind `ClientOnly`, no SSR). Text layer enabled so selections map to PDF-page coordinates; highlight rects stored relative to page size so they survive zoom/resize. Comments overlay is positioned from the highlight's top rect; overlapping callouts are stacked with a simple collision pass.
- **Markdown editors**: lightweight textarea-based editor with live preview toggle and autosave (debounced) — no heavy WYSIWYG.
- **Topic page aggregation**: a single query on `highlights` joined with `papers` where `topic_id = topic`, grouped client-side by paper.
- **Routes**: `/`, `/topics/$slug`, `/papers/$id`, each with its own head metadata. Data via route loaders + TanStack Query.
- **Deep link to highlight**: `/papers/$id?h=<highlightId>` scrolls to the page and flashes the mark.

## Out of scope for the first build

- Login/permissions, multi-user, AI summarization, per-paper notes syncing to topic pages, PDF annotation export.
