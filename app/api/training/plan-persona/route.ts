export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { assertPlanCatalogAuth } from "@/lib/training/plan-catalog-auth";
import { serializePlanPersona } from "@/lib/training/plan-entity-serialize";
import { NextRequest, NextResponse } from "next/server";

/** Stub catalog — list/read personas stored on Training Manage (post prod copy). */
export async function GET(request: NextRequest) {
  const authError = await assertPlanCatalogAuth(request);
  if (authError) return authError;

  const slug = request.nextUrl.searchParams.get("slug")?.trim();
  if (slug) {
    const row = await prisma.training_plan_persona.findUnique({ where: { slug } });
    if (!row) {
      return NextResponse.json({ success: true, persona: null, matched: false });
    }
    return NextResponse.json({
      success: true,
      persona: serializePlanPersona(row),
      matched: true,
    });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim().toLowerCase();
  const all = request.nextUrl.searchParams.get("all") === "1";

  const personas = await prisma.training_plan_persona.findMany({
    orderBy: { updatedAt: "desc" },
    ...(all ? {} : { take: q ? 50 : 200 }),
    ...(q
      ? {
          where: {
            OR: [
              { slug: { contains: q } },
              { title: { contains: q, mode: "insensitive" as const } },
            ],
          },
        }
      : {}),
  });

  return NextResponse.json({
    success: true,
    personas: personas.map(serializePlanPersona),
  });
}

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: "Persona create is not enabled — copy catalog from prod on Training Manage.",
    },
    { status: 501 },
  );
}
