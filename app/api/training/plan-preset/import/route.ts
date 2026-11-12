export const dynamic = "force-dynamic";

import { proxyProdTrainingRoute } from "@/lib/training/proxy-prod-training-route";
import { NextRequest } from "next/server";

/** Forward full preset graph import to prod prodpush. */
export async function POST(request: NextRequest) {
  return proxyProdTrainingRoute(request, "/api/training/plan-preset/prodpush");
}
