export const dynamic = "force-dynamic";

import { prodOnlyCatalogStub } from "@/lib/training/prod-only-catalog-stub";
import { NextRequest } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, _ctx: Params) {
  return prodOnlyCatalogStub("Build presets");
}

export async function PATCH(_request: NextRequest, _ctx: Params) {
  return prodOnlyCatalogStub("Build presets");
}

export async function DELETE(_request: NextRequest, _ctx: Params) {
  return prodOnlyCatalogStub("Build presets");
}
