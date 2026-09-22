export const dynamic = "force-dynamic";

import { resolveRequiredAssignFirebaseUid } from "@/lib/auth/training-manager-assign-guard";
import {
  findActiveTrainingManagerSeat,
  findOrCreateTrainingManagerSeat,
  listActiveTrainingManagerSeats,
} from "@/lib/auth/training-manager-seat-resolve";
import { assertAdminAssignActor } from "@/lib/admin-assign-auth";
import { upsertGofastCompanyCopy } from "@/lib/gofast-company-sync";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const auth = await assertAdminAssignActor(request);
  if (!auth.ok) return auth.response;

  const staffId = request.nextUrl.searchParams.get("staffId")?.trim();
  const email = request.nextUrl.searchParams.get("email")?.trim();

  if (!staffId && !email) {
    const managers = await listActiveTrainingManagerSeats();
    return NextResponse.json({ success: true, managers });
  }

  const manager = await findActiveTrainingManagerSeat({ staffId, email });
  if (!manager) {
    return NextResponse.json({ success: false, error: "No Training Manager seat" }, { status: 404 });
  }

  return NextResponse.json({ success: true, manager });
}

export async function POST(request: NextRequest) {
  const auth = await assertAdminAssignActor(request);
  if (!auth.ok) return auth.response;

  let body: {
    staffId?: string;
    email?: string;
    name?: string | null;
    firebaseUid?: string | null;
    firebaseId?: string | null;
    gofastCompanyId?: string;
    company?: { id?: string; name?: string; slug?: string } | null;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const staffId = body.staffId?.trim();
  const email = body.email?.trim();
  const company = body.company;
  const gofastCompanyId = body.gofastCompanyId?.trim() || company?.id?.trim();
  if (!staffId || !email || !gofastCompanyId || !company?.name?.trim() || !company?.slug?.trim()) {
    return NextResponse.json(
      { success: false, error: "staffId, email, and company { id, name, slug } are required" },
      { status: 400 },
    );
  }

  const firebase = resolveRequiredAssignFirebaseUid({
    firebaseUid: body.firebaseUid,
    firebaseId: body.firebaseId,
  });
  if (!firebase.ok) {
    return NextResponse.json({ success: false, error: firebase.error }, { status: firebase.status });
  }

  try {
    await upsertGofastCompanyCopy({
      id: gofastCompanyId,
      name: company.name,
      slug: company.slug,
    });

    const result = await findOrCreateTrainingManagerSeat({
      staffId,
      gofastCompanyId,
      email,
      name: body.name,
      firebaseUid: firebase.firebaseUid,
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      alreadyAssigned: result.alreadyAssigned,
      created: result.created,
      manager: result.manager,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to assign Training Manager seat";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
