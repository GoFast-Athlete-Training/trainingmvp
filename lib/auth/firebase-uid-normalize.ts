export function normalizeOperatorFirebaseUid(uid: string | null | undefined): string | null {
  const trimmed = uid?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("temp-")) return null;
  return trimmed;
}
