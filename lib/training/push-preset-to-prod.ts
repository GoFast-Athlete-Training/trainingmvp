/** Prod is source of truth — PATCH/POST plan-preset routes write there directly. */
export async function pushPresetToProd(_opts: {
  presetId: string;
  authorization: string;
  staffId: string;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  return { ok: true };
}
