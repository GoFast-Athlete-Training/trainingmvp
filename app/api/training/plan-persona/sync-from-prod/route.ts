export const dynamic = "force-dynamic";

import { assertTrainingManagerAuth } from "@/lib/auth/training-manager-auth";
import { assertStaffForward, STAFF_ID_HEADER } from "@/lib/staff-forward-auth";
import { fetchProdPlanGoals, fetchProdPlanPersonas } from "@/lib/training/fetch-prod-plan-catalog";
import { importPlanCatalogFromProd } from "@/lib/training/plan-catalog-import";
import { NextRequest, NextResponse } from "next/server";

/**
 * Fetch all personas + goals from prod (staff Bearer) and upsert into TM by id.
 * Auth: HQ staff-forward or local Training Manager (same Bearer used for prod fetch).
 */
export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization")?.trim();
  if (!authorization?.startsWith("Bearer ")) {
    return NextResponse.json({ success: false, error: "Authorization required" }, { status: 401 });
  }

  const forward = await assertStaffForward(request);
  let staffId: string | null = forward.ok ? forward.actor.staffId : null;

  if (!staffId) {
    const tm = await assertTrainingManagerAuth(request);
    if (tm.error) return tm.error;
    staffId = request.headers.get(STAFF_ID_HEADER)?.trim() ?? tm.manager.id;
  }

  try {
    const [personas, goals] = await Promise.all([
      fetchProdPlanPersonas({ authorization, staffId }),
      fetchProdPlanGoals({ authorization, staffId }),
    ]);

    const result = await importPlanCatalogFromProd({ personas, goals });

    return NextResponse.json({
      success: true,
      fetchedFromProd: { personas: personas.length, goals: goals.length },
      ...result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("plan-persona/sync-from-prod:", err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
