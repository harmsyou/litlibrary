/** Client-safe vocabulary for the auto-filled paper table. */

export const FIELDS = [
  "Molecular",
  "Cellular",
  "Systems",
  "Cognitive",
  "Computational",
  "Clinical",
  "Developmental",
  "Methods",
] as const;
export type Field = (typeof FIELDS)[number];

export const STANDINGS = ["Foundational", "Established", "Recent", "Preprint-fresh"] as const;
export type Standing = (typeof STANDINGS)[number];

export const POSITIONS = ["Consensus", "Extends", "Contrarian", "Tangential"] as const;
export type Position = (typeof POSITIONS)[number];

export const STANDING_DEFS: Record<Standing, string> = {
  Foundational: "Widely built upon; a canonical result.",
  Established: "Peer-reviewed and absorbed into the literature.",
  Recent: "Peer-reviewed within roughly the last three years.",
  "Preprint-fresh": "Not yet peer-reviewed.",
};

export const POSITION_DEFS: Record<Position, string> = {
  Consensus: "Restates or confirms the mainstream view.",
  Extends: "Mainstream framing, adds a new piece.",
  Contrarian: "Argues against the dominant view.",
  Tangential: "Outside the main line of argument on the question.",
};

/** "Smith, Jones & Lee" → "Smith et al." when more than two authors. */
export function shortAuthors(authors: string) {
  const parts = authors
    .split(/,|;|&|\band\b/i)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return "";
  const last = (s: string) => s.split(/\s+/).pop() ?? s;
  if (parts.length === 1) return last(parts[0]!);
  if (parts.length === 2) return `${last(parts[0]!)} & ${last(parts[1]!)}`;
  return `${last(parts[0]!)} et al.`;
}
