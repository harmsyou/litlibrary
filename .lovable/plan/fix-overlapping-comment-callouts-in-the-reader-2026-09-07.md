# Fix overlapping comment callouts in the reader

## The problem

Comments in the right margin are placed by a one-directional stacking pass that only pushes cards *down* from their anchor, and the new-comment box is positioned independently of that pass. So on a dense page:

- A new comment box lands at the raw anchor position and gets buried under already-placed cards.
- Cards that are tall (long quote + long comment) overrun the ones below them, since the stack uses a stale measured height.
- Everything is the same visual weight, so a page with 8 comments becomes a wall of boxes.

## What changes

**1. One layout pass for everything, including the box you're writing in**

The new-comment box becomes part of the same stack as the existing comments, so it can never be covered. The pass runs in two directions around a "priority" card (the one you're writing in, or the one you clicked): that card sits exactly at its anchor, comments below it get pushed down, comments above it get pushed up. Everything else keeps its reading order.

**2. Compact by default, full when you need it**

Each comment collapses to a two-line card: the topic label plus the first line of your comment (or the quote if there's no comment yet). Hovering or clicking expands it in place to show the full quote, full comment, topic picker and actions. This roughly halves the vertical space a busy page needs, so far fewer cards need pushing at all.

**3. Clustering when a page is truly crowded**

When more than a few comments anchor to nearly the same line and still don't fit, they collapse into a single stacked marker showing "3 comments here". Clicking it fans them out and focuses the first. This keeps the margin readable instead of infinitely tall.

**4. Small legibility fixes**

- The card you're hovering or editing lifts above its neighbours instead of being clipped by them.
- The connector line from highlight to card stays visible while a card is displaced, so you can tell which text it belongs to.
- Creating a new comment scrolls its box into view if the placement pushed it off screen.
- Card heights are re-measured after expand/collapse so the stack settles without visible jumps.

## Technical notes

All changes are contained in `src/components/reader/PdfReader.tsx`; no schema or data-layer changes.

- Replace the `callouts` `useMemo` with a `layoutCallouts(items, priorityId, heights)` helper: sort by anchor, place the priority item at its anchor, then sweep downward (`top = max(anchor, prevBottom + GAP)`) and upward (`top = min(anchor, nextTop - height - GAP)`) from that index.
- Feed the pending selection into the same list as a synthetic item with id `"__pending__"` and treat it as the priority.
- Track collapsed vs expanded state per card off `focusedId`/`hovered` (no new persisted state); measure with the existing `calloutHeights` ref, moving the `useLayoutEffect` measurement to depend on the expanded flag.
- Cluster pass: after layout, group consecutive items whose anchors differ by less than ~24px and whose combined height exceeds the available run; render a single `ClusterMarker` with local expand state.
- Keep `z-index` ordering: cluster < collapsed < hovered < focused/pending.
