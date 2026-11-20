export const dynamic = "force-dynamic";

import { proxyProdTrainingRoute } from "@/lib/training/proxy-prod-training-route";
import { NextRequest } from "next/server";

type Params = { params: Promise<{ id: string; plannedWorkoutId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { id, plannedWorkoutId } = await params;
  return proxyProdTrainingRoute(
    request,
    `/api/training/company-plans/${encodeURIComponent(id)}/planned/${encodeURIComponent(plannedWorkoutId)}`,
  );
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { id, plannedWorkoutId } = await params;
  return proxyProdTrainingRoute(
    request,
    `/api/training/company-plans/${encodeURIComponent(id)}/planned/${encodeURIComponent(plannedWorkoutId)}`,
  );
}
