const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "the",
  "of",
  "to",
  "for",
  "in",
  "on",
  "with",
  "at",
  "by",
  "is",
  "it",
  "how",
  "vs",
  "or",
  "your",
  "my",
  "home",
  "official",
  "site",
  "website",
  "page",
]);

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function tokens(s: string): string[] {
  return normalizeText(s)
    .split(" ")
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

export function bigrams(s: string): Set<string> {
  const text = normalizeText(s).replace(/\s+/g, " ");
  const grams = new Set<string>();
  for (let i = 0; i < text.length - 1; i++) grams.add(text.slice(i, i + 2));
  return grams;
}

/** Sørensen–Dice coefficient over character bigrams. 1 = identical. */
export function diceFromSets(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let overlap = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const g of small) if (large.has(g)) overlap++;
  return (2 * overlap) / (a.size + b.size);
}

export function dice(a: string, b: string): number {
  return diceFromSets(bigrams(a), bigrams(b));
}

export function jaccardFromSets(sa: Set<string>, sb: Set<string>): number {
  if (sa.size === 0 && sb.size === 0) return 0;
  let inter = 0;
  const [small, large] = sa.size <= sb.size ? [sa, sb] : [sb, sa];
  for (const t of small) if (large.has(t)) inter++;
  return inter / (sa.size + sb.size - inter);
}

export function jaccard(a: string[], b: string[]): number {
  return jaccardFromSets(new Set(a), new Set(b));
}

/** Combined title similarity: max of character and word overlap. */
export function titleSimilarity(a: string, b: string): number {
  return Math.max(dice(a, b), jaccard(tokens(a), tokens(b)));
}
