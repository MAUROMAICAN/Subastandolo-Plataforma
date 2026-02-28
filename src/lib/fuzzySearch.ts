/**
 * Simple fuzzy search: matches if query chars appear in order in target,
 * or if Levenshtein distance per word is within tolerance.
 */

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

/** Normalize: lowercase, remove accents */
function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Returns a score 0-1 (1 = perfect match, 0 = no match).
 * Checks exact substring, word-level fuzzy, and operation number match.
 */
export function fuzzyScore(query: string, title: string, opNumber?: string | null): number {
  const q = normalize(query.trim());
  if (!q) return 1;

  // Check operation number exact match
  if (opNumber && normalize(opNumber).includes(q)) return 1;

  const t = normalize(title);

  // Exact substring match
  if (t.includes(q)) return 1;

  // Word-level fuzzy matching
  const queryWords = q.split(/\s+/);
  const titleWords = t.split(/\s+/);

  let totalScore = 0;
  for (const qw of queryWords) {
    let bestWordScore = 0;
    for (const tw of titleWords) {
      // Substring match within word
      if (tw.includes(qw) || qw.includes(tw)) {
        bestWordScore = Math.max(bestWordScore, 0.9);
        continue;
      }
      // Levenshtein tolerance: allow 1 error per 3 chars
      const maxDist = Math.max(1, Math.floor(qw.length / 3));
      const dist = levenshtein(qw, tw.slice(0, qw.length + 2)); // compare similar-length portion
      if (dist <= maxDist) {
        bestWordScore = Math.max(bestWordScore, 1 - dist / (qw.length || 1));
      }
    }
    totalScore += bestWordScore;
  }

  return totalScore / queryWords.length;
}

/** Filter and sort items by fuzzy relevance. Threshold default 0.3 */
export function fuzzyFilter<T>(
  items: T[],
  query: string,
  getText: (item: T) => string,
  getOpNumber?: (item: T) => string | null | undefined,
  threshold = 0.3
): T[] {
  if (!query.trim()) return items;
  
  const scored = items.map(item => ({
    item,
    score: fuzzyScore(query, getText(item), getOpNumber?.(item)),
  }));

  return scored
    .filter(s => s.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .map(s => s.item);
}
