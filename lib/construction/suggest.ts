import { CSI_MASTERFORMAT, type CSIDivision } from './csi-masterformat';

/**
 * Tokenize a string for fuzzy matching. Lowercase, strip punctuation,
 * split on whitespace, remove common construction words that are too
 * generic to be a useful search term.
 */
function tokens(s: string): string[] {
  const stop = new Set([
    'and', 'the', 'of', 'to', 'in', 'a', 'an', 'for', 'with', 'on',
    'rough', 'finish', 'work', 'system', 'systems', 'equipment',
  ]);
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !stop.has(t));
}

/**
 * Score a CSI division against a query string. Higher = better match.
 * - 100 if any query token matches the division's number, name, or description
 * - Bumps for exact word matches
 * - Bumps for matching at the start of a word
 */
function score(div: CSIDivision, queryTokens: string[]): number {
  if (queryTokens.length === 0) return 0;
  const haystacks = [
    div.number.toLowerCase(),
    div.name.toLowerCase(),
    div.description.toLowerCase(),
  ];

  let total = 0;
  for (const q of queryTokens) {
    let best = 0;
    for (const h of haystacks) {
      if (h === q) best = Math.max(best, 100);
      else if (h.startsWith(q)) best = Math.max(best, 50);
      else if (h.includes(' ' + q) || h.startsWith(q)) best = Math.max(best, 40);
      else if (h.includes(q)) best = Math.max(best, 20);
    }
    total += best;
  }
  return total;
}

export interface CSISuggestion {
  division: CSIDivision;
  score: number;
  /** True if this is the top match — render with a 'Suggested' badge */
  isTopMatch: boolean;
}

/**
 * Suggest CSI divisions for a free-text trade name. Returns up to `limit`
 * matches sorted by score (descending). The first match is marked as
 * the "top suggestion" — use that to drive the UI badge / auto-fill.
 *
 * Examples:
 *   suggest('plumbing')        → [{ number: '22', name: 'Plumbing', ... }]
 *   suggest('hvac ductwork')   → [{ '23', name: 'HVAC', ... }, { '23', name: 'HVAC ductwork', ... }]
 *   suggest('drywall finish')  → [{ '09', name: 'Finishes', ... }]
 *   suggest('xyzzy')           → [] (no match)
 */
export function suggestCSI(query: string, limit = 6): CSISuggestion[] {
  const q = query.trim();
  if (!q) return [];

  // If the user typed something that looks like a CSI code ("03", "22 00", "09.29"),
  // boost exact-number matches hard.
  const numericMatch = q.match(/^(\d{2})/);
  if (numericMatch) {
    const direct = CSI_MASTERFORMAT.find((d) => d.number === numericMatch[1]);
    if (direct) {
      return [
        { division: direct, score: 1000, isTopMatch: true },
        ...CSI_MASTERFORMAT
          .filter((d) => d.number !== numericMatch[1])
          .map((d) => ({ division: d, score: 0, isTopMatch: false })),
      ].slice(0, limit);
    }
  }

  const qt = tokens(q);
  if (qt.length === 0) return [];

  const scored = CSI_MASTERFORMAT
    .map((d) => ({ division: d, score: score(d, qt) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (scored.length === 0) return [];
  const topScore = scored[0].score;
  return scored.map((s) => ({ ...s, isTopMatch: s.score === topScore && s.score >= 30 }));
}
