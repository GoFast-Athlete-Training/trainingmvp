/** Kept in sync with gofastapp-mvp `lib/training/catalogue-slug`. */
export function generateCatalogueSlug(name: string): string {
  const t = name
    .trim()
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return t.length > 0 ? t : "workout";
}
