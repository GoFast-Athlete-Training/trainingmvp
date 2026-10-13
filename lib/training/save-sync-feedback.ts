export type SaveSyncStatus =
  | { state: "idle" }
  | { state: "saving" }
  | { state: "synced"; message?: string }
  | { state: "error"; message: string };

export function prodSyncMessageFromBody(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const base = typeof o.error === "string" ? o.error.trim() : "";
  const detail = typeof o.prodSyncError === "string" ? o.prodSyncError.trim() : "";
  if (base && detail) return `${base}: ${detail}`;
  return base || detail || null;
}

export async function saveSyncFromResponse(res: Response): Promise<SaveSyncStatus> {
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const message =
      prodSyncMessageFromBody(data) ?? `Save failed (${res.status})`;
    return { state: "error", message };
  }
  return { state: "synced", message: "Saved and synced to prod" };
}
