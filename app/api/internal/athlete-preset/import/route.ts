export const dynamic = "force-dynamic";

import { verifyInternalApiKey } from "@/lib/internal-api-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

function slugify(title: string, id: string): string {
  const s = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return s ? `athlete-${s}-${id.slice(0, 8)}` : `athlete-${id.slice(0, 12)}`;
}

/** Machine lane — upsert athlete-derived plan preset for staff review (reverse write from prod). */
export async function POST(request: NextRequest) {
  const denied = verifyInternalApiKey(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as {
    athletePreset?: Record<string, unknown>;
  };
  const ap = body.athletePreset;
  if (!ap || typeof ap !== "object") {
    return NextResponse.json({ success: false, error: "athletePreset object is required" }, { status: 400 });
  }

  const id = typeof ap.id === "string" ? ap.id.trim() : "";
  const title = typeof ap.title === "string" ? ap.title.trim() : "";
  if (!id || !title) {
    return NextResponse.json(
      { success: false, error: "athletePreset.id and title are required" },
      { status: 400 },
    );
  }

  const slug = `athlete-${id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24)}`;
  const description =
    typeof ap.description === "string" ? ap.description.trim() || null : null;
  const minWeeklyMiles =
    typeof ap.minWeeklyMiles === "number" && Number.isFinite(ap.minWeeklyMiles)
      ? Math.max(1, Math.round(ap.minWeeklyMiles))
      : 40;
  const maxWeeklyMiles =
    typeof ap.maxWeeklyMiles === "number" && Number.isFinite(ap.maxWeeklyMiles)
      ? Math.round(ap.maxWeeklyMiles)
      : null;

  await prisma.training_plan_preset.upsert({
    where: { id },
    create: {
      id,
      slug,
      title,
      description,
      publicDescription: description,
      minWeeklyMiles,
      maxWeeklyMiles,
      coachIntent: "Athlete-built preset (reverse sync from prod)",
    },
    update: {
      title,
      description,
      publicDescription: description,
      minWeeklyMiles,
      maxWeeklyMiles,
    },
  });

  return NextResponse.json({ success: true, presetId: id });
}
