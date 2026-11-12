import { NextResponse } from "next/server";

/** Legacy TM-local catalog routes; prod (gofastapp-mvp) is source of truth. */
export function prodOnlyCatalogStub(feature: string) {
  return NextResponse.json(
    {
      success: false,
      error: `${feature} is not stored in Training Manage. Use prod training APIs (GOFAST_APP_API_URL).`,
    },
    { status: 501 },
  );
}
