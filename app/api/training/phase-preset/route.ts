export const dynamic = "force-dynamic";

import { proxyProdTrainingRoute } from "@/lib/training/proxy-prod-training-route";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  return proxyProdTrainingRoute(request, "/api/training/phase-preset");
}

export async function POST(request: NextRequest) {
  return proxyProdTrainingRoute(request, "/api/training/phase-preset");
}
