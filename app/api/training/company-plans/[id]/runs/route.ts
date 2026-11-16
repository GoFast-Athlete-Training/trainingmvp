export const dynamic = "force-dynamic";

import { proxyProdTrainingRoute } from "@/lib/training/proxy-prod-training-route";
import { NextRequest } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return proxyProdTrainingRoute(
    request,
    `/api/training/company-plans/${encodeURIComponent(id)}/runs`,
  );
}
