export const dynamic = "force-dynamic";

import { assertTrainingManagerAuth } from "@/lib/auth/training-manager-auth";
import { serializeCatalogueWorkout } from "@/lib/training/catalogue-serialize";
import {
  catalogueDataToPrismaWrite,
  parseCatalogueBody,
} from "@/lib/training/catalogue-prisma-write";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

async function updateCatalogue(id: string, body: Record<string, unknown>) {
  const parsed = parseCatalogueBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
  }
  const data = catalogueDataToPrismaWrite(parsed.data);
  const row = await prisma.workout_catalogue.update({
    where: { id },
    data: { ...data, updatedAt: new Date() },
  });
  return NextResponse.json({ success: true, item: serializeCatalogueWorkout(row) });
}

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  const row = await prisma.workout_catalogue.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, item: serializeCatalogueWorkout(row) });
}

export async function PATCH(request: NextRequest, ctx: Params) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    return await updateCatalogue(id, body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, ctx: Params) {
  return PATCH(request, ctx);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  try {
    await prisma.workout_catalogue.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }
}
