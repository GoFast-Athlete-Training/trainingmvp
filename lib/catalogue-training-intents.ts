/** Align with product API: free-form purpose sentences stored as `trainingIntent` string[]. */

/** Dedupe trimmed non-empty strings (order preserved). */
export function normalizeTrainingIntentArray(values: string[]): string[] {
  const uniq = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const t = raw.trim();
    if (!t || uniq.has(t)) continue;
    uniq.add(t);
    out.push(t);
  }
  return out;
}

/**
 * CSV cell: one sentence per line; empty → [].
 * Whole cell without newlines is a single intent (commas preserved).
 */
export function parseTrainingIntentFromCell(raw: string): string[] {
  const t = raw.trim();
  if (!t) return [];
  const lines = t.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  return normalizeTrainingIntentArray(lines.length ? lines : [t]);
}
