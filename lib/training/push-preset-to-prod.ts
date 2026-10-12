import { productTrainingBaseUrl } from "@/lib/training/fetch-prod-plan-catalog";
import { buildPresetProdPushPayload } from "@/lib/training/build-preset-prodpush-payload";

export async function pushPresetToProd(opts: {
  presetId: string;
  authorization: string;
  staffId: string;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const base = productTrainingBaseUrl();
  if (!base) {
    return { ok: false, status: 500, error: "GOFAST_APP_API_URL is not configured" };
  }

  let payload: Awaited<ReturnType<typeof buildPresetProdPushPayload>>;
  try {
    payload = await buildPresetProdPushPayload(opts.presetId);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to build preset payload";
    return { ok: false, status: 400, error: message };
  }

  const bearer = opts.authorization.startsWith("Bearer ")
    ? opts.authorization
    : `Bearer ${opts.authorization}`;

  const url = `${base}/api/training/plan-preset/prodpush`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: bearer,
      "x-gofast-staff-id": opts.staffId,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      ...payload,
      lastSyncedByStaffId: opts.staffId,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    return {
      ok: false,
      status: res.status,
      error: text.slice(0, 500) || `Prod prodpush failed (${res.status})`,
    };
  }

  return { ok: true };
}
