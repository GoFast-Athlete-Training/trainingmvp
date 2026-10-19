import { productTrainingBaseUrl } from "@/lib/training/fetch-prod-plan-catalog";

export async function forwardProdPresetStaffRequest(opts: {
  authorization: string;
  staffId: string;
  path: string;
  method: string;
  body?: unknown;
}): Promise<Response> {
  const base = productTrainingBaseUrl();
  if (!base) {
    return new Response(
      JSON.stringify({ success: false, error: "GOFAST_APP_API_URL is not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const auth = opts.authorization.startsWith("Bearer ")
    ? opts.authorization
    : `Bearer ${opts.authorization}`;

  return fetch(`${base}${opts.path}`, {
    method: opts.method,
    headers: {
      Authorization: auth,
      "x-gofast-staff-id": opts.staffId,
      Accept: "application/json",
      ...(opts.body != null ? { "Content-Type": "application/json" } : {}),
    },
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
}
